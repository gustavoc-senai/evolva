import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MessageSquare, Send, RefreshCw } from "lucide-react";
import { useAuth } from "../contexts/Auth";
import { useWorkspace } from "../contexts/Workspace";
import { useRows } from "../lib/hooks";
import { rpc } from "../lib/supabase";
import { date, errorText } from "../lib/utils";
import { Heading, Feedback, Empty } from "../components/UI";
export default function Messages() {
  const { access } = useWorkspace(),
    { user } = useAuth(),
    [params] = useSearchParams();
  const trainer = access?.role === "TRAINER";
  const students = useRows<any>("evolva_students", {
    workspace_id: access?.workspace.id,
  });
  const [chosen, setChosen] = useState(params.get("aluno") || ""),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const studentId = trainer
    ? chosen || students.rows.find((s) => s.active)?.id
    : access?.studentId;
  const messages = useRows<any>(
    "evolva_messages",
    { student_id: studentId || "00000000-0000-0000-0000-000000000000" },
    "created_at",
    refresh,
  );
  const request = useRef({ signature: "", id: "" }),
    bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.rows]);
  useEffect(() => {
    setBody("");
    setError("");
  }, [studentId]);
  useEffect(() => {
    const timer = setInterval(() => setRefresh((v) => v + 1), 15000);
    return () => clearInterval(timer);
  }, []);
  const selected = students.rows.find((s) => s.id === studentId);
  return (
    <>
      <Heading
        title="Conversas do acompanhamento"
        description="Orientações e dúvidas com o contexto de cada aluno."
      />
      <Feedback error={error || messages.error || students.error} />
      <div className="messages-layout">
        {trainer && (
          <aside className="panel conversations">
            <h2>Alunos</h2>
            {students.rows
              .filter((s) => s.active)
              .map((s) => (
                <button
                  className={s.id === studentId ? "active" : ""}
                  key={s.id}
                  onClick={() => setChosen(s.id)}
                >
                  <span className="avatar pastel">{s.name[0]}</span>
                  <span>
                    <strong>{s.name}</strong>
                    <small>
                      {s.account_id ? "Acesso vinculado" : "Aguardando vínculo"}
                    </small>
                  </span>
                </button>
              ))}
          </aside>
        )}
        <section className="panel conversation">
          <div className="panel-heading">
            <div>
              <h2>
                {trainer
                  ? selected?.name || "Escolha um aluno"
                  : access?.workspace.name}
              </h2>
              <small className="muted">
                Mensagens do acompanhamento · atualização a cada 15 segundos
              </small>
            </div>
            <button
              className="icon secondary"
              aria-label="Atualizar conversa"
              onClick={() => setRefresh((v) => v + 1)}
            >
              <RefreshCw size={17} />
            </button>
          </div>
          <div className="message-thread">
            {!messages.rows.length && (
              <Empty title="Uma conversa aproxima o acompanhamento">
                Envie sua primeira mensagem.
              </Empty>
            )}
            {[...messages.rows].reverse().map((m) => (
              <article
                className={
                  "message " + (m.author_id === user?.id ? "mine" : "")
                }
                key={m.id}
              >
                <p>{m.body}</p>
                <small>
                  {m.author_id === user?.id ? "Você · " : ""}
                  {date(m.created_at, true)}
                </small>
              </article>
            ))}
            <div ref={bottom} />
          </div>
          <form
            className="message-compose"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || !body.trim() || !studentId) return;
              setBusy(true);
              setError("");
              const signature = studentId + ":" + body.trim();
              if (request.current.signature !== signature)
                request.current = { signature, id: crypto.randomUUID() };
              try {
                await rpc("evolva_send_message", {
                  p_student: studentId,
                  p_body: body.trim(),
                  p_request: request.current.id,
                });
                setBody("");
                request.current = { signature: "", id: "" };
              } catch (err) {
                setError(errorText(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <textarea
              aria-label="Mensagem"
              required
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escreva sua mensagem..."
              disabled={!studentId || busy}
            />
            <button disabled={busy || !studentId || !body.trim()}>
              <Send size={18} />
              <span>Enviar</span>
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
