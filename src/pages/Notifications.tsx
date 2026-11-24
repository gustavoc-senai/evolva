import { Bell, CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/Auth";
import { useWorkspace } from "../contexts/Workspace";
import { useRows } from "../lib/hooks";
import { rpc } from "../lib/supabase";
import { date, errorText } from "../lib/utils";
import { Heading, Feedback, Empty, Loading } from "../components/UI";
import { useState } from "react";
export default function Notifications() {
  const { user } = useAuth(),
    { access } = useWorkspace();
  const data = useRows<any>("evolva_notifications", {
    recipient_id: user?.id,
    workspace_id: access?.workspace.id,
  });
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const unread = data.rows.filter((n) => !n.read_at);
  const visible = data.rows.filter(
    (n) =>
      filter === "all" ||
      (filter === "unread" ? !n.read_at : Boolean(n.read_at)),
  );
  async function mark(ids: string[]) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      for (const id of ids)
        await rpc("evolva_read_notification", { p_notification: id });
      setMessage(
        ids.length === 1
          ? "Notificação marcada como lida."
          : "Notificações marcadas como lidas.",
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="Notificações"
        description="Novas mensagens e atualizações do seu acompanhamento."
      >
        <button
          className="secondary"
          disabled={busy || data.loading || !unread.length}
          onClick={() => void mark(unread.map((n) => n.id))}
        >
          <CheckCheck size={17} />
          {busy ? "Marcando..." : "Marcar todas como lidas"}
        </button>
      </Heading>
      <Feedback error={data.error || error} message={message} />
      <div className="tabs" aria-label="Filtrar notificações">
        {[
          ["all", "Todas"],
          ["unread", `Não lidas (${unread.length})`],
          ["read", "Lidas"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={filter === key ? "active" : ""}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="panel">
        {data.loading ? (
          <Loading />
        ) : !visible.length ? (
          <Empty title="Você está em dia">
            {filter === "unread"
              ? "Nenhuma notificação pendente de leitura."
              : "As atualizações deste filtro aparecerão aqui."}
          </Empty>
        ) : (
          visible.map((n) => (
            <article
              key={n.id}
              className={"notification-row " + (!n.read_at ? "unread" : "")}
            >
              <span className="mini-icon">
                <Bell size={19} />
              </span>
              <div>
                <strong>{n.title}</strong>
                <p>{n.body}</p>
                <small>{date(n.created_at, true)}</small>
                <Link
                  to={
                    n.title === "Nova mensagem"
                      ? "/app/mensagens?aluno=" + n.student_id
                      : "/app/treinos"
                  }
                >
                  Abrir acompanhamento →
                </Link>
              </div>
              {!n.read_at && (
                <button
                  className="icon secondary"
                  aria-label="Marcar como lida"
                  disabled={busy}
                  onClick={() => void mark([n.id])}
                >
                  <CheckCheck size={17} />
                </button>
              )}
            </article>
          ))
        )}
      </section>
    </>
  );
}
