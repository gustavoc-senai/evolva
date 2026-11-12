import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, ClipboardCheck } from "lucide-react";
import { useWorkspace } from "../contexts/Workspace";
import { useRows } from "../lib/hooks";
import { rpc } from "../lib/supabase";
import { date, today } from "../lib/utils";
import {
  Heading,
  Feedback,
  Empty,
  ActionForm,
  Field,
  value,
  CsvButton,
} from "../components/UI";
import ProgressGallery from "../components/ProgressGallery";
import EvolutionCharts from "../components/EvolutionCharts";
export default function Evolution() {
  const { access } = useWorkspace(),
    [params] = useSearchParams();
  const students = useRows<any>("evolva_students", {
    workspace_id: access?.workspace.id,
  });
  const trainer = access?.role === "TRAINER";
  const [chosen, setChosen] = useState(params.get("aluno") || "");
  const studentId = trainer
    ? chosen || students.rows[0]?.id
    : access?.studentId;
  const filter = {
    student_id: studentId || "00000000-0000-0000-0000-000000000000",
  };
  const sessions = useRows<any>("evolva_sessions", filter, "completed_at"),
    logs = useRows<any>("evolva_student_set_logs", filter, "id"),
    items = useRows<any>("evolva_workout_items", {}, "position"),
    exercises = useRows<any>("evolva_exercises", {}, "name"),
    workouts = useRows<any>("evolva_workouts", filter),
    assessments = useRows<any>("evolva_assessments", filter, "assessed_on"),
    checkins = useRows<any>("evolva_checkins", filter, "checkin_date");
  const [exercise, setExercise] = useState("");
  const relevantLogs = logs.rows.filter(
    (l) =>
      sessions.rows.some((s) => s.id === l.session_id) &&
      (!exercise ||
        items.rows.find((i) => i.id === l.item_id)?.exercise_id === exercise),
  );
  return (
    <>
      <Heading
        title={trainer ? "Histórico e evolução" : "Minha evolução"}
        description="O caminho é construído em cada registro, sem estimativas inventadas."
      >
        <CsvButton
          name="evolva-sessoes.csv"
          headers={["Data", "Treino", "Esforço", "Observações"]}
          rows={sessions.rows.map((s) => [
            date(s.completed_at, true),
            workouts.rows.find((w) => w.id === s.workout_id)?.title,
            s.effort,
            s.notes,
          ])}
        />
      </Heading>
      <Feedback
        error={
          sessions.error || logs.error || assessments.error || checkins.error
        }
        message={
          params.get("registrado")
            ? "Sessão registrada. Seu personal já pode consultar o acompanhamento."
            : undefined
        }
      />
      {trainer && (
        <section className="panel">
          <label>
            Aluno
            <select
              value={studentId || ""}
              onChange={(e) => setChosen(e.target.value)}
            >
              {students.rows.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      {studentId &&
        !sessions.loading &&
        !assessments.loading &&
        !logs.loading &&
        !items.loading &&
        !exercises.loading &&
        !sessions.error &&
        !assessments.error &&
        !logs.error &&
        !items.error &&
        !exercises.error && (
          <EvolutionCharts
            key={studentId}
            sessions={sessions.rows}
            assessments={assessments.rows}
            logs={logs.rows}
            items={items.rows}
            exercises={exercises.rows}
          />
        )}
      <div className="metric-grid three">
        {[
          ["Sessões registradas", sessions.rows.length],
          ["Séries registradas", relevantLogs.length],
          ["Avaliações disponíveis", assessments.rows.length],
        ].map(([label, count]) => (
          <article className="metric" key={label}>
            <span>{label}</span>
            <strong>{count}</strong>
          </article>
        ))}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>Histórico de séries e cargas</h2>
          <select
            aria-label="Filtrar exercício"
            value={exercise}
            onChange={(e) => setExercise(e.target.value)}
          >
            <option value="">Todos os exercícios</option>
            {exercises.rows
              .filter((e) =>
                items.rows.some(
                  (i) =>
                    i.exercise_id === e.id &&
                    logs.rows.some(
                      (l) =>
                        l.item_id === i.id &&
                        sessions.rows.some((s) => s.id === l.session_id),
                    ),
                ),
              )
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
        </div>
        {relevantLogs.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Exercício</th>
                  <th>Série</th>
                  <th>Repetições</th>
                  <th>Carga</th>
                </tr>
              </thead>
              <tbody>
                {[...relevantLogs]
                  .sort((a, b) =>
                    (
                      sessions.rows.find((s) => s.id === b.session_id)
                        ?.completed_at || ""
                    ).localeCompare(
                      sessions.rows.find((s) => s.id === a.session_id)
                        ?.completed_at || "",
                    ),
                  )
                  .slice(0, 100)
                  .map((l) => (
                    <tr key={l.id}>
                      <td>
                        {date(
                          sessions.rows.find((s) => s.id === l.session_id)
                            ?.completed_at,
                          true,
                        )}
                      </td>
                      <td>
                        {exercises.rows.find(
                          (e) =>
                            e.id ===
                            items.rows.find((i) => i.id === l.item_id)
                              ?.exercise_id,
                        )?.name || "Prescrição arquivada"}
                      </td>
                      <td>{l.set_number}</td>
                      <td>{l.repetitions}</td>
                      <td>
                        {l.load_kg !== null
                          ? l.load_kg + " kg"
                          : "Não informada"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Seu histórico começa com uma sessão" />
        )}
      </section>
      <div className="two-col">
        <section className="panel">
          <h2>Avaliações</h2>
          {assessments.rows.length ? (
            assessments.rows.map((a) => (
              <article className="assessment-summary" key={a.id}>
                <strong>{date(a.assessed_on)}</strong>
                <div>
                  <span>
                    Peso <b>{a.weight_kg ?? "—"} kg</b>
                  </span>
                  <span>
                    Altura <b>{a.height_cm ?? "—"} cm</b>
                  </span>
                  <span>
                    Cintura <b>{a.waist_cm ?? "—"} cm</b>
                  </span>
                  <span>
                    Quadril <b>{a.hip_cm ?? "—"} cm</b>
                  </span>
                </div>
                {a.notes && <p>{a.notes}</p>}
              </article>
            ))
          ) : (
            <Empty title="Nenhuma avaliação compartilhada" />
          )}
        </section>
        <section className="panel">
          <h2>Check-ins recentes</h2>
          {checkins.rows.length ? (
            checkins.rows.slice(0, 10).map((c) => (
              <div className="checkin-summary" key={c.id}>
                <span className="mini-icon">
                  <ClipboardCheck size={18} />
                </span>
                <div>
                  <strong>{date(c.checkin_date)}</strong>
                  <small>
                    Energia {c.energy}/5 · Sono {c.sleep_quality}/5
                  </small>
                  <p>{c.notes}</p>
                </div>
              </div>
            ))
          ) : (
            <Empty title="Como está sua rotina?">
              Os check-ins registrados aparecerão aqui.
            </Empty>
          )}
        </section>
      </div>
      {studentId && <ProgressGallery studentId={studentId} />}
      <section className="panel">
        <h2>Sessões</h2>
        {sessions.rows.length ? (
          sessions.rows.slice(0, 30).map((s) => (
            <div className="activity-row" key={s.id}>
              <span className="mini-icon">
                <Activity size={18} />
              </span>
              <div>
                <strong>
                  {workouts.rows.find((w) => w.id === s.workout_id)?.title ||
                    "Treino"}
                </strong>
                <small>
                  {date(s.completed_at, true)} · Esforço{" "}
                  {s.effort ?? "não informado"}
                </small>
                {s.notes && <p>{s.notes}</p>}
              </div>
            </div>
          ))
        ) : (
          <Empty title="Nenhuma sessão registrada" />
        )}
      </section>
    </>
  );
}
export function Checkin() {
  const { access } = useWorkspace();
  const rows = useRows<any>(
    "evolva_checkins",
    { student_id: access?.studentId },
    "checkin_date",
  );
  const current = rows.rows.find((c) => c.checkin_date === today());
  return (
    <>
      <Heading
        title="Como você está hoje?"
        description="Um pequeno registro ajuda seu personal a acompanhar sua rotina."
      />
      <Feedback error={rows.error} />
      <section className="panel checkin-form">
        <span className="mini-icon">
          <Activity size={26} />
        </span>
        <h2>Seu check-in de hoje</h2>
        <p className="muted">
          Responda com sua percepção. Você pode atualizar o registro do dia.
        </p>
        <ActionForm
          key={current?.id || "new"}
          label={current ? "Atualizar check-in" : "Enviar check-in"}
          onSubmit={(d) =>
            rpc("evolva_submit_checkin", {
              p_student: access?.studentId,
              p_energy: Number(value(d, "energy")),
              p_sleep: Number(value(d, "sleep")),
              p_notes: value(d, "notes") || null,
            })
          }
        >
          <Field
            label="Como está sua energia?"
            name="energy"
            value={current?.energy || 3}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
                {n === 1 ? " · Muito baixa" : n === 5 ? " · Muito alta" : ""}
              </option>
            ))}
          </Field>
          <Field
            label="Como você percebeu a qualidade do seu sono?"
            name="sleep"
            value={current?.sleep_quality || 3}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
                {n === 1 ? " · Muito ruim" : n === 5 ? " · Muito boa" : ""}
              </option>
            ))}
          </Field>
          <Field
            name="notes"
            label="Quer contar algo ao seu personal?"
            type="textarea"
            value={current?.notes}
            max={1000}
          />
        </ActionForm>
      </section>
    </>
  );
}
