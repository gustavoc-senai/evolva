import { useState } from "react";
import { date } from "../lib/utils";
import { Empty } from "./UI";

type Point = { date: string; value: number };
export function TrendChart({
  title,
  points,
  unit,
}: {
  title: string;
  points: Point[];
  unit: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  if (!points.length)
    return (
      <section className="panel">
        <h2>{title}</h2>
        <Empty title="Ainda não há dados para este gráfico" />
      </section>
    );
  const values = points.map((point) => point.value);
  const min = Math.min(...values),
    max = Math.max(...values);
  const spread = max - min || Math.max(1, max * 0.1);
  const x = (index: number) =>
    45 + (index / Math.max(1, points.length - 1)) * 500;
  const y = (value: number) => 160 - ((value - min) / spread) * 125;
  const chosen =
    points[selected ?? points.length - 1] || points[points.length - 1];
  return (
    <section className="panel trend-panel">
      <div className="panel-heading">
        <h2>{title}</h2>
        <span className="badge">{points.length} registros</span>
      </div>
      <p className="chart-reading" aria-live="polite">
        <strong>
          {chosen.value.toLocaleString("pt-BR")} {unit}
        </strong>
        <span>{date(chosen.date)}</span>
      </p>
      <svg
        viewBox="0 0 590 210"
        role="group"
        aria-label={title}
        className="trend-chart"
      >
        {[min, min + spread / 2, min + spread].map((value, index) => (
          <g key={index}>
            <line
              x1="45"
              x2="550"
              y1={y(value)}
              y2={y(value)}
              stroke="var(--border)"
            />
            <text
              x="38"
              y={y(value) + 4}
              textAnchor="end"
              fill="var(--subtle)"
              fontSize="11"
            >
              {value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
            </text>
          </g>
        ))}
        <polyline
          points={points
            .map((point, index) => `${x(index)},${y(point.value)}`)
            .join(" ")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
        />
        {points.map((point, index) => (
          <circle
            key={`${point.date}:${index}`}
            cx={x(index)}
            cy={y(point.value)}
            r="5"
            fill="var(--accent)"
            stroke="var(--surface)"
            strokeWidth="2"
            tabIndex={0}
            role="button"
            aria-label={`${date(point.date)}: ${point.value} ${unit}`}
            onFocus={() => setSelected(index)}
            onMouseEnter={() => setSelected(index)}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelected(index);
              }
            }}
          >
            <title>
              {date(point.date)}: {point.value} {unit}
            </title>
          </circle>
        ))}
        <text x="45" y="194" fontSize="11" fill="var(--subtle)">
          {date(points[0].date)}
        </text>
        <text
          x="550"
          y="194"
          textAnchor="end"
          fontSize="11"
          fill="var(--subtle)"
        >
          {date(points[points.length - 1].date)}
        </text>
      </svg>
      <details>
        <summary>Consultar valores do gráfico</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Valor ({unit})</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point, index) => (
                <tr key={index}>
                  <td>{date(point.date)}</td>
                  <td>{point.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
export default function EvolutionCharts({
  sessions,
  assessments,
  logs,
  items,
  exercises,
}: {
  sessions: any[];
  assessments: any[];
  logs: any[];
  items: any[];
  exercises: any[];
}) {
  const [exercise, setExercise] = useState("");
  const [measure, setMeasure] = useState("weight_kg");
  const relevantLogs = logs.filter((log) =>
    sessions.some((session) => session.id === log.session_id),
  );
  const available = exercises.filter((exercise) =>
    relevantLogs.some(
      (log) =>
        items.find((item) => item.id === log.item_id)?.exercise_id ===
        exercise.id,
    ),
  );
  const chosen = exercise || available[0]?.id;
  const loadPoints = sessions
    .map((session) => {
      const loads = relevantLogs
        .filter(
          (log) =>
            log.session_id === session.id &&
            items.find((item) => item.id === log.item_id)?.exercise_id ===
              chosen &&
            log.load_kg !== null &&
            log.load_kg !== undefined,
        )
        .map((log) => Number(log.load_kg))
        .filter(Number.isFinite);
      return {
        date: session.completed_at,
        value: loads.length ? Math.max(...loads) : null,
      };
    })
    .filter((point) => point.value !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-40) as Point[];
  const measurePoints = assessments
    .filter(
      (item) =>
        item[measure] !== null &&
        item[measure] !== undefined &&
        Number.isFinite(Number(item[measure])),
    )
    .sort((a, b) => a.assessed_on.localeCompare(b.assessed_on))
    .slice(-40)
    .map((item) => ({ date: item.assessed_on, value: Number(item[measure]) }));
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(
      start.getDate() - ((start.getDay() + 6) % 7) - (7 - index) * 7,
    );
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return {
      date: start.toLocaleDateString("sv-SE"),
      value: sessions.filter(
        (session) =>
          new Date(session.completed_at) >= start &&
          new Date(session.completed_at) < end,
      ).length,
    };
  });
  return (
    <section className="evolution-charts">
      <div className="panel">
        <h2>Seu progresso em gráficos</h2>
        <p className="muted small">
          Dados registrados no acompanhamento. A carga mostra o maior valor
          informado por sessão, sem comparação entre exercícios. Selecione um
          ponto para consultar seu valor.
        </p>
        <div className="form-grid">
          <label>
            Exercício do gráfico
            <select
              value={chosen || ""}
              onChange={(e) => setExercise(e.target.value)}
            >
              <option value="" disabled>
                Selecione um exercício
              </option>
              {available.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Medida do gráfico
            <select
              value={measure}
              onChange={(e) => setMeasure(e.target.value)}
            >
              <option value="weight_kg">Peso (kg)</option>
              <option value="waist_cm">Cintura (cm)</option>
              <option value="hip_cm">Quadril (cm)</option>
            </select>
          </label>
        </div>
      </div>
      <div className="two-col">
        <TrendChart title="Carga por sessão" points={loadPoints} unit="kg" />
        <TrendChart
          title={
            {
              weight_kg: "Peso registrado",
              waist_cm: "Cintura registrada",
              hip_cm: "Quadril registrado",
            }[measure] || "Medidas"
          }
          points={measurePoints}
          unit={measure === "weight_kg" ? "kg" : "cm"}
        />
      </div>
      <TrendChart
        title="Sessões por semana · últimas 8 semanas"
        points={weeks}
        unit="sessões"
      />
    </section>
  );
}
