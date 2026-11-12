import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Timer,
  CheckCircle2,
  Play,
  Square,
  ChevronRight,
  Dumbbell,
} from "lucide-react";
import { useAuth } from "../contexts/Auth";
import { useRows } from "../lib/hooks";
import { rpc } from "../lib/supabase";
import type { Workout, WorkoutItem, Exercise } from "../lib/types";
import { Heading, Feedback, Loading, Empty } from "../components/UI";
import { errorText } from "../lib/utils";
import ExerciseVideo from "../components/ExerciseVideo";
type SetValue = { done: boolean; repetitions: string; load: string };
export default function Session() {
  const { id } = useParams(),
    { user } = useAuth(),
    navigate = useNavigate();
  const workout = useRows<Workout>("evolva_workouts", { id }),
    items = useRows<WorkoutItem>(
      "evolva_workout_items",
      { workout_id: id },
      "position",
    ),
    exercises = useRows<Exercise>("evolva_exercises", {}, "name");
  const [values, setValues] = useState<Record<string, SetValue>>({}),
    [effort, setEffort] = useState(""),
    [notes, setNotes] = useState(""),
    [remaining, setRemaining] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const deadline = useRef(0),
    request = useRef({ signature: "", id: "" });
  const storageKey = `evolva-session:${user?.id}:${id}`;
  useEffect(() => {
    setValues({});
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (raw && typeof raw === "object" && !Array.isArray(raw)) setValues(raw);
    } catch {
      /* memória apenas */
    }
  }, [storageKey]);
  useEffect(() => {
    const timer = setInterval(
      () =>
        setRemaining(
          Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)),
        ),
      250,
    );
    return () => clearInterval(timer);
  }, []);
  function patch(key: string, field: keyof SetValue, v: string | boolean) {
    const next = {
      ...values,
      [key]: {
        ...(values[key] ?? { done: false, repetitions: "", load: "" }),
        [field]: v,
      },
    };
    setValues(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* registro segue na memória */
    }
  }
  if (workout.loading || items.loading) return <Loading />;
  const w = workout.rows[0];
  if (!w || w.status !== "PUBLISHED")
    return (
      <>
        <Feedback error={workout.error} />
        <Empty title="Treino indisponível para registro">
          Consulte seu personal ou volte à lista de treinos.
        </Empty>
      </>
    );
  const completed = Object.values(values).filter((v) => v.done).length,
    total = items.rows.reduce((n, i) => n + i.sets, 0);
  async function save() {
    if (busy) return;
    setError("");
    const sets = items.rows.flatMap((i) =>
      Array.from({ length: i.sets }, (_, n) => {
        const v = values[`${i.id}:${n + 1}`];
        return v?.done
          ? [
              {
                item_id: i.id,
                set_number: n + 1,
                repetitions: Number(v.repetitions),
                load_kg: v.load === "" ? null : Number(v.load),
              },
            ]
          : [];
      }).flat(),
    );
    if (
      Object.values(values).some((v) => v.done && v.repetitions.trim() === "")
    ) {
      setError("Informe as repetições das séries realizadas.");
      return;
    }
    if (!sets.length) {
      setError("Marque ao menos uma série realizada.");
      return;
    }
    if (
      sets.some((s) => !Number.isInteger(s.repetitions) || s.repetitions < 0)
    ) {
      setError("Informe as repetições das séries realizadas.");
      return;
    }
    if (
      !confirm(
        `Registrar ${sets.length} de ${total} séries? Você pode registrar uma sessão parcial.`,
      )
    )
      return;
    const args = {
      p_workout: id,
      p_effort: effort ? Number(effort) : null,
      p_notes: notes || null,
      p_sets: sets,
    };
    const signature = JSON.stringify(args);
    if (request.current.signature !== signature) {
      let saved;
      try {
        saved = JSON.parse(
          localStorage.getItem(storageKey + ":request") || "null",
        );
      } catch {}
      request.current =
        saved?.signature === signature && typeof saved.id === "string"
          ? saved
          : { signature, id: crypto.randomUUID() };
      try {
        localStorage.setItem(
          storageKey + ":request",
          JSON.stringify(request.current),
        );
      } catch {}
    }
    setBusy(true);
    try {
      await rpc("evolva_complete_session", {
        ...args,
        p_request: request.current.id,
      });
      try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(storageKey + ":request");
      } catch {
        /* sem armazenamento */
      }
      navigate("/app/evolucao?registrado=1");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title={w.title}
        description="Registre o que realizou. Se necessário, envie uma sessão parcial."
      >
        <Link className="button secondary" to={"/app/treinos/" + id}>
          Voltar
        </Link>
      </Heading>
      <Feedback error={error || items.error || exercises.error} />
      <div className="session-layout">
        <section>
          <div className="panel session-summary">
            <span className="mini-icon">
              <Dumbbell size={22} />
            </span>
            <div>
              <strong>
                {completed} de {total} séries marcadas
              </strong>
              <small>Os dados ficam neste navegador até você enviar.</small>
            </div>
            <progress max={Math.max(1, total)} value={completed} />
          </div>
          <fieldset disabled={busy} className="plain-fieldset">
            {[...items.rows]
              .sort((a, b) => a.position - b.position)
              .map((i) => (
                <article className="panel session-exercise" key={i.id}>
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">EXERCÍCIO {i.position}</span>
                      <h2>
                        {exercises.rows.find((e) => e.id === i.exercise_id)
                          ?.name || "Exercício"}
                      </h2>
                      <p className="muted">
                        Prescrição: {i.sets} séries · {i.repetitions} · descanso{" "}
                        {i.rest_seconds}s
                      </p>
                    </div>
                    <button
                      className="secondary small"
                      type="button"
                      onClick={() => {
                        deadline.current = Date.now() + i.rest_seconds * 1000;
                        setRemaining(i.rest_seconds);
                      }}
                    >
                      <Timer size={15} />
                      Descanso
                    </button>
                  </div>
                  {i.notes && <p className="notice">{i.notes}</p>}
                  <ExerciseVideo
                    path={exercises.rows.find(e => e.id === i.exercise_id)?.video_path}
                    url={
                      exercises.rows.find((e) => e.id === i.exercise_id)
                        ?.video_url
                    }
                    name={
                      exercises.rows.find((e) => e.id === i.exercise_id)
                        ?.name || "Exercício"
                    }
                  />
                  <div className="set-table">
                    <div className="set-table-head">
                      <span>Série</span>
                      <span>Repetições feitas</span>
                      <span>Carga (kg)</span>
                      <span>Feita</span>
                    </div>
                    {Array.from({ length: i.sets }, (_, n) => {
                      const key = `${i.id}:${n + 1}`,
                        v = values[key];
                      return (
                        <div
                          className={"set-row " + (v?.done ? "done" : "")}
                          key={key}
                        >
                          <strong>{n + 1}</strong>
                          <input
                            aria-label={`Repetições exercício ${i.position} série ${n + 1}`}
                            type="number"
                            min={0}
                            max={500}
                            value={v?.repetitions ?? ""}
                            placeholder="Reps"
                            onChange={(e) =>
                              patch(key, "repetitions", e.target.value)
                            }
                          />
                          <input
                            aria-label={`Carga exercício ${i.position} série ${n + 1}`}
                            type="number"
                            min={0}
                            max={9999}
                            step="0.01"
                            value={v?.load ?? ""}
                            placeholder="Opcional"
                            onChange={(e) => patch(key, "load", e.target.value)}
                          />
                          <input
                            type="checkbox"
                            aria-label={`Marcar exercício ${i.position} série ${n + 1}`}
                            checked={v?.done ?? false}
                            onChange={(e) =>
                              patch(key, "done", e.target.checked)
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
          </fieldset>
        </section>
        <aside className="builder-side">
          <section className="panel timer-panel">
            <Timer size={25} />
            <h2>Seu intervalo</h2>
            <strong>
              {Math.floor(remaining / 60)
                .toString()
                .padStart(2, "0")}
              :{(remaining % 60).toString().padStart(2, "0")}
            </strong>
            <p className="muted small">
              Use o descanso definido pelo seu personal.
            </p>
            <button
              className="secondary"
              onClick={() => {
                deadline.current = 0;
                setRemaining(0);
              }}
            >
              <Square size={14} />
              Parar
            </button>
          </section>
          <section className="panel">
            <h2>Como foi a sessão?</h2>
            <label>
              Esforço percebido (opcional)
              <select
                value={effort}
                onChange={(e) => setEffort(e.target.value)}
              >
                <option value="">Não informar</option>
                {Array.from({ length: 10 }, (_, n) => (
                  <option key={n + 1} value={n + 1}>
                    {n + 1}
                    {n === 0 ? " · Muito leve" : n === 9 ? " · Máximo" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Observações para o personal
              <textarea
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Como você se sentiu?"
              />
            </label>
            <button disabled={busy} onClick={() => void save()}>
              <CheckCircle2 size={17} />
              {busy ? "Registrando..." : "Enviar registro"}
              <ChevronRight size={15} />
            </button>
            <small className="muted">
              Este é um registro informado por você, não uma avaliação da
              execução.
            </small>
          </section>
        </aside>
      </div>
    </>
  );
}
