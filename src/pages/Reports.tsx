import { useState } from "react";
import { useWorkspace } from "../contexts/Workspace";
import { useRows } from "../lib/hooks";
import { money, today, date } from "../lib/utils";
import { Heading, Feedback, CsvButton, Empty } from "../components/UI";
export default function Reports() {
  const { access } = useWorkspace();
  const students = useRows<any>("evolva_students", {
      workspace_id: access?.workspace.id,
    }),
    sessions = useRows<any>(
      "evolva_sessions",
      { workspace_id: access?.workspace.id },
      "completed_at",
    ),
    receipts = useRows<any>("evolva_receipts", {
      workspace_id: access?.workspace.id,
    }),
    checkins = useRows<any>(
      "evolva_checkins",
      { workspace_id: access?.workspace.id },
      "checkin_date",
    );
  const [from, setFrom] = useState(today().slice(0, 7) + "-01"),
    [to, setTo] = useState(today());
  const sessionRows = sessions.rows.filter((s) => {
    const day = new Date(s.completed_at).toLocaleDateString("sv-SE");
    return day >= from && day <= to;
  });
  const receiptRows = receipts.rows.filter((r) => {
    const day = new Date(r.created_at).toLocaleDateString("sv-SE");
    return !r.reversed_at && day >= from && day <= to;
  });
  const rows = students.rows.map((s) => ({
    student: s,
    count: sessionRows.filter((r) => r.student_id === s.id).length,
    last: sessionRows.find((r) => r.student_id === s.id)?.completed_at,
    checkins: checkins.rows.filter(
      (c) =>
        c.student_id === s.id && c.checkin_date >= from && c.checkin_date <= to,
    ).length,
  }));
  return (
    <>
      <Heading
        title="Relatórios do acompanhamento"
        description="Dados registrados para orientar sua próxima conversa, sem previsões de desempenho."
      />
      <Feedback
        error={
          students.error || sessions.error || receipts.error || checkins.error
        }
      />
      <section className="panel">
        <div className="filters">
          <label>
            Início
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Fim
            <input
              type="date"
              min={from}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <CsvButton
            name="evolva-acompanhamento.csv"
            headers={[
              "Aluno",
              "Ativo",
              "Sessões",
              "Check-ins",
              "Última sessão no período",
            ]}
            rows={rows.map((r) => [
              r.student.name,
              r.student.active ? "Sim" : "Não",
              r.count,
              r.checkins,
              date(r.last, true),
            ])}
          />
        </div>
      </section>
      <div className="metric-grid three">
        {[
          ["Sessões no período", sessionRows.length],
          ["Alunos com registros", rows.filter((r) => r.count > 0).length],
          [
            "Recebimentos do período",
            money(receiptRows.reduce((n, r) => n + Number(r.amount), 0)),
          ],
        ].map(([label, count]) => (
          <article className="metric" key={label}>
            <span>{label}</span>
            <strong>{count}</strong>
          </article>
        ))}
      </div>
      <section className="panel">
        <h2>Visão por aluno</h2>
        {!rows.length ? (
          <Empty title="Cadastre seu primeiro aluno" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Cadastro</th>
                  <th>Sessões</th>
                  <th>Check-ins</th>
                  <th>Última sessão no período</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.student.id}>
                    <td>
                      <strong>{r.student.name}</strong>
                    </td>
                    <td>{r.student.active ? "Ativo" : "Inativo"}</td>
                    <td>{r.count}</td>
                    <td>{r.checkins}</td>
                    <td>{date(r.last, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">
          Contagens de registros não são comprovação de execução, adesão
          percentual ou resultado físico.
        </p>
      </section>
    </>
  );
}
