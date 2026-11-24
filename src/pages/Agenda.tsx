import { useState } from "react";
import { CalendarDays, Plus, MapPin, Check } from "lucide-react";
import { useWorkspace } from "../contexts/Workspace";
import { useRows } from "../lib/hooks";
import { rpc } from "../lib/supabase";
import { date, today, statusLabel, errorText } from "../lib/utils";
import AgendaCalendar from "../components/AgendaCalendar";
import {
  Heading,
  Feedback,
  Empty,
  Loading,
  Modal,
  ActionForm,
  Field,
  value,
} from "../components/UI";
const local = (raw: string) => {
  const d = new Date(raw);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export default function Agenda() {
  const { access } = useWorkspace();
  const trainer = access?.role === "TRAINER";
  const students = useRows<any>("evolva_students", {
    workspace_id: access?.workspace.id,
  });
  const rows = useRows<any>(
    "evolva_events",
    trainer
      ? { workspace_id: access?.workspace.id }
      : { student_id: access?.studentId },
    "starts_at",
  );
  const [from, setFrom] = useState(today()),
    [until, setUntil] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [edit, setEdit] = useState<any | undefined>(undefined),
    [error, setError] = useState("");
  const [view, setView] = useState<"list" | "week" | "month">("list");
  const visible = rows.rows
    .filter(
      (e) =>
        (!from || new Date(e.starts_at).toLocaleDateString("sv-SE") >= from) &&
        (!until ||
          new Date(e.starts_at).toLocaleDateString("sv-SE") <= until) &&
        `${e.title} ${e.location || ""} ${students.rows.find((s) => s.id === e.student_id)?.name || ""}`
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR").trim()) &&
        (!status || e.status === status),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <>
      <Heading
        title={trainer ? "Sua agenda" : "Meus horários"}
        description="Atendimentos organizados e contexto para cada encontro."
      >
        {trainer && (
          <button onClick={() => setEdit(null)}>
            <Plus size={17} />
            Novo atendimento
          </button>
        )}
      </Heading>
      <Feedback error={rows.error || students.error || error} />
      <div className="tabs" aria-label="Visualização da agenda">
        {[
          ["list", "Lista"],
          ["week", "Semana"],
          ["month", "Mês"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={view === key}
            className={view === key ? "active" : ""}
            onClick={() => {
              setView(key as typeof view);
              if (key !== "list") {
                setFrom("");
                setUntil("");
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="actions agenda-presets" aria-label="Períodos da agenda">
          <button
            className="secondary small"
            onClick={() => {
              setFrom(today());
              setUntil(today());
            }}
          >
            Hoje
          </button>
          <button
            className="secondary small"
            onClick={() => {
              const end = new Date();
              end.setDate(end.getDate() + 6);
              setFrom(today());
              setUntil(end.toLocaleDateString("sv-SE"));
            }}
          >
            Próximos 7 dias
          </button>
          <button
            className="secondary small"
            onClick={() => {
              setFrom(today());
              setUntil("");
            }}
          >
            Próximos atendimentos
          </button>
          <button
            className="secondary small"
            onClick={() => {
              setFrom("");
              setUntil("");
              setStatus("");
              setSearch("");
            }}
          >
            Limpar filtros
          </button>
        </div>
        <div className="filters">
          <label>
            Buscar atendimento
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Título, aluno ou local"
            />
          </label>
          <label>
            A partir de
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Até
            <input
              type="date"
              value={until}
              min={from || undefined}
              onChange={(e) => setUntil(e.target.value)}
            />
          </label>
          <label>
            Situação
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todas</option>
              {["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"].map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondary"
            onClick={() => {
              setFrom("");
              setUntil("");
            }}
          >
            Incluir histórico
          </button>
        </div>
        {from && until && until < from && (
          <Feedback error="A data final deve ser igual ou posterior à inicial." />
        )}
        {!rows.loading && (
          <p className="muted small" role="status">
            {visible.length} atendimento(s) no período selecionado. Horários no
            fuso {Intl.DateTimeFormat().resolvedOptions().timeZone}.
          </p>
        )}
      </section>
      {view !== "list" && !rows.loading && (
        <AgendaCalendar
          mode={view}
          events={rows.rows.filter(
            (e) =>
              (!status || e.status === status) &&
              `${e.title} ${e.location || ""} ${students.rows.find((s) => s.id === e.student_id)?.name || ""}`
                .toLowerCase()
                .includes(search.toLowerCase().trim()),
          )}
          onDay={(day) => {
            setFrom(day);
            setUntil(day);
          }}
        />
      )}
      {rows.loading ? (
        <Loading />
      ) : !visible.length ? (
        <Empty title="Nenhum atendimento neste período">
          Os horários agendados aparecerão aqui.
        </Empty>
      ) : (
        <div className="agenda-list">
          {visible.map((e) => (
            <article className="panel agenda-card" key={e.id}>
              <div className="calendar-date">
                <span>
                  {new Date(e.starts_at)
                    .toLocaleDateString("pt-BR", { month: "short" })
                    .replace(".", "")}
                </span>
                <strong>{new Date(e.starts_at).getDate()}</strong>
              </div>
              <div className="agenda-card-body">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      {date(e.starts_at, true)} —{" "}
                      {new Date(e.ends_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <h2>{e.title}</h2>
                  </div>
                  <span
                    className={
                      "badge " +
                      (e.status === "CONFIRMED"
                        ? "green"
                        : e.status === "CANCELLED"
                          ? "gray"
                          : "amber")
                    }
                  >
                    {statusLabel(e.status)}
                  </span>
                </div>
                <p>
                  {students.rows.find((s) => s.id === e.student_id)?.name ||
                    "Compromisso do profissional"}
                </p>
                {e.location && (
                  <small className="location">
                    <MapPin size={14} />
                    {e.location}
                  </small>
                )}
                {e.notes && <p className="muted">{e.notes}</p>}
                <div className="actions">
                  {trainer ? (
                    <button
                      className="secondary small"
                      onClick={() => setEdit(e)}
                    >
                      Editar atendimento
                    </button>
                  ) : (
                    e.status === "SCHEDULED" && (
                      <button
                        className="secondary small"
                        onClick={async () => {
                          try {
                            await rpc("evolva_confirm_event", {
                              p_event: e.id,
                            });
                          } catch (err) {
                            setError(errorText(err));
                          }
                        }}
                      >
                        <Check size={15} />
                        Confirmar presença
                      </button>
                    )
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {edit !== undefined && (
        <Modal
          title={edit ? "Editar atendimento" : "Agendar atendimento"}
          onClose={() => setEdit(undefined)}
        >
          <ActionForm
            onSuccess={() => setEdit(undefined)}
            onSubmit={(d) => {
              const start = new Date(value(d, "start"));
              const end = new Date(value(d, "end"));
              if (
                !Number.isFinite(start.getTime()) ||
                !Number.isFinite(end.getTime()) ||
                end <= start
              )
                throw Error(
                  "O fim do atendimento deve ser posterior ao início.",
                );
              return rpc("evolva_save_event", {
                p_workspace: access?.workspace.id,
                p_event: edit?.id ?? null,
                p_student: value(d, "student") || null,
                p_title: value(d, "title"),
                p_start: new Date(value(d, "start")).toISOString(),
                p_end: new Date(value(d, "end")).toISOString(),
                p_location: value(d, "location") || null,
                p_notes: value(d, "notes") || null,
                p_status: value(d, "status"),
              });
            }}
          >
            <Field
              name="title"
              label="Nome do atendimento"
              value={edit?.title}
              required
            />
            <Field
              name="student"
              label="Aluno (opcional)"
              value={edit?.student_id}
            >
              <option value="">Compromisso do profissional</option>
              {students.rows
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Field>
            <div className="form-grid">
              <Field
                name="start"
                label="Início"
                type="datetime-local"
                value={edit ? local(edit.starts_at) : today() + "T09:00"}
                required
              />
              <Field
                name="end"
                label="Fim"
                type="datetime-local"
                value={edit ? local(edit.ends_at) : today() + "T10:00"}
                required
              />
            </div>
            <Field
              name="location"
              label="Local ou link do encontro"
              value={edit?.location}
            />
            <Field
              name="notes"
              label="Observações compartilhadas"
              type="textarea"
              value={edit?.notes}
            />
            <Field
              name="status"
              label="Situação"
              value={edit?.status || "SCHEDULED"}
            >
              {["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED"].map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </Field>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
