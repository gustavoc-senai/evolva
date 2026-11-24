import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sessão necessária." }, 401);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Sessão inválida." }, 401);
  const { workspace_id, plan_code } = await req.json();
  if (!workspace_id || !["START", "PRO", "STUDIO"].includes(plan_code)) return json({ error: "Plano inválido." }, 400);
  const admin = createClient(url, serviceKey);
  const { data: workspace } = await admin.from("evolva_workspaces").select("id,owner_id,name").eq("id", workspace_id).eq("owner_id", user.id).maybeSingle();
  if (!workspace) return json({ error: "Espaço não encontrado." }, 403);
  const { data: current } = await admin.from("evolva_subscriptions").select("plan_code,mercadopago_plan_code,mercadopago_preapproval_id,mercadopago_status").eq("workspace_id", workspace_id).maybeSingle();
  const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (current?.mercadopago_plan_code === plan_code && current?.mercadopago_preapproval_id && ["authorized", "pending"].includes(current.mercadopago_status)) {
    const existing = await fetch(`https://api.mercadopago.com/preapproval/${current.mercadopago_preapproval_id}`, { headers: { Authorization: `Bearer ${accessToken}` } }).then(r => r.json());
    if (existing?.init_point) return json({ init_point: existing.init_point });
  }
  const amount = Deno.env.get(`MERCADOPAGO_PRICE_${plan_code}`);
  if (!amount || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return json({ error: `Preço do plano ${plan_code} ainda não configurado.` }, 503);
  const secret = accessToken;
  const appUrl = Deno.env.get("EVOLVA_APP_URL");
  if (!secret || !appUrl) return json({ error: "Integração de pagamentos ainda não configurada." }, 503);
  if (current?.mercadopago_preapproval_id && current.mercadopago_status === "authorized") {
    const cancelled = await fetch(`https://api.mercadopago.com/preapproval/${current.mercadopago_preapproval_id}`, { method: "PUT", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
    if (!cancelled.ok) return json({ error: "Cancele a assinatura atual no Mercado Pago antes de trocar de plano." }, 409);
  }
  const response = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", "X-Idempotency-Key": `${workspace_id}-${plan_code}-${crypto.randomUUID()}` },
    body: JSON.stringify({ reason: `Evolva ${plan_code} — ${workspace.name}`, external_reference: `${workspace_id}:${plan_code}`, payer_email: user.email, back_url: `${appUrl.replace(/\/$/, "")}/app/assinatura`, auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: Number(amount), currency_id: "BRL" }, status: "pending" }),
  });
  const result = await response.json();
  if (!response.ok || !result.init_point || !result.id) return json({ error: "Não foi possível iniciar o checkout." }, 502);
  const { error: saveError } = await admin.from("evolva_subscriptions").update({ mercadopago_preapproval_id: result.id, mercadopago_plan_code: plan_code, mercadopago_status: "pending" }).eq("workspace_id", workspace_id);
  if (saveError) {
    await fetch(`https://api.mercadopago.com/preapproval/${result.id}`, { method: "PUT", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
    return json({ error: "Não foi possível vincular a assinatura à sua conta." }, 500);
  }
  return json({ init_point: result.init_point });
});
