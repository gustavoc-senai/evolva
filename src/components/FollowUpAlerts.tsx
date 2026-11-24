import { useState } from "react";
import { Link } from "react-router-dom";
import { date } from "../lib/utils";
import { Empty } from "./UI";

export function followUpRows(
  students: any[],
  sessions: any[],
  threshold: number,
  now = Date.now(),
) {
  return students
    .filter((student) => student.active)
    .map((student) => {
      const last = sessions
        .filter((session) => session.student_id === student.id)
        .sort((a, b) =>
          b.completed_at.localeCompare(a.completed_at),
        )[0]?.completed_at;
      const reference = last || student.created_at;
      const days = reference
        ? Math.floor((now - new Date(reference).getTime()) / 86400000)
        : null;
      return { student, last, days };
    })
    .filter((row) => row.days !== null && row.days >= threshold)
    .sort((a, b) => b.days! - a.days!);
}
export default function FollowUpAlerts({
  students,
  sessions,
}: {
  students: any[];
  sessions: any[];
}) {
  const [threshold, setThreshold] = useState(7);
  const rows = followUpRows(students, sessions, threshold);
  return (
    <section className="panel follow-up-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">MAIS PROXIMIDADE</span>
          <h2>Alunos para acompanhar</h2>
        </div>
        <select
          aria-label="Período sem registros"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
        >
          {[7, 14, 30].map((days) => (
            <option key={days} value={days}>
              Sem registros há {days} dias
            </option>
          ))}
        </select>
      </div>
      <p className="muted small">
        Considera a última sessão enviada ou a data do cadastro quando ainda não
        há sessões. Não indica ausência de atividade física.
      </p>
      {rows.length ? (
        <div className="follow-up-list">
          {rows.map(({ student, last, days }) => (
            <article key={student.id} className="activity-row">
              <span className="avatar">{student.name.slice(0, 1)}</span>
              <div>
                <strong>{student.name}</strong>
                <small>
                  {last
                    ? `Última sessão: ${date(last)}`
                    : "Ainda sem sessões registradas"}{" "}
                  · {days} dias
                </small>
              </div>
              <Link
                className="button secondary small"
                to={`/app/mensagens?aluno=${student.id}`}
              >
                Conversar
              </Link>
              <Link
                className="button secondary small"
                to={`/app/evolucao?aluno=${student.id}`}
              >
                Histórico
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Nenhum aluno neste período">
          Os alunos que precisarem de acompanhamento aparecerão aqui.
        </Empty>
      )}
    </section>
  );
}
