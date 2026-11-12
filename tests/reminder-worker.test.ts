// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Shared JavaScript module used by Deno and Node tests.
import { createReminderHandler } from "../supabase/functions/send-reminders/handler.mjs";

const base = {
  EVOLVA_CRON_SECRET: "test-secret",
  EVOLVA_REMINDERS_ENABLED: "true",
  SUPABASE_URL: "https://project.example",
  SUPABASE_SERVICE_ROLE_KEY: "server-only",
  EVOLVA_APP_URL: "https://evolva.example",
  RESEND_API_KEY: "resend-test",
  EVOLVA_EMAIL_FROM: "Evolva <from@example.com>",
};
const request = () =>
  new Request("https://function.example", {
    method: "POST",
    headers: { "x-evolva-cron-secret": "test-secret" },
  });
function setup(
  overrides: Record<string, string> = {},
  provider = async () => Response.json({ id: "email-id" }),
) {
  const env: Record<string, string> = { ...base, ...overrides };
  const finished: any[] = [];
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    if (url.endsWith("evolva_claim_reminders"))
      return Response.json([
        {
          id: "job",
          channel: "EMAIL",
          kind: "WORKOUT",
          email: "student@example.com",
        },
      ]);
    if (url.endsWith("evolva_finish_reminder")) {
      finished.push(JSON.parse(String(init.body)));
      return Response.json(null);
    }
    return provider();
  });
  return {
    handler: createReminderHandler({ env: (key: string) => env[key], fetcher }),
    fetcher,
    finished,
  };
}
describe("Processamento dos lembretes", () => {
  it("monta envio WhatsApp por modelo aprovado sem expor o token no corpo", async () => {
    const env: Record<string, string> = {
      ...base,
      META_ACCESS_TOKEN: "meta-test",
      META_PHONE_NUMBER_ID: "1234",
      META_GRAPH_VERSION: "v99.0",
      META_REMINDER_TEMPLATE: "evolva_lembrete",
    };
    const fetcher = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("evolva_claim_reminders"))
        return Response.json([
          {
            id: "wa-job",
            channel: "WHATSAPP",
            kind: "WORKOUT",
            phone: "+5511999999999",
          },
        ]);
      if (url.endsWith("evolva_finish_reminder")) return Response.json(null);
      expect(url).toBe("https://graph.facebook.com/v99.0/1234/messages");
      const body = JSON.parse(String(init.body));
      expect(body.type).toBe("template");
      expect(body.template.components[0].parameters).toHaveLength(2);
      expect(body.to).toBe("5511999999999");
      expect(String(init.body)).not.toContain("meta-test");
      return Response.json({ messages: [{ id: "whatsapp-id" }] });
    });
    const handler = createReminderHandler({
      env: (key: string) => env[key],
      fetcher,
    });
    expect((await (await handler(request())).json()).accepted).toBe(1);
  });
  it("recusa chamadas sem segredo sem acessar provedores ou banco", async () => {
    const { handler, fetcher } = setup();
    expect(
      (
        await handler(
          new Request("https://function.example", { method: "POST" }),
        )
      ).status,
    ).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("permanece inativo até habilitação explícita", async () => {
    const { handler, fetcher } = setup({ EVOLVA_REMINDERS_ENABLED: "false" });
    expect((await (await handler(request())).json()).processed).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("registra aceite do provedor e usa chave de idempotência no e-mail", async () => {
    const { handler, fetcher, finished } = setup();
    const result = await (await handler(request())).json();
    expect(result.accepted).toBe(1);
    expect(finished[0].p_status).toBe("SENT");
    expect(
      (fetcher.mock.calls[1][1].headers as Record<string, string>)[
        "Idempotency-Key"
      ],
    ).toBe("evolva-reminder/job");
  });
  it("não informa envio confirmado em falhas de rede", async () => {
    const { handler, finished } = setup({}, async () => {
      throw Error("timeout");
    });
    await handler(request());
    expect(finished[0].p_status).toBe("UNCERTAIN");
  });
  it("distingue rejeição de provedor de uma resposta de aceite", async () => {
    const { handler, finished } = setup(
      {},
      async () => new Response("rejected", { status: 400 }),
    );
    await handler(request());
    expect(finished[0].p_status).toBe("FAILED");
  });
});
