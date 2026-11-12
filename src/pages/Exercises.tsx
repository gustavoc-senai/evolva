import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { Dumbbell, Plus, Search, ExternalLink } from "lucide-react";
import { useWorkspace } from "../contexts/Workspace";
import { useRows } from "../lib/hooks";
import ExerciseEditor from "../components/ExerciseEditor";
import { videoUrl } from "../lib/utils";
import type { Exercise } from "../lib/types";
import ExerciseVideo from "../components/ExerciseVideo";
import { Heading, Feedback, Empty, Loading } from "../components/UI";
export default function Exercises() {
  const [params, setParams] = useSearchParams();
  const { access } = useWorkspace();
  const trainer = access?.role === "TRAINER";
  const { rows, loading, error } = useRows<Exercise>(
    "evolva_exercises",
    {},
    "name",
  );
  const [search, setSearch] = useState(""),
    [muscle, setMuscle] = useState(""),
    [source, setSource] = useState(""),
    [status, setStatus] = useState(""),
    [videoFilter, setVideoFilter] = useState(""),
    [message, setMessage] = useState(""),
    [edit, setEdit] = useState<Exercise | null | undefined>(undefined);
  function openEditor(exercise: Exercise | null) {
    setEdit(exercise);
    setMessage("");
  }
  const requestedEdit = params.get("editar");
  useEffect(() => {
    if (!requestedEdit || loading || !trainer) return;
    const exercise = rows.find((row) => row.id === requestedEdit);
    if (
      exercise &&
      (exercise.workspace_id === null ||
        exercise.workspace_id === access?.workspace.id)
    ) {
      const own = rows.find(
        (row) =>
          row.source_exercise_id === requestedEdit &&
          row.workspace_id === access?.workspace.id,
      );
      openEditor(own || exercise);
    }
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("editar");
        return next;
      },
      { replace: true },
    );
  }, [requestedEdit, loading, trainer, rows, access?.workspace.id, setParams]);
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const library = rows.filter(
    (e) =>
      (e.workspace_id === null || e.workspace_id === access?.workspace.id) &&
      !(
        e.workspace_id === null &&
        rows.some(
          (own) =>
            own.workspace_id === access?.workspace.id &&
            own.source_exercise_id === e.id,
        )
      ),
  );
  const visible = library.filter(
    (e) =>
      (e.workspace_id === null || e.workspace_id === access?.workspace.id) &&
      (!muscle || e.muscle_group === muscle) &&
      (!source ||
        (source === "own"
          ? e.workspace_id === access?.workspace.id
          : e.workspace_id === null)) &&
      (!status || e.active === (status === "active")) &&
      (!videoFilter ||
        Boolean(e.video_path || videoUrl(e.video_url)) ===
          (videoFilter === "with")) &&
      normalize(
        `${e.name} ${e.equipment} ${e.muscle_group} ${e.instructions || ""}`,
      ).includes(normalize(search.trim())),
  );
  return (
    <>
      <Heading
        title="Biblioteca de exercícios"
        description="Seu repertório, organizado para prescrever com clareza."
      >
        {trainer && (
          <button onClick={() => openEditor(null)}>
            <Plus size={17} />
            Novo exercício
          </button>
        )}
      </Heading>
      <Feedback error={error} message={message} />
      <div className="exercise-library-cover"><span>BIBLIOTECA / EXERCÍCIOS</span></div>
      <div className="library-summary">
        <span>
          <strong>{library.length}</strong> exercícios
        </span>
        <span>
          <strong>
            {
              library.filter((e) => e.workspace_id === access?.workspace.id)
                .length
            }
          </strong>{" "}
          próprios
        </span>
        <span>
          <strong>
            {
              library.filter((e) => e.video_path || videoUrl(e.video_url))
                .length
            }
          </strong>{" "}
          com vídeo
        </span>
      </div>
      <div className="filters">
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label="Buscar exercício"
            placeholder="Nome, equipamento ou orientação"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={muscle}
          aria-label="Grupo muscular"
          onChange={(e) => setMuscle(e.target.value)}
        >
          <option value="">Todos os grupos</option>
          {[...new Set(library.map((e) => e.muscle_group))].sort().map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select
          aria-label="Origem do exercício"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">Todas as origens</option>
          <option value="own">Meus exercícios</option>
          <option value="initial">Biblioteca inicial</option>
        </select>
        <select
          aria-label="Situação do exercício"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todas as situações</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
        <select
          aria-label="Vídeo de demonstração"
          value={videoFilter}
          onChange={(e) => setVideoFilter(e.target.value)}
        >
          <option value="">Com e sem vídeo</option>
          <option value="with">Com vídeo</option>
          <option value="without">Sem vídeo</option>
        </select>
        {(search || muscle || source || status || videoFilter) && (
          <button
            className="secondary small"
            onClick={() => {
              setSearch("");
              setMuscle("");
              setSource("");
              setStatus("");
              setVideoFilter("");
            }}
          >
            Limpar filtros
          </button>
        )}
      </div>
      {!loading && (
        <p className="muted small" role="status">
          {visible.length} de {library.length} exercícios encontrados
        </p>
      )}
      {loading ? (
        <Loading />
      ) : !visible.length ? (
        <Empty title="Nenhum exercício encontrado">
          Tente outro termo ou limpe os filtros para ampliar a busca.
        </Empty>
      ) : (
        <div className="exercise-grid">
          {visible.map((e) => (
            <article
              className={
                "panel exercise-card " + (!e.active ? "is-inactive" : "")
              }
              key={e.id}
            >
              <div className="exercise-art">
                <Dumbbell size={42} strokeWidth={1.3} />
                <span>{e.muscle_group}</span>
              </div>
              <div>
                <span className="eyebrow">
                  {e.equipment || "Exercício livre"}
                </span>
                <h2>{e.name}</h2>
                <p>
                  {e.instructions ||
                    "Orientações definidas pelo personal na prescrição."}
                </p>
                {e.video_path && (
                  <ExerciseVideo path={e.video_path} name={e.name} />
                )}
                <div className="actions">
                  <span className="badge">
                    {e.workspace_id
                      ? "Exercício próprio"
                      : "Biblioteca inicial"}
                  </span>
                  {!e.active && <span className="badge amber">Inativo</span>}
                  {e.video_url && videoUrl(e.video_url) && (
                    <a
                      href={videoUrl(e.video_url)!}
                      target="_blank"
                      rel="noreferrer"
                      className="button secondary small"
                    >
                      <ExternalLink size={14} />
                      Vídeo
                    </a>
                  )}
                  {trainer && (
                    <button
                      className="secondary small"
                      onClick={() => openEditor(e)}
                    >
                      Editar
                    </button>
                  )}
                  {trainer && e.workspace_id === access?.workspace.id && (
                    <button
                      className="secondary small"
                      onClick={() =>
                        openEditor({
                          ...e,
                          id: "",
                          video_path: null,
                          name: `${e.name} (cópia)`,
                        })
                      }
                    >
                      Duplicar
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {edit !== undefined && (
        <ExerciseEditor
          exercise={edit}
          onClose={() => setEdit(undefined)}
          onSaved={() =>
            setMessage(
              edit?.id ? "Exercício atualizado. As alterações já estão disponíveis no seu espaço." : "Exercício criado. Você já pode selecioná-lo ao montar um treino.",
            )
          }
        />
      )}
    </>
  );
}
