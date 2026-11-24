import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { today } from "../lib/utils";

type CalendarEvent = {
  id: string;
  title: string;
  starts_at: string;
  status: string;
};
export function calendarDays(anchor: Date, mode: "month" | "week") {
  const first = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    mode === "month" ? 1 : anchor.getDate(),
  );
  first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  return Array.from({ length: mode === "month" ? 42 : 7 }, (_, index) => {
    const day = new Date(first);
    day.setDate(first.getDate() + index);
    return day;
  });
}
export default function AgendaCalendar({
  events,
  mode,
  onDay,
}: {
  events: CalendarEvent[];
  mode: "month" | "week";
  onDay: (day: string) => void;
}) {
  const [anchor, setAnchor] = useState(() => new Date());
  const days = calendarDays(anchor, mode);
  function move(amount: number) {
    const next = new Date(anchor);
    if (mode === "month") {
      next.setDate(1);
      next.setMonth(next.getMonth() + amount);
    } else next.setDate(next.getDate() + 7 * amount);
    setAnchor(next);
  }
  return (
    <section
      className="panel visual-calendar"
      aria-label="Calendário de atendimentos"
    >
      <div className="panel-heading">
        <h2>
          {anchor.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <div className="actions">
          <button
            className="icon secondary"
            aria-label="Período anterior"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="secondary small"
            onClick={() => setAnchor(new Date())}
          >
            Hoje
          </button>
          <button
            className="icon secondary"
            aria-label="Próximo período"
            onClick={() => move(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <p className="muted small">
        Selecione um dia para consultar seus atendimentos na lista abaixo.
      </p>
      <div className="calendar-scroll">
        <div className="calendar-grid">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
            <div className="calendar-weekday" key={day}>
              {day}
            </div>
          ))}
          {days.map((day) => {
            const key = day.toLocaleDateString("sv-SE");
            const appointments = events
              .filter(
                (event) =>
                  new Date(event.starts_at).toLocaleDateString("sv-SE") === key,
              )
              .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
            return (
              <button
                key={key}
                className={`calendar-day ${key === today() ? "is-today" : ""} ${day.getMonth() !== anchor.getMonth() ? "outside-month" : ""}`}
                onClick={() => onDay(key)}
                aria-label={`${day.toLocaleDateString("pt-BR")}, ${appointments.length} atendimentos`}
              >
                <strong>{day.getDate()}</strong>
                {appointments
                  .slice(0, mode === "week" ? 10 : 3)
                  .map((event) => (
                    <span
                      key={event.id}
                      className={
                        event.status === "CANCELLED" ? "cancelled" : ""
                      }
                    >
                      {new Date(event.starts_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      {event.title}
                    </span>
                  ))}
                {appointments.length > (mode === "week" ? 10 : 3) && (
                  <small>
                    +{appointments.length - (mode === "week" ? 10 : 3)} outros
                  </small>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
