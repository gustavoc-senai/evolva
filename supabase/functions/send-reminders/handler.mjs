// Shared with local tests; no credentials or provider responses are logged.
export function createReminderHandler({ env, fetcher = fetch }) {
  return async function handler(request) {
    if (request.method !== "POST")
      return new Response("Método não permitido", { status: 405 });
    const secret = env("EVOLVA_CRON_SECRET");
    if (!secret || request.headers.get("x-evolva-cron-secret") !== secret)
      return new Response("Não autorizado", { status: 401 });
    if (env("EVOLVA_REMINDERS_ENABLED") !== "true")
      return Response.json({ enabled: false, processed: 0 });
    const dbUrl = env("SUPABASE_URL");
    const dbKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const appUrl = env("EVOLVA_APP_URL");
    if (!dbUrl || !dbKey || !appUrl || !/^https:\/\//.test(appUrl))
      return new Response("Configuração de servidor pendente", { status: 503 });
    const emailEnabled = Boolean(
      env("RESEND_API_KEY") && env("EVOLVA_EMAIL_FROM"),
    );
    const whatsappEnabled = Boolean(
      env("META_ACCESS_TOKEN") &&
      env("META_PHONE_NUMBER_ID") &&
      /^v\d+\.\d+$/.test(env("META_GRAPH_VERSION") || "") &&
      env("META_REMINDER_TEMPLATE"),
    );
    async function rpc(name, args) {
      const response = await fetcher(`${dbUrl}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: {
          apikey: dbKey,
          Authorization: `Bearer ${dbKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw Error("database");
      return response.json();
    }
    try {
      const jobs = await rpc("evolva_claim_reminders", {
        p_email: emailEnabled,
        p_whatsapp: whatsappEnabled,
      });
      const totals = { processed: 0, accepted: 0, failed: 0, uncertain: 0 };
      for (const job of jobs) {
        let status = "UNCERTAIN",
          providerId = null;
        try {
          const description =
            job.kind === "EVENT"
              ? `Atendimento em ${new Date(job.starts_at).toLocaleString("pt-BR", { timeZone: env("EVOLVA_TIMEZONE") || "America/Sao_Paulo" })}`
              : "Treino disponível no Evolva";
          const link = `${appUrl.replace(/\/$/, "")}/app`;
          let response;
          if (job.channel === "EMAIL") {
            response = await fetcher("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env("RESEND_API_KEY")}`,
                "Content-Type": "application/json",
                "Idempotency-Key": `evolva-reminder/${job.id}`,
              },
              body: JSON.stringify({
                from: env("EVOLVA_EMAIL_FROM"),
                to: [job.email],
                subject: "Lembrete do Evolva",
                text: `${description}.\nConsulte seu acompanhamento: ${link}\nVocê pode desativar estes avisos em Configurações no Evolva.`,
              }),
              signal: AbortSignal.timeout(8000),
            });
          } else {
            response = await fetcher(
              `https://graph.facebook.com/${env("META_GRAPH_VERSION")}/${env("META_PHONE_NUMBER_ID")}/messages`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${env("META_ACCESS_TOKEN")}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  to: job.phone.replace(/^\+/, ""),
                  type: "template",
                  template: {
                    name: env("META_REMINDER_TEMPLATE"),
                    language: {
                      code: env("META_TEMPLATE_LANGUAGE") || "pt_BR",
                    },
                    components: [
                      {
                        type: "body",
                        parameters: [
                          { type: "text", text: description },
                          { type: "text", text: link },
                        ],
                      },
                    ],
                  },
                }),
                signal: AbortSignal.timeout(8000),
              },
            );
          }
          if (response.ok) {
            const result = await response.json();
            providerId =
              job.channel === "EMAIL" ? result.id : result.messages?.[0]?.id;
            status = providerId ? "SENT" : "UNCERTAIN";
          } else status = response.status >= 500 ? "UNCERTAIN" : "FAILED";
        } catch {
          status = "UNCERTAIN";
        }
        await rpc("evolva_finish_reminder", {
          p_id: job.id,
          p_status: status,
          p_provider: providerId || null,
        });
        totals.processed++;
        if (status === "SENT") totals.accepted++;
        else if (status === "FAILED") totals.failed++;
        else totals.uncertain++;
      }
      return Response.json(totals);
    } catch {
      return new Response(
        "Não foi possível processar a fila. Consulte os estados no banco.",
        { status: 503 },
      );
    }
  };
}
