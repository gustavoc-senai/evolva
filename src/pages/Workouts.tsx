import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Plus,
  Dumbbell,
  ArrowUpRight,
  Copy,
  Archive,
  ArrowUp,
  ArrowDown,
  Trash2,
  Save,
  Send,
} from "lucide-react";
import { useWorkspace } from "../contexts/Workspace";
import { useAuth } from "../contexts/Auth";
import { readWorkoutDraft } from "../lib/workoutDraft";
import type { DraftItem, WorkoutDraft } from "../lib/workoutDraft";
import ExerciseEditor from "../components/ExerciseEditor";
import { useRows } from "../lib/hooks";
import { rpc } from "../lib/supabase";
import { date, statusLabel, errorText } from "../lib/utils";
import ExerciseVideo from "../components/ExerciseVideo";
import type { Student, Exercise, Workout, WorkoutItem } from "../lib/types";
import {
  Heading,
  Feedback,
  Loading,
  Empty,
  ActionForm,
  Field,
  value,
  Modal,
} from "../components/UI";
export default function Workouts() {
  const { access } = useWorkspace();
  const trainer = access?.role === "TRAINER";
  const [params] = useSearchParams();
  const [student, setStudent] = useState(params.get("aluno") || ""),
    [status, setStatus] = useState(trainer ? "" : "PUBLISHED"),
    [error, setError] = useState("");
  const [templateWorkout, setTemplateWorkout] = useState<Workout | null>(null);
  const [message, setMessage] = useState("");
  const rows = useRows<Workout>(
    "evolva_workouts",
    trainer
      ? { workspace_id: access?.workspace.id }
      : { student_id: access?.studentId },
  );
  const students = useRows<Student>("evolva_students", {
    workspace_id: access?.workspace.id,
  });
  const items = useRows<WorkoutItem>("evolva_workout_items", {}, "position");
  const visible = rows.rows.filter(
    (w) =>
      (!student || w.student_id === student) &&
      (!status || w.status === status),
  );
  return (
    <>
      <Heading
        title={trainer ? "Treinos e prescrições" : "Seus treinos"}
        description={
          trainer
            ? "Seu método em cada exercício. Publique quando estiver pronto."
            : "A prescrição que seu personal preparou para você."
        }
      >
        {trainer && (
          <Link className="button secondary" to="/app/modelos">
            <Copy size={17} />
            Modelos de treino
          </Link>
        )}
        {trainer && (
          <Link
            className="button"
            to={"/app/treinos/novo" + (student ? "?aluno=" + student : "")}
          >
            <Plus size={17} />
            Nova prescrição
          </Link>
        )}
      </Heading>
      <Feedback
        error={rows.error || students.error || items.error || error}
        message={message}
      />
      <div className="filters">
        {trainer && (
          <select
            aria-label="Filtrar por aluno"
            value={student}
            onChange={(e) => setStudent(e.target.value)}
          >
            <option value="">Todos os alunos</option>
            {students.rows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Status do treino"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          {(trainer ? ["DRAFT", "PUBLISHED", "ARCHIVED"] : ["PUBLISHED"]).map(
            (s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ),
          )}
        </select>
      </div>
      {rows.loading ? (
        <Loading />
      ) : !visible.length ? (
        <Empty
          title={
            trainer
              ? "Seu próximo treino começa aqui"
              : "Seu personal está preparando o acompanhamento"
          }
        >
          {trainer
            ? "Escolha o aluno e monte a prescrição."
            : "Os treinos publicados aparecerão nesta área."}
        </Empty>
      ) : (
        <div className="workout-grid">
          {visible.map((w) => (
            <article className="panel workout-card" key={w.id}>
              <div className="workout-card-top">
                <span className="mini-icon">
                  <Dumbbell size={24} />
                </span>
                <span
                  className={
                    "badge " +
                    (w.status === "PUBLISHED"
                      ? "green"
                      : w.status === "DRAFT"
                        ? "amber"
                        : "gray")
                  }
                >
                  {statusLabel(w.status)}
                </span>
              </div>
              <span className="eyebrow">
                {students.rows.find((s) => s.id === w.student_id)?.name ||
                  "Seu acompanhamento"}
              </span>
              <h2>{w.title}</h2>
              <p>
                {w.notes ||
                  "Consulte os exercícios e orientações deste treino."}
              </p>
              <div className="workout-meta">
                <span>
                  {items.rows.filter((i) => i.workout_id === w.id).length}{" "}
                  exercícios
                </span>
                <span>{date(w.created_at)}</span>
              </div>
              <Link className="button" to={"/app/treinos/" + w.id}>
                {trainer ? "Abrir prescrição" : "Ver treino"}
                <ArrowUpRight size={16} />
              </Link>
              {trainer && (
                <div className="actions">
                  <button
                    className="secondary small"
                    onClick={() => setTemplateWorkout(w)}
                  >
                    Salvar como modelo
                  </button>
                  <Link
                    className="button secondary small"
                    to={"/app/treinos/novo?copiar=" + w.id}
                  >
                    <Copy size={14} />
                    Duplicar
                  </Link>
                  {w.status === "DRAFT" && (
                    <Link
                      className="button secondary small"
                      to={"/app/treinos/novo?editar=" + w.id}
                    >
                      Editar
                    </Link>
                  )}
                  {w.status !== "ARCHIVED" && (
                    <button
                      className="secondary small"
                      onClick={async () => {
                        if (
                          !confirm(
                            "Arquivar este treino? Ele deixa de aparecer para o aluno.",
                          )
                        )
                          return;
                        try {
                          await rpc("evolva_workout_status", {
                            p_workout: w.id,
                            p_status: "ARCHIVED",
                          });
                        } catch (e) {
                          setError(errorText(e));
                        }
                      }}
                    >
                      <Archive size={14} />
                      Arquivar
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {templateWorkout && (
        <Modal
          title="Salvar modelo de treino"
          onClose={() => setTemplateWorkout(null)}
        >
          <ActionForm
            label="Salvar modelo"
            onSuccess={() => {
              setTemplateWorkout(null);
              setMessage(
                "Modelo salvo. Abra Modelos de treino para reutilizá-lo com outro aluno.",
              );
            }}
            onSubmit={(d) =>
              rpc("evolva_create_template", {
                p_workout: templateWorkout.id,
                p_title: value(d, "title"),
              })
            }
          >
            <Field
              label="Nome do modelo"
              name="title"
              value={templateWorkout.title}
              required
              max={150}
            />
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
export function WorkoutBuilder() {
  const { user } = useAuth();
  const { access } = useWorkspace();
  const [params] = useSearchParams();
  const draftKey = `evolva-workout-draft:${user?.id || "local"}:${access?.workspace.id}:${params.get("editar") ? "edit:" + params.get("editar") : params.get("copiar") ? "copy:" + params.get("copiar") : params.get("modelo") ? "template:" + params.get("modelo") : "new"}:${params.get("aluno") || ""}`;
  return <WorkoutBuilderEditor key={draftKey} draftKey={draftKey} />;
}
function WorkoutBuilderEditor({ draftKey }: { draftKey: string }) {
  const { access } = useWorkspace();
  const [params] = useSearchParams(),
    navigate = useNavigate();
  const source = params.get("copiar") || params.get("editar");
  const templateId = params.get("modelo");
  const template = useRows<any>(
    "evolva_templates",
    {
      id: templateId || "00000000-0000-0000-0000-000000000000",
    },
    "created_at",
    0,
    { enabled: Boolean(templateId) },
  );
  const { rows: students } = useRows<Student>("evolva_students", {
    workspace_id: access?.workspace.id,
  });
  const { rows: exercises } = useRows<Exercise>("evolva_exercises", {}, "name");
  const [cached] = useState(() => readWorkoutDraft(draftKey));
  const [fields, setFields] = useState(
    cached?.fields || { student: "", title: "", notes: "" },
  );
  const [items, setItems] = useState<DraftItem[]>(cached?.items || []),
    [selected, setSelected] = useState(""),
    [loaded, setLoaded] = useState(Boolean(cached)),
    [error, setError] = useState(""),
    [search, setSearch] = useState("");
  const requests = useRef(cached?.request || { signature: "", id: "" });
  const completed = useRef(false);
  const [draftStatus, setDraftStatus] = useState(
    cached ? "Rascunho local restaurado. Revise antes de publicar." : "",
  );
  const [draftError, setDraftError] = useState("");
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  function persistDraft() {
    if (!loaded || completed.current) return;
    const data: WorkoutDraft = {
      version: 1,
      updatedAt: new Date().toISOString(),
      fields,
      items,
      request: requests.current,
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(data));
      setDraftStatus(
        `Salvo neste navegador às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`,
      );
      setDraftError("");
    } catch {
      setDraftError(
        "Não foi possível salvar o rascunho neste navegador. Salve a prescrição antes de sair.",
      );
    }
  }
  useEffect(() => {
    persistDraft();
  }, [loaded, fields, items, draftKey]);
  useEffect(() => {
    if (!draftError) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draftError]);
  useEffect(() => {
    const replacement = exercises.find(
      (exercise) =>
        exercise.source_exercise_id === selected &&
        exercise.workspace_id === access?.workspace.id,
    );
    if (replacement) setSelected(replacement.id);
  }, [exercises, selected, access?.workspace.id]);
  const sourceWorkout = useRows<Workout>(
    "evolva_workouts",
    source ? { id: source } : { id: "00000000-0000-0000-0000-000000000000" },
    "created_at",
    0,
    { enabled: Boolean(source) },
  );
  const sourceItems = useRows<WorkoutItem>(
    "evolva_workout_items",
    source
      ? { workout_id: source }
      : { workout_id: "00000000-0000-0000-0000-000000000000" },
    "position",
    0,
    { enabled: Boolean(source) },
  );
  useEffect(() => {
    if (loaded) return;
    if (
      source &&
      (sourceItems.loading ||
        sourceWorkout.loading ||
        sourceItems.error ||
        sourceWorkout.error)
    )
      return;
    if (templateId && (template.loading || template.error)) return;
    const workout = sourceWorkout.rows[0];
    const model = template.rows[0];
    setFields({
      student: workout?.student_id || params.get("aluno") || "",
      title: workout
        ? workout.title + (params.get("copiar") ? " · nova versão" : "")
        : model?.title || "",
      notes: workout?.notes || model?.notes || "",
    });
    setItems(
      source
        ? [...sourceItems.rows]
            .sort((a, b) => a.position - b.position)
            .map((i) => ({
              exercise_id: i.exercise_id,
              sets: i.sets,
              repetitions: i.repetitions,
              rest_seconds: i.rest_seconds,
              notes: i.notes || "",
            }))
        : (model?.items || []).map((item: DraftItem) => ({
            ...item,
            notes: item.notes || "",
          })),
    );
    setLoaded(true);
  }, [
    loaded,
    source,
    templateId,
    sourceItems.loading,
    sourceItems.error,
    sourceItems.rows,
    sourceWorkout.loading,
    sourceWorkout.error,
    sourceWorkout.rows,
    template.loading,
    template.error,
    template.rows,
    params,
  ]);
  function patch(index: number, key: keyof DraftItem, v: any) {
    setItems((old) =>
      old.map((i, n) => (n === index ? { ...i, [key]: v } : i)),
    );
  }
  return (
    <>
      <Heading
        title={params.get("editar") ? "Editar rascunho" : "Montar prescrição"}
        description="Você define a prescrição. O aluno recebe somente o que for publicado."
      >
        <Link className="button secondary" to="/app/treinos">
          Voltar aos treinos
        </Link>
        <button className="secondary" type="button" onClick={() => {
          if (!confirm("Descartar as alterações locais e recomeçar? As prescrições já salvas no servidor serão preservadas.")) return;
          try { localStorage.removeItem(draftKey); } catch {}
          requests.current = { signature: "", id: "" };
          setFields({ student: "", title: "", notes: "" }); setItems([]); setLoaded(false); setDraftStatus("");
        }}>Descartar alterações locais</button>
      </Heading>
      <Feedback
        error={
          error || sourceWorkout.error || sourceItems.error || template.error
        }
      />
      {templateId && !template.loading && !template.rows.length && (
        <Feedback error="Modelo não encontrado ou indisponível neste espaço." />
      )}
      <div className="draft-status" role="status">
        {draftStatus || "Preparando rascunho..."}
        <span>
          O rascunho é local e ainda não está disponível para o aluno.
        </span>
      </div>
      <Feedback error={draftError} />
      {!loaded ? (
        <Loading />
      ) : (
        <ActionForm
          label="Salvar prescrição"
          onSubmit={async (d) => {
            if (!items.length) throw Error("Adicione pelo menos um exercício.");
            const args = {
              p_student: value(d, "student"),
              p_workout: params.get("editar") || null,
              p_title: value(d, "title"),
              p_notes: value(d, "notes") || null,
              p_items: items,
              p_publish: value(d, "publish") === "yes",
            };
            const signature = JSON.stringify(args);
            if (requests.current.signature !== signature)
              requests.current = { signature, id: crypto.randomUUID() };
            persistDraft();
            const id = await rpc("evolva_save_workout", {
              ...args,
              p_request: requests.current.id,
            });
            completed.current = true;
            try {
              localStorage.removeItem(draftKey);
            } catch {}
            navigate("/app/treinos/" + id);
          }}
        >
          <div className="builder-layout">
            <section>
              <div className="panel">
                <h2>Dados do treino</h2>
                <div className="form-grid">
                  <Field
                    label="Aluno"
                    name="student"
                    value={fields.student}
                    onChange={(student) =>
                      setFields((old) => ({ ...old, student }))
                    }
                    required
                  >
                    <option value="">Selecione o aluno</option>
                    {students
                      .filter((s) => s.active)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </Field>
                  <Field
                    label="Nome do treino"
                    name="title"
                    value={fields.title}
                    onChange={(title) =>
                      setFields((old) => ({ ...old, title }))
                    }
                    placeholder="Ex.: Treino A · Superiores"
                    required
                  />
                </div>
                <Field
                  name="notes"
                  label="Orientações gerais para o aluno"
                  type="textarea"
                  value={fields.notes}
                  onChange={(notes) => setFields((old) => ({ ...old, notes }))}
                />
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Exercícios da prescrição</h2>
                  <span className="badge">{items.length}/50</span>
                </div>
                {!items.length && (
                  <Empty title="Escolha o primeiro exercício">
                    Use a biblioteca ao lado para montar a sequência.
                  </Empty>
                )}
                {items.map((i, index) => (
                  <article className="builder-item" key={index}>
                    <div className="panel-heading">
                      <h3>
                        <span className="sequence-number">{index + 1}</span>
                        {exercises.find((e) => e.id === i.exercise_id)?.name ||
                          "Exercício"}
                      </h3>
                      <div className="actions">
                        <button
                          type="button"
                          className="secondary small"
                          onClick={() =>
                            setEditingExercise(
                              exercises.find(
                                (exercise) => exercise.id === i.exercise_id,
                              ) || null,
                            )
                          }
                        >
                          Editar exercício
                        </button>
                        <button
                          type="button"
                          className="icon secondary"
                          aria-label="Mover exercício para cima"
                          disabled={index === 0}
                          onClick={() =>
                            setItems((old) => {
                              const next = [...old];
                              [next[index - 1], next[index]] = [
                                next[index],
                                next[index - 1],
                              ];
                              return next;
                            })
                          }
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon secondary"
                          aria-label="Mover exercício para baixo"
                          disabled={index === items.length - 1}
                          onClick={() =>
                            setItems((old) => {
                              const next = [...old];
                              [next[index + 1], next[index]] = [
                                next[index],
                                next[index + 1],
                              ];
                              return next;
                            })
                          }
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon secondary"
                          aria-label="Remover exercício"
                          onClick={() =>
                            setItems((old) => old.filter((_, n) => n !== index))
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    <div className="form-grid three">
                      <label>
                        Séries
                        <input
                          required
                          type="number"
                          min={1}
                          max={20}
                          value={i.sets}
                          onChange={(e) =>
                            patch(index, "sets", Number(e.target.value))
                          }
                        />
                      </label>
                      <label>
                        Repetições / duração
                        <input
                          required
                          maxLength={50}
                          value={i.repetitions}
                          placeholder="Defina a prescrição"
                          onChange={(e) =>
                            patch(index, "repetitions", e.target.value)
                          }
                        />
                      </label>
                      <label>
                        Descanso (segundos)
                        <input
                          required
                          type="number"
                          min={0}
                          max={1800}
                          value={i.rest_seconds}
                          onChange={(e) =>
                            patch(index, "rest_seconds", Number(e.target.value))
                          }
                        />
                      </label>
                    </div>
                    <label>
                      Orientação específica
                      <input
                        maxLength={500}
                        value={i.notes}
                        onChange={(e) => patch(index, "notes", e.target.value)}
                      />
                    </label>
                  </article>
                ))}
              </section>
            </section>
            <aside className="builder-side">
              <section className="panel">
                <span className="eyebrow">SEU REPERTÓRIO</span>
                <h2>Adicionar exercícios</h2>
                <input
                  aria-label="Buscar na biblioteca"
                  placeholder="Buscar exercício..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="Escolher exercício"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {exercises
                    .filter(
                      (e) =>
                        e.active &&
                        !(
                          e.workspace_id === null &&
                          exercises.some(
                            (own) =>
                              own.workspace_id === access?.workspace.id &&
                              own.source_exercise_id === e.id,
                          )
                        ) &&
                        (e.workspace_id === null ||
                          e.workspace_id === access?.workspace.id) &&
                        e.name.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} · {e.muscle_group}
                      </option>
                    ))}
                </select>
                {selected && (
                  <div className="selected-exercise-preview">
                    <p className="muted small">
                      {exercises.find((e) => e.id === selected)?.instructions ||
                        "Sem orientações cadastradas."}
                    </p>
                    <ExerciseVideo
                      url={exercises.find((e) => e.id === selected)?.video_url}
                      path={
                        exercises.find((e) => e.id === selected)?.video_path
                      }
                      name={
                        exercises.find((e) => e.id === selected)?.name ||
                        "Exercício"
                      }
                    />
                    <button
                      type="button"
                      className="secondary small"
                      onClick={() =>
                        setEditingExercise(
                          exercises.find(
                            (exercise) => exercise.id === selected,
                          ) || null,
                        )
                      }
                    >
                      Editar exercício e vídeo
                    </button>
                    <p className="muted small">
                      Altere o exercício sem sair da prescrição. Seu rascunho é
                      preservado.
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  className="secondary"
                  disabled={!selected || items.length >= 50}
                  onClick={() => {
                    setItems([
                      ...items,
                      {
                        exercise_id: selected,
                        sets: 1,
                        repetitions: "",
                        rest_seconds: 0,
                        notes: "",
                      },
                    ]);
                    setSelected("");
                  }}
                >
                  <Plus size={16} />
                  Adicionar à sequência
                </button>
                <p className="muted small">
                  Séries, repetições e descanso devem ser definidos por você
                  para este aluno.
                </p>
              </section>
              <section className="panel">
                <h2>Pronto para compartilhar?</h2>
                <Field name="publish" label="Ao salvar" value="no">
                  <option value="no">Manter como rascunho</option>
                  <option value="yes">Publicar para o aluno</option>
                </Field>
                <p className="muted small">
                  Treinos publicados preservam o histórico. Para mudar a
                  prescrição, duplique e publique uma nova versão.
                </p>
              </section>
            </aside>
          </div>
        </ActionForm>
      )}
      {editingExercise && (
        <ExerciseEditor
          exercise={editingExercise}
          onClose={() => setEditingExercise(null)}
          onSaved={(id) => {
            if (selected === editingExercise.id) setSelected(id);
            setItems((old) =>
              old.map((item) =>
                item.exercise_id === editingExercise.id
                  ? { ...item, exercise_id: id }
                  : item,
              ),
            );
          }}
        />
      )}
    </>
  );
}
export function WorkoutDetail() {
  const { id } = useParams(),
    { access } = useWorkspace();
  const trainer = access?.role === "TRAINER";
  const workout = useRows<Workout>("evolva_workouts", { id });
  const items = useRows<WorkoutItem>(
      "evolva_workout_items",
      { workout_id: id },
      "position",
    ),
    exercises = useRows<Exercise>("evolva_exercises", {}, "name");
  const w = workout.rows[0];
  if (workout.loading) return <Loading />;
  if (!w)
    return (
      <>
        <Feedback error={workout.error} />
        <Empty title="Treino indisponível" />
      </>
    );
  return (
    <>
      <Heading
        title={w.title}
        description={
          trainer
            ? "Detalhes da prescrição e orientações para o aluno."
            : "Consulte as orientações antes de registrar sua sessão."
        }
      >
        <Link className="button secondary" to="/app/treinos">
          Voltar
        </Link>
        {trainer ? (
          <Link className="button" to={"/app/treinos/novo?copiar=" + w.id}>
            <Copy size={16} />
            Nova versão
          </Link>
        ) : w.status === "PUBLISHED" ? (
          <Link className="button" to={"/app/treinos/" + w.id + "/executar"}>
            <Dumbbell size={17} />
            Registrar sessão
          </Link>
        ) : null}
      </Heading>
      <Feedback error={items.error || exercises.error} />
      <section className="panel">
        <span
          className={"badge " + (w.status === "PUBLISHED" ? "green" : "amber")}
        >
          {statusLabel(w.status)}
        </span>
        <p>{w.notes || "Siga a prescrição do seu personal."}</p>
      </section>
      <div className="prescription-list">
        {[...items.rows]
          .sort((a, b) => a.position - b.position)
          .map((i) => {
            const e = exercises.rows.find((e) => e.id === i.exercise_id);
            return (
              <article className="panel prescription-item" key={i.id}>
                <span className="sequence-number">{i.position}</span>
                <div>
                  <span className="eyebrow">
                    {e?.muscle_group} · {e?.equipment}
                  </span>
                  <h2>{e?.name || "Exercício"}</h2>
                  <div className="prescription-facts">
                    <span>
                      <strong>{i.sets}</strong>séries
                    </span>
                    <span>
                      <strong>{i.repetitions}</strong>repetições / duração
                    </span>
                    <span>
                      <strong>{i.rest_seconds}s</strong>descanso
                    </span>
                  </div>
                  {i.notes && <p className="notice">{i.notes}</p>}
                  {e?.instructions && <p className="muted">{e.instructions}</p>}
                  <ExerciseVideo
                    path={e?.video_path}
                    url={e?.video_url}
                    name={e?.name || "Exercício"}
                  />
                </div>
              </article>
            );
          })}
      </div>
    </>
  );
}
