import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { useWorkspace } from "../contexts/Workspace";
import { useRows } from "../lib/hooks";
import { rpc } from "../lib/supabase";
import {
  Heading,
  Feedback,
  Loading,
  Empty,
  Modal,
  ActionForm,
  Field,
  value,
} from "../components/UI";

export const weekdays = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];
export default function WeeklySchedule() {
  const { access } = useWorkspace();
  const trainer = access?.role === "TRAINER";
  const [params] = useSearchParams();
  const students = useRows<any>("evolva_students", {
    workspace_id: access?.workspace.id,
  });
  const [chosen, setChosen] = useState(params.get("aluno") || "");
  const studentId = trainer
    ? chosen || students.rows.find((student) => student.active)?.id
    : access?.studentId;
  const schedule = useRows<any>("evolva_weekly_schedule", {
    student_id: studentId,
  });
  const workouts = useRows<any>("evolva_workouts", { student_id: studentId });
  const [editing, setEditing] = useState<number | null>(null);
  const currentDay = ((new Date().getDay() + 6) % 7) + 1;
  return (
    <>
      <Heading
        title={trainer ? "Rotina semanal" : "Minha semana"}
        description="Uma organização por dia para deixar a prescrição mais fácil de acompanhar."
      >
        <Link className="button secondary" to="/app/treinos">
          Ver treinos
        </Link>
      </Heading>
      <Feedback error={students.error || schedule.error || workouts.error} />
      {trainer && (
        <section className="panel">
          <label>
            Aluno da rotina
            <select
              value={studentId || ""}
              onChange={(event) => {
                setChosen(event.target.value);
                setEditing(null);
              }}
            >
              <option value="" disabled>
                Selecione
              </option>
              {students.rows
                .filter((student) => student.active)
                .map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
            </select>
          </label>
        </section>
      )}
      {!studentId ? (
        <Empty title="Cadastre um aluno para organizar a semana" />
      ) : schedule.error || workouts.error ? (
        <Empty title="Não foi possível carregar a rotina">Tente atualizar os dados. O professor pode conferir as atualizações em Configurações.</Empty>
      ) : schedule.loading || workouts.loading ? (
        <Loading />
      ) : (
        <div className="weekly-grid">
          {weekdays.map((day, index) => {
            const assignment = schedule.rows.find(
              (item) => item.weekday === index + 1,
            );
            const workout = workouts.rows.find(
              (item) => item.id === assignment?.workout_id,
            );
            const available = workout?.status === "PUBLISHED";
            return (
              <article
                className={
                  "panel weekly-day " +
                  (index + 1 === currentDay ? "is-today" : "")
                }
                key={day}
              >
                <div className="panel-heading">
                  <CalendarDays size={20} />
                  {index + 1 === currentDay && (
                    <span className="badge green">Hoje</span>
                  )}
                </div>
                <h2>{day}</h2>
                <p>
                  {available
                    ? workout.title
                    : assignment
                      ? "Treino indisponível. Aguarde uma atualização do professor."
                      : "Sem treino definido"}
                </p>
                {available && (
                  <Link
                    className="button secondary small"
                    to={`/app/treinos/${workout.id}`}
                  >
                    Ver treino
                  </Link>
                )}
                {trainer && (
                  <button
                    className="secondary small"
                    onClick={() => setEditing(index + 1)}
                  >
                    {assignment ? "Alterar dia" : "Definir treino"}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
      {trainer && studentId && editing !== null && (
        <Modal
          title={`Organizar ${weekdays[editing - 1]}`}
          onClose={() => setEditing(null)}
        >
          <ActionForm
            onSuccess={() => setEditing(null)}
            onSubmit={(data) =>
              rpc("evolva_save_weekly_schedule", {
                p_student: studentId,
                p_weekday: editing,
                p_workout: value(data, "workout") || null,
              })
            }
          >
            <Field
              label="Treino deste dia"
              name="workout"
              value={
                schedule.rows.find((item) => item.weekday === editing)
                  ?.workout_id
              }
            >
              <option value="">Sem treino definido</option>
              {workouts.rows
                .filter((workout) => workout.status === "PUBLISHED")
                .map((workout) => (
                  <option key={workout.id} value={workout.id}>
                    {workout.title}
                  </option>
                ))}
            </Field>
            <p className="muted small">
              Somente treinos publicados deste aluno podem ser usados. A rotina
              organiza a prescrição e não registra sessões automaticamente.
            </p>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
