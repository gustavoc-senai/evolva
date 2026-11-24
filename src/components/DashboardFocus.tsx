import { Link } from "react-router-dom";
import { ArrowUpRight, CheckCircle2, Circle, Sparkles } from "lucide-react";

type Student = { id: string; active: boolean };
type Workout = { student_id: string; status: string };
type Charge = { status: string; due_date?: string; due_on?: string };
export default function DashboardFocus({
  students,
  workouts,
  charges,
  today,
}: {
  students: Student[];
  workouts: Workout[];
  charges: Charge[];
  today: string;
}) {
  const active = students.filter((student) => student.active);
  const withoutWorkout = active.filter(
    (student) =>
      !workouts.some(
        (workout) =>
          workout.student_id === student.id && workout.status === "PUBLISHED",
      ),
  ).length;
  const drafts = workouts.filter(
    (workout) => workout.status === "DRAFT",
  ).length;
  const overdue = charges.filter(
    (charge) =>
      charge.status === "OPEN" &&
      (charge.due_date || charge.due_on || today) < today,
  ).length;
  const steps = [
    {
      label: "Cadastre seu primeiro aluno",
      done: students.length > 0,
      path: "/app/alunos",
    },
    {
      label: "Publique o primeiro treino",
      done: workouts.some((workout) => workout.status === "PUBLISHED"),
      path: "/app/treinos",
    },
  ];
  const complete = steps.every((step) => step.done);
  return (
    <section className="focus-panel" aria-label="Prioridades do espaço">
      <div className="focus-intro">
        <span className="focus-symbol">
          <Sparkles size={22} />
        </span>
        <div>
          <span className="eyebrow">SEU ESPAÇO EM DIA</span>
          <h2>
            {complete
              ? "Onde colocar sua atenção"
              : "Vamos preparar seu espaço"}
          </h2>
          <p>
            {complete
              ? "Pendências para organizar o acompanhamento."
              : "Do primeiro cadastro ao treino disponível para o aluno."}
          </p>
        </div>
      </div>
      {!complete && (
        <div className="setup-steps">
          {steps.map((step) => (
            <Link
              key={step.path}
              to={step.path}
              className={step.done ? "is-complete" : ""}
            >
              {step.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
              <span>{step.label}</span>
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </div>
      )}
      <div className="focus-grid">
        {[
          {
            value: withoutWorkout,
            label: "Alunos sem treino publicado",
            path: "/app/alunos",
          },
          { value: drafts, label: "Treinos em rascunho", path: "/app/treinos" },
          {
            value: overdue,
            label: "Cobranças vencidas em aberto",
            path: "/app/financeiro",
          },
        ].map((item) => (
          <Link to={item.path} key={item.path}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
            <ArrowUpRight size={17} />
          </Link>
        ))}
      </div>
    </section>
  );
}
