import { useEffect, useState } from "react";
import { Layers, Check, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "../contexts/Workspace";
import { useRows } from "../lib/hooks";
import { rpc, supabase } from "../lib/supabase";
import { date, errorText, statusLabel, today } from "../lib/utils";
import {
  Heading,
  Feedback,
  ActionForm,
  Field,
  value,
  Empty,
} from "../components/UI";
export default function Plans() {
  const { access } = useWorkspace();
  const plans = useRows<any>("evolva_plans", {}, "code"),
    subscription = useRows<any>(
      "evolva_subscriptions",
      { workspace_id: access?.workspace.id },
      "updated_at",
    ),
    requests = useRows<any>("evolva_plan_requests", {
      workspace_id: access?.workspace.id,
    });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const sub = subscription.rows[0],
    expired = sub && new Date(sub.valid_until) <= new Date();
  return (
    <>
      <Heading
        title="Seu plano Evolva"
        description="Capacidade de alunos e situação do seu espaço profissional."
      />
      <Feedback
        error={error || plans.error || subscription.error || requests.error}
      />
      <section className="subscription-banner">
        <span className="mini-icon">
          <Layers size={25} />
        </span>
        <div>
          <span className="eyebrow">SEU PLANO ATUAL</span>
          <h2>
            {plans.rows.find((p) => p.code === sub?.plan_code)?.name ||
              "Carregando..."}
          </h2>
          <p>
            {expired ? "Período encerrado" : statusLabel(sub?.status || "")} ·
            Validade {date(sub?.valid_until, true)}
          </p>
        </div>
        <span className={"badge " + (expired ? "amber" : "green")}>
          {expired ? "Renovação necessária" : "Consulte a validade"}
        </span>
      </section>
      <p className="notice">Escolha um plano para assinar pelo Mercado Pago. A assinatura será ativada após a confirmação do pagamento.</p>
      <div className="plans-grid">
        {[...plans.rows]
          .sort((a, b) => a.max_students - b.max_students)
          .map((p) => (
            <section
              className={
                "panel plan-card " + (p.code === "PRO" ? "featured" : "")
              }
              key={p.code}
            >
              <span className="eyebrow">
                {p.code === "PRO"
                  ? "MAIS ESPAÇO PARA EVOLUIR"
                  : "SEU ACOMPANHAMENTO"}
              </span>
              <h2>{p.name}</h2>
              <strong>
                {p.max_students}
                <small> alunos ativos</small>
              </strong>
              <ul>
                {[
                  "Treinos e biblioteca de exercícios",
                  "Portal do aluno e registros de sessões",
                  "Agenda, mensagens e financeiro",
                  "Avaliações e fotos privadas",
                ].map((text) => (
                  <li key={text}>
                    <Check size={16} />
                    {text}
                  </li>
                ))}
              </ul>
              <p className="muted small">Cobrança recorrente mensal pelo Mercado Pago.</p>
              <button
                disabled={busy}
                className={p.code === "PRO" ? "" : "secondary"}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const { data, error } = await supabase.functions.invoke("create-subscription", {
                      body: { workspace_id: access?.workspace.id, plan_code: p.code },
                    });
                    if (error) throw error;
                    if (!data?.init_point) throw new Error(data?.error || "NÃ£o foi possÃ­vel iniciar o pagamento.");
                    window.location.assign(data.init_point);
                  } catch (e) {
                    setError(errorText(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Assinar {p.name}
                <ArrowUpRight size={16} />
              </button>
            </section>
          ))}
      </div>
      <section className="panel">
        <h2>Solicitações</h2>
        {requests.rows.length ? (
          requests.rows.map((r) => (
            <div className="activity-row" key={r.id}>
              <strong>
                {plans.rows.find((p) => p.code === r.plan_code)?.name}
              </strong>
              <span>{date(r.created_at)}</span>
              <span className="badge">{statusLabel(r.status)}</span>
            </div>
          ))
        ) : (
          <Empty title="Nenhuma solicitação enviada" />
        )}
      </section>
    </>
  );
}
export function Platform() {
  const { isAdmin } = useWorkspace();
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (isAdmin)
      rpc("evolva_platform_state")
        .then(setData)
        .catch((e) => setError(errorText(e)));
  }, [isAdmin, refresh]);
  if (!isAdmin)
    return <Empty title="Acesso restrito à administração da plataforma" />;
  return (
    <>
      <Heading
        title="Administração da plataforma"
        description="Empresas, capacidade e assinaturas — sem acesso às avaliações privadas dos alunos."
      >
        <button className="secondary" onClick={() => setRefresh((v) => v + 1)}>
          Atualizar
        </button>
      </Heading>
      <Feedback error={error} />
      <div className="metric-grid three">
        {[
          ["Espaços cadastrados", data?.workspaces?.length ?? 0],
          ["Solicitações pendentes", data?.requests?.length ?? 0],
          [
            "Assinaturas ativas",
            data?.workspaces?.filter(
              (w: any) =>
                w.status === "ACTIVE" && new Date(w.valid_until) > new Date(),
            ).length ?? 0,
          ],
        ].map(([label, count]) => (
          <article className="metric" key={label}>
            <span>{label}</span>
            <strong>{count}</strong>
          </article>
        ))}
      </div>
      <section className="panel">
        <h2>Solicitações de plano</h2>
        {!data?.requests?.length ? (
          <p className="muted">Nenhuma solicitação pendente.</p>
        ) : (
          data.requests.map((r: any) => (
            <div className="activity-row" key={r.id}>
              <strong>
                {
                  data.workspaces.find((w: any) => w.id === r.workspace_id)
                    ?.name
                }
              </strong>
              <span>Plano {r.plan_code}</span>
              <small>{date(r.created_at, true)}</small>
            </div>
          ))
        )}
      </section>
      <div className="two-col">
        {data?.workspaces?.map((w: any) => (
          <section className="panel" key={w.id}>
            <h2>{w.name}</h2>
            <p>
              {w.email} · {w.students} alunos ativos
            </p>
            <span className="badge">
              {statusLabel(w.status)} · {date(w.valid_until)}
            </span>
            <ActionForm
              key={refresh + ":" + w.id}
              label="Atualizar assinatura"
              onSuccess={() => setRefresh((v) => v + 1)}
              onSubmit={(d) =>
                rpc("evolva_admin_subscription", {
                  p_workspace: w.id,
                  p_plan: value(d, "plan"),
                  p_status: value(d, "status"),
                  p_until: new Date(
                    value(d, "until") + "T23:59:59",
                  ).toISOString(),
                })
              }
            >
              <div className="form-grid">
                <Field name="plan" label="Plano" value={w.plan}>
                  <option value="START">Essencial</option>
                  <option value="PRO">Profissional</option>
                  <option value="STUDIO">Studio</option>
                </Field>
                <Field name="status" label="Situação" value={w.status}>
                  <option value="TRIAL">Teste</option>
                  <option value="ACTIVE">Ativo</option>
                  <option value="SUSPENDED">Suspenso</option>
                </Field>
              </div>
              <Field
                name="until"
                label="Válido até"
                type="date"
                value={w.valid_until?.slice(0, 10) || today()}
                required
              />
              <p className="muted small">
                Alteração administrativa. Não processa cobranças, estornos ou
                pagamentos.
              </p>
            </ActionForm>
          </section>
        ))}
      </div>
    </>
  );
}
