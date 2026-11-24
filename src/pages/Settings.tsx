import { useState } from "react";
import { useWorkspace } from "../contexts/Workspace";
import { useAuth } from "../contexts/Auth";
import { useRows } from "../lib/hooks";
import { rpc, supabase } from "../lib/supabase";
import { date } from "../lib/utils";
import { Heading, Feedback, ActionForm, Field, value } from "../components/UI";
import { ReminderPreferences } from "./Reminders";
import SetupStatus from "../components/SetupStatus";
export default function Settings() {
  const ctx = useWorkspace(),
    { user } = useAuth();
  const profile = useRows<any>("evolva_workspaces", {
    id: ctx.access?.workspace.id,
  });
  const w = profile.rows[0] || ctx.access?.workspace;
  const audit = useRows<any>("evolva_audit", {
    workspace_id: ctx.access?.workspace.id,
  });
  const [tab, setTab] = useState("profile");
  return (
    <>
      <Heading
        title="Configurações"
        description="Sua identidade profissional e as preferências de acesso."
      />
      <Feedback error={profile.error || audit.error} />
      {(ctx.access?.role === "TRAINER" || ctx.isAdmin) && <SetupStatus />}
      <div className="tabs">
        <button
          className={tab === "profile" ? "active" : ""}
          onClick={() => setTab("profile")}
        >
          Perfil e conta
        </button>
        {ctx.access?.role === "TRAINER" && (
          <button
            className={tab === "audit" ? "active" : ""}
            onClick={() => setTab("audit")}
          >
            Histórico de alterações
          </button>
        )}
      </div>
      {tab === "profile" && ctx.access?.role === "STUDENT" && (
        <ReminderPreferences />
      )}
      {tab === "profile" ? (
        <div className="two-col">
          {ctx.access?.role === "TRAINER" && (
            <section className="panel">
              <h2>Seu perfil profissional</h2>
              <ActionForm
                key={w?.id}
                onSuccess={ctx.reload}
                onSubmit={(d) =>
                  rpc("evolva_save_profile", {
                    p_workspace: w?.id,
                    p_name: value(d, "name"),
                    p_phone: value(d, "phone"),
                    p_bio: value(d, "bio"),
                    p_credential: value(d, "credential"),
                  })
                }
              >
                <Field
                  name="name"
                  label="Nome do espaço"
                  value={w?.name}
                  required
                />
                <div className="form-grid">
                  <Field
                    name="phone"
                    label="Telefone profissional"
                    value={w?.phone}
                  />
                  <Field
                    name="credential"
                    label="Identificação profissional"
                    value={w?.credential}
                    placeholder="Seu registro profissional"
                  />
                </div>
                <Field
                  name="bio"
                  label="Apresentação"
                  type="textarea"
                  value={w?.bio}
                />
              </ActionForm>
            </section>
          )}
          <section className="panel">
            <h2>Segurança da conta</h2>
            <p className="muted">Sua conta: {user?.email}</p>
            <ActionForm
              label="Alterar minha senha"
              onSubmit={async (d) => {
                const password = String(d.get("password") ?? "");
                if (
                  password.length < 8 ||
                  password !== String(d.get("confirm") ?? "")
                )
                  throw Error(
                    "Use pelo menos 8 caracteres e confirme a mesma senha.",
                  );
                const { error } = await supabase.auth.updateUser({ password });
                if (error) throw error;
              }}
            >
              <Field
                name="password"
                label="Nova senha"
                type="password"
                required
              />
              <Field
                name="confirm"
                label="Confirmar nova senha"
                type="password"
                required
              />
            </ActionForm>
            <p className="muted small">
              Seu personal não tem acesso à sua senha. Mudanças de e-mail exigem
              atualização do vínculo e nova confirmação de acesso.
            </p>
          </section>
        </div>
      ) : (
        <section className="panel">
          <h2>Auditoria do espaço</h2>
          <p className="muted small">
            Registra autor, operação e data, sem duplicar o conteúdo das
            avaliações ou conversas.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Recurso</th>
                  <th>Operação</th>
                  <th>Autor</th>
                </tr>
              </thead>
              <tbody>
                {audit.rows.map((a) => (
                  <tr key={a.id}>
                    <td>{date(a.created_at, true)}</td>
                    <td>{a.entity.replace("evolva_", "")}</td>
                    <td>{a.action}</td>
                    <td title={a.actor_id}>
                      {a.actor_id?.slice(0, 8) || "Sistema"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
