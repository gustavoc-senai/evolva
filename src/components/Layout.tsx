import { useEffect, useState } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  Link,
} from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Dumbbell,
  ClipboardList,
  Activity,
  CalendarDays,
  MessageSquare,
  Wallet,
  ChartNoAxesCombined,
  Bell,
  Settings,
  Layers,
  Menu,
  X,
  LogOut,
  ChevronDown,
  ArrowUpRight,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Brand, Onboarding } from "../pages/Public";
import { useAuth } from "../contexts/Auth";
import { useWorkspace } from "../contexts/Workspace";
import { supabase } from "../lib/supabase";
import { useRows } from "../lib/hooks";
import { Feedback, Loading } from "./UI";
import QuickNavigation from "./QuickNavigation";
import ThemeToggle from "./ThemeToggle";
import AccountMenu from "./AccountMenu";
const trainerLinks = [
  ["/app", "Visão geral", LayoutDashboard],
  ["/app/alunos", "Alunos", Users],
  ["/app/exercicios", "Exercícios", Dumbbell],
  ["/app/treinos", "Treinos", ClipboardList],
  ["/app/rotina", "Rotina semanal", CalendarDays],
  ["/app/modelos", "Modelos de treino", Layers],
  ["/app/avaliacoes", "Avaliações", Activity],
  ["/app/agenda", "Agenda", CalendarDays],
  ["/app/lembretes", "Lembretes", Bell],
  ["/app/mensagens", "Mensagens", MessageSquare],
  ["/app/financeiro", "Financeiro", Wallet],
  ["/app/relatorios", "Relatórios", ChartNoAxesCombined],
] as const;
const studentLinks = [
  ["/app", "Meu espaço", LayoutDashboard],
  ["/app/treinos", "Meus treinos", Dumbbell],
  ["/app/rotina", "Minha semana", CalendarDays],
  ["/app/evolucao", "Minha evolução", Activity],
  ["/app/checkin", "Check-in", ClipboardList],
  ["/app/agenda", "Meus horários", CalendarDays],
  ["/app/lembretes", "Lembretes", Bell],
  ["/app/mensagens", "Mensagens", MessageSquare],
  ["/app/financeiro", "Minhas cobranças", Wallet],
] as const;
export default function Layout() {
  const ctx = useWorkspace(),
    { user } = useAuth(),
    location = useLocation(),
    navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem("evolva-sidebar") === "collapsed"; } catch { return false; } });
  const notifications = useRows<any>(
    "evolva_notifications",
    {
      recipient_id: user?.id,
      workspace_id: ctx.access?.workspace.id,
      read_at: null,
    },
    "created_at",
    0,
    { columns: "id,read_at" },
  );
  const unread = notifications.rows.filter((n) => !n.read_at).length;
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  if (ctx.loading) return <Loading />;
  if (ctx.error)
    return (
      <main className="standalone">
        <section className="panel narrow">
          <Feedback error={ctx.error} />
          <button onClick={ctx.reload}>Tentar novamente</button>
          <button
            className="secondary"
            onClick={() => void supabase.auth.signOut()}
          >
            Sair
          </button>
        </section>
      </main>
    );
  if (!ctx.access)
    return <Onboarding />;
  const trainer = ctx.access?.role === "TRAINER",
    links = trainer ? trainerLinks : studentLinks;
  return (
    <div
      className={
        "application " +
        (ctx.access?.role === "STUDENT" ? "has-student-nav " : "") + (collapsed ? "sidebar-collapsed" : "")
      }
    >
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={"sidebar " + (open ? "is-open" : "")}>
        <Brand />
        <button
          className="sidebar-close icon"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
        >
          <X size={21} />
        </button>
        <div className="workspace-switch">
          <span className="tiny-label">SEU ESPAÇO</span>
          <div>
            <select
              aria-label="Selecionar acompanhamento"
              value={
                ctx.access
                  ? ctx.access.workspace.id + ":" + ctx.access.role
                  : ""
              }
              onChange={(e) => {
                ctx.select(e.target.value);
                navigate("/app");
              }}
            >
              {ctx.accesses.map((a) => (
                <option
                  key={a.workspace.id + ":" + a.role}
                  value={a.workspace.id + ":" + a.role}
                >
                  {a.workspace.name}
                  {a.role === "STUDENT" ? " · Aluno" : ""}
                </option>
              ))}
            </select>
            <ChevronDown size={15} />
          </div>
        </div>
        <nav>
          <span className="nav-label">
            {trainer ? "ACOMPANHAMENTO" : "SUA ROTINA"}
          </span>
          {ctx.access &&
            links.map(([to, label, Icon]) => (
              <NavLink to={to} end={to === "/app"} key={to} title={label}>
                <Icon size={19} />
                <span>{label}</span>
              </NavLink>
            ))}
          <span className="nav-label">MEU ESPAÇO</span>
          <NavLink to="/app/configuracoes">
            <Settings size={19} />
            Configurações
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">
            {(trainer
              ? ctx.access?.workspace.name
              : ctx.access?.studentName || user?.email
            )
              ?.slice(0, 1)
              .toUpperCase()}
          </span>
          <div>
            <strong>
              {trainer
                ? "Personal trainer"
                : ctx.access
                  ? "Aluno"
                  : "Administrador"}
            </strong>
            <small>{user?.email}</small>
          </div>
          <button
            className="icon"
            title="Sair"
            aria-label="Sair"
            onClick={() => void supabase.auth.signOut()}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <a href="#main-content" className="skip-link">
          Pular para o conteúdo
        </a>
        <header className="topbar">
          <div>
            <button className="icon secondary collapse-sidebar" aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"} onClick={()=>{setCollapsed(!collapsed);try{localStorage.setItem("evolva-sidebar",collapsed?"expanded":"collapsed");}catch{}}}>{collapsed?<PanelLeftOpen size={19}/>:<PanelLeftClose size={19}/>}</button>
            <button
              className="icon secondary mobile-menu"
              aria-label="Abrir menu"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb">
              Meu espaço <span>/</span>{" "}
              <strong>
                {({"/app/configuracoes":"Configurações","/app/notificacoes":"Notificações",} as Record<string,string>)[location.pathname] || [...links].filter(([path])=>path!=="/app"&&location.pathname.startsWith(path)).sort((a,b)=>b[0].length-a[0].length)[0]?.[1] || (trainer?"Visão geral":"Meu espaço")}
              </strong>
            </span>
          </div>
          <div className="topbar-actions">
            <QuickNavigation trainer={trainer} />
            <ThemeToggle />
            <button
              className="icon secondary"
              title="Atualizar dados"
              aria-label="Atualizar dados"
              onClick={() => window.dispatchEvent(new Event("evolva:changed"))}
            >
              <RefreshCw size={17} />
            </button>
            <Link
              className="notification-link"
              to="/app/notificacoes"
              aria-label="Notificações"
            >
              <Bell size={19} />
              {unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <AccountMenu email={user?.email} />
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="content"
          key={ctx.access?.workspace.id + ":" + ctx.access?.role}
        >
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>evolva. · Personal & Performance</span>
          <Link to="/app/configuracoes">
            Seu acompanhamento, conectado <ArrowUpRight size={12} />
          </Link>
        </footer>
        {ctx.access?.role === "STUDENT" && (
          <nav className="student-bottom-nav">
            <NavLink to="/app" end>
              <LayoutDashboard size={19} />
              Meu espaço
            </NavLink>
            <NavLink to="/app/treinos">
              <Dumbbell size={19} />
              Treinos
            </NavLink>
            <NavLink to="/app/mensagens">
              <MessageSquare size={19} />
              Mensagens
            </NavLink>
          </nav>
        )}
      </div>
    </div>
  );
}
