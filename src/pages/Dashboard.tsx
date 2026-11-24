import { Link } from "react-router-dom";
import {
  Users,
  Dumbbell,
  Activity,
  ArrowUpRight,
  CalendarDays,
  Plus,
  ClipboardList,
  MessageSquare,
  Wallet,
} from "lucide-react";
import { useWorkspace } from "../contexts/Workspace";
import { useRows } from "../lib/hooks";
import { date, money, today } from "../lib/utils";
import { Heading, Feedback, Empty, Loading } from "../components/UI";
import DashboardFocus from "../components/DashboardFocus";
import FollowUpAlerts from "../components/FollowUpAlerts";
import { TrendChart } from "../components/EvolutionCharts";
import TodayWorkout from "../components/TodayWorkout";
import { monthlyReceipts } from "../lib/analytics";
export default function Dashboard() {
  const { access } = useWorkspace();
  const trainer = access?.role === "TRAINER",
    filters = trainer
      ? { workspace_id: access?.workspace.id }
      : { student_id: access?.studentId };
  const students = useRows<any>("evolva_students", {
      workspace_id: access?.workspace.id,
    }),
    sessions = useRows<any>("evolva_sessions", filters, "completed_at"),
    workouts = useRows<any>("evolva_workouts", filters),
    events = useRows<any>("evolva_events", filters, "starts_at"),
    charges = useRows<any>("evolva_charges", filters),
    receipts = useRows<any>("evolva_receipts", {workspace_id:access?.workspace.id},"created_at",0,{enabled:trainer});
  if (!access) return null;
  const start = new Date();
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return {
      label: d.toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3),
      count: sessions.rows.filter(
        (s) =>
          new Date(s.completed_at).toLocaleDateString("sv-SE") ===
          d.toLocaleDateString("sv-SE"),
      ).length,
    };
  });
  const max = Math.max(1, ...days.map((d) => d.count));
  const future = events.rows
    .filter(
      (e) =>
        new Date(e.starts_at) >= new Date() &&
        !["CANCELLED", "COMPLETED"].includes(e.status),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 4);
  const recent = sessions.rows.slice(0, 5),
    activeStudents = students.rows.filter((s) => s.active);
  const month = new Date().toLocaleDateString("sv-SE").slice(0,7);
  const revenuePoints = monthlyReceipts(receipts.rows);
  const cards = trainer
    ? [
        [
          Users,
          "Alunos ativos",
          activeStudents.length,
          "Pessoas no seu acompanhamento",
        ],
        [
          Activity,
          "Sessões em 7 dias",
          days.reduce((s, d) => s + d.count, 0),
          "Registros enviados pelos alunos",
        ],
        [
          Dumbbell,
          "Treinos publicados",
          workouts.rows.filter((w) => w.status === "PUBLISHED").length,
          "Prescrições disponíveis",
        ],
        [
          Wallet,
          "Cobranças em aberto",
          charges.rows.filter((c) => c.status === "OPEN").length,
          "Consulte os saldos no Financeiro",
        ],
        [Users,"Novos alunos no mês",students.rows.filter(student=>student.created_at?.startsWith(month)).length,"Cadastros neste mês"],
        [CalendarDays,"Atendimentos a confirmar",events.rows.filter(event=>event.status==="SCHEDULED"&&new Date(event.starts_at)>new Date()).length,"Horários futuros ainda não confirmados"],
        [Wallet,"Recebido neste mês",receipts.error ? "—" : money(revenuePoints[5].value),"Recebimentos registrados, sem estornos"],
        [Users,"Total de alunos",students.rows.length,"Cadastros ativos e inativos"],
      ]
    : [
        [
          Dumbbell,
          "Treinos disponíveis",
          workouts.rows.filter((w) => w.status === "PUBLISHED").length,
          "Sua prescrição atual",
        ],
        [
          Activity,
          "Sessões no mês",
          sessions.rows.filter(
            (s) => s.completed_at.slice(0, 7) === today().slice(0, 7),
          ).length,
          "Registradas por você",
        ],
        [
          CalendarDays,
          "Próximos horários",
          future.length,
          "Seus atendimentos agendados",
        ],
        [
          ClipboardList,
          "Última sessão",
          date(sessions.rows[0]?.completed_at),
          "Seu registro mais recente",
        ],
      ];
  return (
    <>
      <Heading
        title={
          trainer
            ? "Visão geral"
            : `Olá, ${access.studentName?.split(" ")[0] || "vamos treinar"}.`
        }
        description={new Date().toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      >
        <Link className="button" to={trainer ? "/app/alunos" : "/app/treinos"}>
          <Plus size={16} />
          {trainer ? "Adicionar aluno" : "Ver meus treinos"}
        </Link>
      </Heading>
      <Feedback
        error={
          students.error ||
          sessions.error ||
          workouts.error ||
          events.error ||
          charges.error || receipts.error
        }
      />
      {sessions.loading || students.loading || workouts.loading || events.loading || charges.loading || receipts.loading ? (
        <Loading />
      ) : (
        <>
          <section className="welcome-banner">
            <div>
              <span className="eyebrow">
                {trainer
                  ? "ACOMPANHE CADA CONQUISTA"
                  : "CONSISTÊNCIA, UM DIA DE CADA VEZ"}
              </span>
              <h2>
                {trainer
                  ? "O cuidado está nos detalhes."
                  : "Seu ritmo. Sua evolução."}
              </h2>
              <p>
                {trainer
                  ? "Treinos organizados e alunos mais próximos. Veja o que merece sua atenção hoje."
                  : "Consulte seu treino e registre sua sessão para manter seu personal por perto."}
              </p>
              <Link to={trainer ? "/app/treinos" : "/app/checkin"}>
                {trainer ? "Organizar prescrições" : "Como você está hoje?"}{" "}
                <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="banner-art">
              <Activity size={80} strokeWidth={1} />
              <span />
              <span />
            </div>
          </section>
          {!trainer && access.studentId && <TodayWorkout studentId={access.studentId}/>}
          <div className="metric-grid">
            {cards.map(([Icon, label, count, hint]: any) => (
              <article className="metric" key={label}>
                <div>
                  <span>{label}</span>
                  <Icon size={18} />
                </div>
                <strong>{count}</strong>
                <small>{hint}</small>
              </article>
            ))}
          </div>
          {trainer && !receipts.error && <TrendChart title="Recebimentos por mês" points={revenuePoints} unit="R$"/>}
          {trainer &&
            !students.loading &&
            !workouts.loading &&
            !charges.loading &&
            !students.error &&
            !workouts.error &&
            !charges.error && (
              <DashboardFocus
                students={students.rows}
                workouts={workouts.rows}
                charges={charges.rows}
                today={today()}
              />
            )}
          {trainer &&
            !students.loading &&
            !sessions.loading &&
            !students.error &&
            !sessions.error && (
              <FollowUpAlerts
                students={students.rows}
                sessions={sessions.rows}
              />
            )}
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">MOVIMENTO NA SEMANA</span>
                  <h2>Sessões registradas</h2>
                </div>
                <span className="badge">Últimos 7 dias</span>
              </div>
              <div
                className="activity-chart"
                aria-label="Sessões registradas por dia"
              >
                {days.map((d, i) => (
                  <div key={i}>
                    <span>{d.count}</span>
                    <div className="bar-track">
                      <div
                        className="bar"
                        style={{
                          height: d.count
                            ? Math.max(5, (d.count / max) * 100) + "%"
                            : "0%",
                        }}
                      />
                    </div>
                    <small>{d.label}</small>
                  </div>
                ))}
              </div>
              <p className="muted small">
                Registros do aluno, sem estimativa de frequência ou execução
                física.
              </p>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <h2>Próximos atendimentos</h2>
                <Link to="/app/agenda">Ver agenda ↗</Link>
              </div>
              {future.length ? (
                future.map((e) => (
                  <div className="agenda-mini" key={e.id}>
                    <span>
                      {new Date(e.starts_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      <small>{date(e.starts_at)}</small>
                    </span>
                    <div>
                      <strong>{e.title}</strong>
                      <small>
                        {students.rows.find((s) => s.id === e.student_id)
                          ?.name ||
                          e.location ||
                          "Atendimento"}
                      </small>
                    </div>
                  </div>
                ))
              ) : (
                <Empty title="Sua agenda está livre">
                  Os próximos atendimentos aparecerão aqui.
                </Empty>
              )}
            </section>
          </div>
          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-heading">
                <h2>Últimas sessões</h2>
                <Link to="/app/evolucao">Ver histórico ↗</Link>
              </div>
              {recent.length ? (
                recent.map((s) => (
                  <div className="activity-row" key={s.id}>
                    <span className="mini-icon">
                      <Activity size={17} />
                    </span>
                    <div>
                      <strong>
                        {trainer
                          ? students.rows.find((a) => a.id === s.student_id)
                              ?.name
                          : workouts.rows.find((w) => w.id === s.workout_id)
                              ?.title}
                      </strong>
                      <small>
                        {date(s.completed_at, true)} · Esforço{" "}
                        {s.effort ?? "não informado"}
                      </small>
                    </div>
                    <span className="badge green">Registrado</span>
                  </div>
                ))
              ) : (
                <Empty title="O histórico começa no primeiro treino">
                  Quando houver registros, você verá a atividade por aqui.
                </Empty>
              )}
            </section>
            <section className="panel quick-panel">
              <span className="eyebrow">VÁ DIRETO AO QUE IMPORTA</span>
              <h2>Sua rotina, simplificada.</h2>
              {[
                [Dumbbell, "Treinos e prescrições", "/app/treinos"],
                [
                  MessageSquare,
                  "Conversas do acompanhamento",
                  "/app/mensagens",
                ],
                [
                  Activity,
                  "Avaliações e evolução",
                  trainer ? "/app/avaliacoes" : "/app/evolucao",
                ],
              ].map(([Icon, label, path]: any) => (
                <Link key={path} to={path}>
                  <span className="mini-icon">
                    <Icon size={19} />
                  </span>
                  <strong>{label}</strong>
                  <ArrowUpRight size={17} />
                </Link>
              ))}
            </section>
          </div>
        </>
      )}
    </>
  );
}
