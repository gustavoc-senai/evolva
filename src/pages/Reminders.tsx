import { useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../contexts/Workspace";
import { useRows } from "../lib/hooks";
import { rpc } from "../lib/supabase";
import { date, errorText } from "../lib/utils";
import {
  Heading,
  ActionForm,
  Field,
  value,
  Feedback,
  Empty,
  Loading,
} from "../components/UI";

export function ReminderPreferences() {
  const { access } = useWorkspace();
  const preferences = useRows<any>("evolva_reminder_preferences", {
    student_id: access?.studentId,
  });
  const current = preferences.rows[0];
  return (
    <section className="panel">
      <h2>Receber lembretes</h2>
      <p className="muted">
        Você escolhe quais canais autoriza para avisos de treinos e atendimentos
        deste acompanhamento. Pode desativar quando quiser.
      </p>
      <Feedback error={preferences.error} />
      {preferences.loading ? (
        <Loading />
      ) : (
        <ActionForm
          key={current?.updated_at || "new"}
          label="Salvar preferências"
          onSubmit={(data) =>
            rpc("evolva_save_reminder_preferences", {
              p_student: access?.studentId,
              p_email: data.has("email"),
              p_whatsapp: data.has("whatsapp"),
              p_phone: value(data, "phone") || null,
            })
          }
        >
          <label className="checkbox-label">
            <input
              name="email"
              type="checkbox"
              defaultChecked={current?.email_enabled || false}
            />
            Autorizo lembretes por e-mail
          </label>
          <label className="checkbox-label">
            <input
              name="whatsapp"
              type="checkbox"
              defaultChecked={current?.whatsapp_enabled || false}
            />
            Autorizo lembretes por WhatsApp
          </label>
          <Field
            label="WhatsApp com código do país"
            name="phone"
            type="tel"
            value={current?.whatsapp_phone}
            placeholder="+5511999999999"
          />
          <p className="muted small">
            Ao desativar um canal, os lembretes pendentes desse canal são
            cancelados. A entrega depende da configuração do serviço pelo
            operador.
          </p>
        </ActionForm>
      )}
    </section>
  );
}
const statusLabels: Record<string, string> = {
  PENDING: "Na fila",
  PROCESSING: "Processando",
  SENT: "Aceito pelo provedor",
  FAILED: "Recusado pelo provedor",
  CANCELLED: "Cancelado",
  UNCERTAIN: "Envio sem confirmação",
};
export default function Reminders() {
  const { access } = useWorkspace();
  const trainer = access?.role === "TRAINER";
  const filters = trainer
    ? { workspace_id: access?.workspace.id }
    : { student_id: access?.studentId };
  const reminders = useRows<any>("evolva_reminders", filters);
  const events = useRows<any>("evolva_events", filters, "starts_at");
  const workouts = useRows<any>("evolva_workouts", filters);
  const students = useRows<any>("evolva_students", {
    workspace_id: access?.workspace.id,
  });
  const [kind, setKind] = useState("EVENT");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const options =
    kind === "EVENT"
      ? events.rows.filter(
          (event) =>
            event.student_id &&
            ["SCHEDULED", "CONFIRMED"].includes(event.status) &&
            new Date(event.starts_at) > new Date(),
        )
      : workouts.rows.filter((workout) => workout.status === "PUBLISHED");
  return (
    <>
      <Heading
        title="Lembretes"
        description="Avisos de treinos e horários, com autorização do aluno."
      >
        <Link className="button secondary" to="/app/configuracoes">
          Configurações
        </Link>
      </Heading>
      <Feedback
        error={
          reminders.error ||
          events.error ||
          workouts.error ||
          students.error ||
          error
        }
      />
      <p className="notice">
        “Na fila” não significa enviado. O operador precisa ativar a função de
        envio e configurar os provedores. Os atendimentos são avisados uma hora
        antes; se faltarem menos de uma hora, entram para envio imediato.
        Treinos entram para envio imediato. Cada registro permite um lembrete
        por canal.
      </p>
      {trainer ? (
        <section className="panel">
          <h2>Programar lembrete</h2>
          <ActionForm
            label="Adicionar à fila"
            onSubmit={(data) =>
              rpc("evolva_queue_reminder", {
                p_event: kind === "EVENT" ? value(data, "record") : null,
                p_workout: kind === "WORKOUT" ? value(data, "record") : null,
                p_channel: value(data, "channel"),
              })
            }
          >
            <label>
              Tipo de lembrete
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                <option value="EVENT">Atendimento</option>
                <option value="WORKOUT">Treino publicado</option>
              </select>
            </label>
            <Field
              key={kind}
              name="record"
              label="Registro para avisar"
              required
            >
              <option value="">Selecione</option>
              {options.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.title} ·{" "}
                  {
                    students.rows.find(
                      (student) => student.id === record.student_id,
                    )?.name
                  }
                  {kind === "EVENT" ? ` · ${date(record.starts_at, true)}` : ""}
                </option>
              ))}
            </Field>
            <Field label="Canal" name="channel" value="EMAIL">
              <option value="EMAIL">E-mail</option>
              <option value="WHATSAPP">WhatsApp</option>
            </Field>
            <p className="muted small">
              O aluno precisa aceitar o convite e autorizar o canal em
              Configurações. A fila não envia conteúdos de avaliações, notas ou
              conversas.
            </p>
          </ActionForm>
        </section>
      ) : (
        <ReminderPreferences />
      )}
      <section className="panel">
        <h2>Histórico de lembretes</h2>
        {reminders.loading ? (
          <Loading />
        ) : !reminders.rows.length ? (
          <Empty title="Nenhum lembrete programado" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Registro</th>
                  <th>Canal</th>
                  <th>Previsto para</th>
                  <th>Situação</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {reminders.rows.map((reminder) => (
                  <tr key={reminder.id}>
                    <td>
                      {reminder.event_id
                        ? events.rows.find(
                            (event) => event.id === reminder.event_id,
                          )?.title || "Atendimento"
                        : workouts.rows.find(
                            (workout) => workout.id === reminder.workout_id,
                          )?.title || "Treino"}
                    </td>
                    <td>
                      {reminder.channel === "EMAIL" ? "E-mail" : "WhatsApp"}
                    </td>
                    <td>{date(reminder.due_at, true)}</td>
                    <td>
                      <span className="badge">
                        {statusLabels[reminder.status] || reminder.status}
                      </span>
                    </td>
                    <td>
                      {reminder.status === "PENDING" && (
                        <button
                          className="secondary small"
                          disabled={Boolean(busy)}
                          onClick={async () => {
                            setBusy(reminder.id);
                            setError("");
                            try {
                              await rpc("evolva_cancel_reminder", {
                                p_reminder: reminder.id,
                              });
                            } catch (err) {
                              setError(errorText(err));
                            } finally {
                              setBusy("");
                            }
                          }}
                        >
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">
          Aceito pelo provedor não confirma entrega ou leitura. Envios sem
          confirmação precisam de revisão antes de qualquer reenvio.
        </p>
      </section>
    </>
  );
}
