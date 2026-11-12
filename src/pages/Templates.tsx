import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Trash2 } from "lucide-react";
import { useWorkspace } from "../contexts/Workspace";
import { useRows } from "../lib/hooks";
import { rpc } from "../lib/supabase";
import { errorText, date } from "../lib/utils";
import { Heading, Feedback, Empty, Loading } from "../components/UI";

export default function Templates() {
  const { access } = useWorkspace();
  const data = useRows<any>("evolva_templates", {
    workspace_id: access?.workspace.id,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  return (
    <>
      <Heading
        title="Modelos de treino"
        description="Reutilize a estrutura de uma prescrição e adapte os detalhes para cada aluno."
      >
        <Link className="button" to="/app/treinos">
          Criar a partir de um treino
        </Link>
      </Heading>
      <Feedback error={data.error || error} />
      <p className="notice">
        Nos seus treinos, use “Salvar como modelo”. O modelo guarda exercícios e
        orientações, sem vincular os dados pessoais do aluno. Ao usar, revise a
        prescrição antes de publicar.
      </p>
      {data.loading ? (
        <Loading />
      ) : !data.rows.length ? (
        <Empty title="Seu método pode virar um modelo">
          Salve a estrutura de um treino existente para começar.
        </Empty>
      ) : (
        <div className="workout-grid">
          {data.rows.map((template) => (
            <article className="panel workout-card" key={template.id}>
              <span className="mini-icon">
                <Copy size={22} />
              </span>
              <h2>{template.title}</h2>
              <p>
                {template.notes ||
                  "Modelo pronto para adaptar ao acompanhamento."}
              </p>
              <small className="muted">
                {template.items.length} exercícios · {date(template.created_at)}
              </small>
              <div className="actions">
                <Link
                  className="button"
                  to={`/app/treinos/novo?modelo=${template.id}`}
                >
                  Usar modelo
                </Link>
                <button
                  className="secondary small"
                  disabled={Boolean(busy)}
                  onClick={async () => {
                    if (
                      !confirm(
                        "Excluir este modelo? Os treinos já criados serão preservados.",
                      )
                    )
                      return;
                    setBusy(template.id);
                    setError("");
                    try {
                      await rpc("evolva_delete_template", {
                        p_template: template.id,
                      });
                    } catch (e) {
                      setError(errorText(e));
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  <Trash2 size={15} />
                  Excluir
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
