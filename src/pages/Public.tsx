import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Activity,
  Dumbbell,
  ChartNoAxesCombined,
  Users,
  ShieldCheck,
  CalendarDays,
  Check,
  Flame,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "../contexts/Auth";
import { useWorkspace } from "../contexts/Workspace";
import { supabase, configured, rpc } from "../lib/supabase";
import { safeNext, errorText } from "../lib/utils";
import { ActionForm, Field, Feedback, Loading, value } from "../components/UI";
import ThemeToggle from "../components/ThemeToggle";
export function Brand() {
  return (
    <Link to="/" className="brand">
      <span className="brand-mark">
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h15l-3 4H8l-2 3h9l-3 4H4l-2 3h13" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="miter" /></svg>
      </span>
      evolva<span className="brand-dot">.</span>
    </Link>
  );
}
export { default as Landing } from "./Landing";
export function AuthPage({ register = false }: { register?: boolean }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next")),
    query = next !== "/app" ? "?next=" + encodeURIComponent(next) : "";
  const [visible, setVisible] = useState(false);
  if (loading) return <Loading />;
  if (user) return <Navigate to={next} replace />;
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">SUA ROTINA MERECE EVOLUIR</span>
          <h1>
            Performance começa
            <br />
            com <em>conexão.</em>
          </h1>
          <p>
            Um espaço para prescrever com clareza, acompanhar com atenção e
            celebrar a evolução.
          </p>
        </div>
        <small>Profissionais e alunos, no mesmo caminho.</small>
      </section>
      <main className="auth-panel">
        <div className="auth-theme"><ThemeToggle /></div>
        <Link className="back-link" to="/">
          ← Voltar ao site
        </Link>
        <span className="eyebrow">BEM-VINDO AO EVOLVA</span>
        <h1>{register ? "Crie sua conta" : "Bom ter você de volta."}</h1>
        <p>
          {register
            ? "Use seu e-mail e uma senha pessoal."
            : "Entre para continuar seu acompanhamento."}
        </p>
        {!configured && (
          <Feedback error="Configure a URL e a chave pública no .env para conectar sua conta." />
        )}
        <ActionForm
          label={register ? "Criar conta" : "Entrar no meu espaço"}
          onSubmit={async (d) => {
            if (!configured)
              throw Error("Conecte o Supabase antes de continuar.");
            const password = String(d.get("password") ?? "");
            if (register && password.length < 8)
              throw Error("Use uma senha de pelo menos 8 caracteres.");
            if (register && password !== String(d.get("confirm") ?? ""))
              throw Error("As senhas não coincidem.");
            const { data, error } = register
              ? await supabase.auth.signUp({
                  email: value(d, "email"),
                  password,
                })
              : await supabase.auth.signInWithPassword({
                  email: value(d, "email"),
                  password,
                });
            if (error) {
              if (error.code === "invalid_credentials")
                throw Error("E-mail ou senha incorretos.");
              throw error;
            }
            if (register && !data.session)
              throw Error(
                "Conta criada sem sessão. Para cadastro sem confirmação, desative Confirm email no Supabase; esta conta pode precisar ser confirmada pelo administrador.",
              );
          }}
        >
          <Field name="email" label="Seu e-mail" type="email" required />
          <div className="password-field">
            <Field
              name="password"
              label="Senha"
              type={visible ? "text" : "password"}
              min={undefined}
              required
            />
            <button
              className="icon secondary"
              type="button"
              aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {register && (
            <Field
              name="confirm"
              label="Confirmar senha"
              type={visible ? "text" : "password"}
              required
            />
          )}
          {register && (
            <small>Use uma senha com pelo menos 8 caracteres.</small>
          )}
        </ActionForm>
        {!register && (
          <Link to="/recuperar-senha" className="auth-link">
            Esqueci minha senha
          </Link>
        )}
        <div className="auth-bottom">
          {register ? "Já tem uma conta?" : "Primeira vez por aqui?"}{" "}
          <Link to={(register ? "/login" : "/cadastro") + query}>
            {register ? "Entrar" : "Criar conta"}
          </Link>
        </div>
      </main>
    </div>
  );
}
export function PasswordPage({ reset = false }: { reset?: boolean }) {
  const { user, clearRecovery } = useAuth();
  const [done, setDone] = useState(false);
  return (
    <main className="standalone">
      <section className="panel narrow">
        <Brand />
        <h1>{reset ? "Defina sua nova senha" : "Recuperar acesso"}</h1>
        <p>
          {reset
            ? "Escolha uma senha pessoal e segura."
            : "Enviaremos um link se houver uma conta com este e-mail."}
        </p>
        <ActionForm
          label={reset ? "Atualizar senha" : "Enviar link"}
          onSubmit={async (d) => {
            if (!configured) throw Error("Conecte o Supabase.");
            if (reset) {
              if (!user)
                throw Error("Abra o link de recuperação enviado por e-mail.");
              if (
                value(d, "password").length < 8 ||
                value(d, "password") !== value(d, "confirm")
              )
                throw Error(
                  "Use pelo menos 8 caracteres e confirme a mesma senha.",
                );
              const { error } = await supabase.auth.updateUser({
                password: value(d, "password"),
              });
              if (error) throw error;
              clearRecovery();
            } else {
              const { error } = await supabase.auth.resetPasswordForEmail(
                value(d, "email"),
                { redirectTo: window.location.origin + "/atualizar-senha" },
              );
              if (error) throw error;
            }
            setDone(true);
          }}
        >
          {reset ? (
            <>
              <Field
                name="password"
                label="Nova senha"
                type="password"
                required
              />
              <Field
                name="confirm"
                label="Confirmar nova senha"
                type="password"
                required
              />
            </>
          ) : (
            <Field name="email" label="E-mail" type="email" required />
          )}
        </ActionForm>
        {done && (
          <p className="feedback success">
            {reset
              ? "Senha atualizada."
              : "Se houver uma conta, você receberá as instruções."}
          </p>
        )}
        <Link to={reset ? "/app" : "/login"}>Continuar →</Link>
      </section>
    </main>
  );
}
export function InvitationPage() {
  const { token } = useParams();
  const { user, loading } = useAuth(),
    ctx = useWorkspace(),
    navigate = useNavigate();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const next = encodeURIComponent("/convite/" + token);
  return (
    <main className="standalone">
      <section className="panel narrow">
        <Brand />
        <span className="eyebrow">SEU ACOMPANHAMENTO COMEÇA AQUI</span>
        <h1>Um convite para evoluir.</h1>
        <p>
          Use o mesmo e-mail cadastrado pelo seu personal para aceitar o
          convite.
        </p>
        <Feedback error={error} />
        {!token || !/^[a-f0-9-]{36}$/i.test(token) ? (
          <p className="error">Convite inválido.</p>
        ) : loading ? (
          <Loading />
        ) : !user ? (
          <div className="actions">
            <Link className="button" to={"/login?next=" + next}>
              Entrar
            </Link>
            <Link className="button secondary" to={"/cadastro?next=" + next}>
              Criar conta
            </Link>
          </div>
        ) : (
          <>
            <p>Conta atual: {user.email}</p>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await rpc("evolva_accept_invitation", { p_token: token });
                  ctx.reload();
                  navigate("/app");
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Aceitar convite
            </button>
            <button
              className="secondary"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/login?next=" + next);
              }}
            >
              Entrar com outra conta
            </button>
          </>
        )}
      </section>
    </main>
  );
}
export function Onboarding() {
  const ctx = useWorkspace();
  const navigate = useNavigate();
  return (
    <main className="standalone">
      <section className="panel onboarding">
        <Brand />
        <span className="eyebrow">VAMOS COMEÇAR</span>
        <h1>Seu próximo capítulo.</h1>
        <p>
          Crie seu espaço de personal trainer ou entre pelo convite do
          profissional que acompanha você.
        </p>
        <div className="two-col">
          <section>
            <h2>Sou personal trainer</h2>
            <ActionForm
              label="Criar meu espaço"
              onSubmit={(d) =>
                rpc("evolva_create_workspace", { p_name: value(d, "name") })
              }
              onSuccess={ctx.reload}
            >
              <Field
                name="name"
                label="Nome do seu espaço"
                placeholder="Seu nome ou nome do negócio"
                required
              />
            </ActionForm>
          </section>
          <section>
            <h2>Sou aluno</h2>
            <ActionForm
              label="Abrir convite"
              onSubmit={async (d) => {
                const raw = value(d, "token");
                const token = raw.split("/").filter(Boolean).at(-1);
                if (!/^[a-f0-9-]{36}$/i.test(token ?? ""))
                  throw Error("Cole o código ou o link recebido.");
                navigate("/convite/" + token);
              }}
            >
              <Field name="token" label="Link ou código do convite" required />
            </ActionForm>
          </section>
        </div>
        <button
          className="secondary"
          onClick={() => void supabase.auth.signOut()}
        >
          Sair da conta
        </button>
      </section>
    </main>
  );
}
