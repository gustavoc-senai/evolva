import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function validSignature(req: Request, dataId: string, secret: string) {
  const signature = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  const fields = Object.fromEntries(signature.split(",").map((part) => part.trim().split("=")));
  if (!fields.ts || !fields.v1 || !requestId || !dataId) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${fields.ts};`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest)));
  const expected = [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== fields.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ fields.v1.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const url = new URL(req.url);
  const topic = url.searchParams.get("type") || url.searchParams.get("topic");
  const id = url.searchParams.get("data.id") || url.searchParams.get("id");
  if (!id || !["subscription_preapproval", "subscription_authorized_payment"].includes(topic || "")) return new Response("Ignored", { status: 200 });
  const webhookSecret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
  const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!webhookSecret || !accessToken) return new Response("Not configured", { status: 503 });
  if (!await validSignature(req, id, webhookSecret)) return new Response("Invalid signature", { status: 401 });
  if (topic === "subscription_authorized_payment") {
    const invoiceResponse = await fetch(`https://api.mercadopago.com/authorized_payments/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!invoiceResponse.ok) return new Response("Payment lookup failed", { status: 502 });
    const invoice = await invoiceResponse.json();
    if (invoice.status !== "processed") return new Response("Payment not processed", { status: 200 });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: row } = await admin.from("evolva_subscriptions").select("workspace_id,mercadopago_plan_code").eq("mercadopago_preapproval_id", String(invoice.preapproval_id)).maybeSingle();
    if (!row) return new Response("Subscription not found", { status: 200 });
    const paidAt = invoice.date_created && Number.isFinite(Date.parse(invoice.date_created)) ? new Date(invoice.date_created) : new Date();
    paidAt.setMonth(paidAt.getMonth() + 1);
    const { error } = await admin.from("evolva_subscriptions").update({ plan_code: row.mercadopago_plan_code, status: "ACTIVE", mercadopago_status: "authorized", valid_until: paidAt.toISOString(), updated_at: new Date().toISOString() }).eq("workspace_id", row.workspace_id);
    return error ? new Response("Subscription update failed", { status: 500 }) : new Response("OK", { status: 200 });
  }
  const remoteResponse = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!remoteResponse.ok) return new Response("Provider lookup failed", { status: 502 });
  const remote = await remoteResponse.json();
  const [workspaceId, planCode] = String(remote.external_reference || "").split(":");
  if (!workspaceId || !["START", "PRO", "STUDIO"].includes(planCode)) return new Response("Unknown subscription", { status: 200 });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: row } = await admin.from("evolva_subscriptions").select("mercadopago_preapproval_id").eq("workspace_id", workspaceId).maybeSingle();
  if (!row || row.mercadopago_preapproval_id !== String(remote.id)) return new Response("Subscription mismatch", { status: 200 });
  const status = remote.status === "cancelled" || remote.status === "paused" ? "SUSPENDED" : null;
  if (!status) {
    await admin.from("evolva_subscriptions").update({ mercadopago_status: remote.status }).eq("workspace_id", workspaceId);
    return new Response("Pending", { status: 200 });
  }
  const fallback = new Date(); fallback.setMonth(fallback.getMonth() + 1);
  const validUntil = remote.next_payment_date && Number.isFinite(Date.parse(remote.next_payment_date)) ? remote.next_payment_date : fallback.toISOString();
  await admin.from("evolva_subscriptions").update({ plan_code: planCode, status, mercadopago_status: remote.status, valid_until: validUntil, updated_at: new Date().toISOString() }).eq("workspace_id", workspaceId);
  return new Response("OK", { status: 200 });
});
