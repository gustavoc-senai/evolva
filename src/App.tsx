import { lazy, Suspense } from "react";
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  Link,
} from "react-router-dom";
import { useAuth } from "./contexts/Auth";
import { useWorkspace } from "./contexts/Workspace";
import { configured } from "./lib/supabase";
import { Loading, Empty } from "./components/UI";
import Layout from "./components/Layout";
import {
  Landing,
  AuthPage,
  PasswordPage,
  InvitationPage,
} from "./pages/Public";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Students = lazy(() => import("./pages/Students"));
const StudentProfile = lazy(() =>
  import("./pages/Students").then((m) => ({ default: m.StudentProfile })),
);
const Exercises = lazy(() => import("./pages/Exercises"));
const Workouts = lazy(() => import("./pages/Workouts"));
const WorkoutBuilder = lazy(() =>
  import("./pages/Workouts").then((m) => ({ default: m.WorkoutBuilder })),
);
const WorkoutDetail = lazy(() =>
  import("./pages/Workouts").then((m) => ({ default: m.WorkoutDetail })),
);
const Session = lazy(() => import("./pages/Session"));
const Evolution = lazy(() => import("./pages/Evolution"));
const Checkin = lazy(() =>
  import("./pages/Evolution").then((m) => ({ default: m.Checkin })),
);
const Assessments = lazy(() => import("./pages/Assessments"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Messages = lazy(() => import("./pages/Messages"));
const Finance = lazy(() => import("./pages/Finance"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Templates = lazy(() => import("./pages/Templates"));
const Reminders = lazy(() => import("./pages/Reminders"));
const WeeklySchedule = lazy(() => import("./pages/WeeklySchedule"));
function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!configured)
    return (
      <main className="standalone">
        <section className="panel narrow">
          <h1>Conecte seu Evolva</h1>
          <p>
            Crie .env a partir de .env.example, informe a URL e a chave pública
            do Supabase e reinicie npm run dev.
          </p>
          <Link to="/">Voltar ao site</Link>
        </section>
      </main>
    );
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
function RoleGate({ role }: { role: "TRAINER" | "STUDENT" }) {
  const ctx = useWorkspace();
  if (ctx.loading) return <Loading />;
  return ctx.access?.role === role ? (
    <Outlet />
  ) : (
    <Empty title="Esta área não faz parte do seu perfil">
      Use o menu do seu acompanhamento.
    </Empty>
  );
}
export default function App() {
  const { recovery } = useAuth(),
    location = useLocation();
  if (recovery && location.pathname !== "/atualizar-senha")
    return <Navigate to="/atualizar-senha" replace />;
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/cadastro" element={<AuthPage register />} />
        <Route path="/recuperar-senha" element={<PasswordPage />} />
        <Route path="/atualizar-senha" element={<PasswordPage reset />} />
        <Route path="/convite/:token" element={<InvitationPage />} />
        <Route element={<Protected />}>
          <Route path="/app" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="treinos" element={<Workouts />} />
            <Route path="treinos/:id" element={<WorkoutDetail />} />
            <Route path="evolucao" element={<Evolution />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="mensagens" element={<Messages />} />
            <Route path="financeiro" element={<Finance />} />
            <Route path="configuracoes" element={<Settings />} />
            <Route path="notificacoes" element={<Notifications />} />
            <Route path="lembretes" element={<Reminders />} />
            <Route path="rotina" element={<WeeklySchedule />} />
            <Route element={<RoleGate role="TRAINER" />}>
              <Route path="modelos" element={<Templates />} />
              <Route path="alunos" element={<Students />} />
              <Route path="alunos/:id" element={<StudentProfile />} />
              <Route path="exercicios" element={<Exercises />} />
              <Route path="treinos/novo" element={<WorkoutBuilder />} />
              <Route path="avaliacoes" element={<Assessments />} />
              <Route path="relatorios" element={<Reports />} />
            </Route>
            <Route element={<RoleGate role="STUDENT" />}>
              <Route path="treinos/:id/executar" element={<Session />} />
              <Route path="checkin" element={<Checkin />} />
            </Route>
          </Route>
        </Route>
        <Route
          path="*"
          element={
            <main className="standalone">
              <section className="panel narrow">
                <h1>Essa página não está por aqui.</h1>
                <p>Volte ao seu espaço para continuar.</p>
                <Link className="button" to="/app">
                  Abrir meu espaço
                </Link>
              </section>
            </main>
          }
        />
      </Routes>
    </Suspense>
  );
}
