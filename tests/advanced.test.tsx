import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AgendaCalendar, { calendarDays } from "../src/components/AgendaCalendar";
import { followUpRows } from "../src/components/FollowUpAlerts";
import { TrendChart } from "../src/components/EvolutionCharts";
afterEach(cleanup);

describe("Calendário e acompanhamento", () => {
  it("inclui semanas completas a partir da segunda-feira e preserva mudanças de ano", () => {
    const month = calendarDays(new Date(2027, 0, 20), "month");
    expect(month).toHaveLength(42);
    expect(month[0].getDay()).toBe(1);
    expect(month[0].getFullYear()).toBe(2026);
    expect(calendarDays(new Date(2027, 0, 20), "week")).toHaveLength(7);
  });
  it("navega entre meses e permite selecionar um dia", () => {
    let chosen = "";
    render(
      <AgendaCalendar
        mode="month"
        events={[]}
        onDay={(day) => {
          chosen = day;
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Próximo período" }));
    const day = screen
      .getAllByRole("button")
      .find((button) =>
        button.getAttribute("aria-label")?.includes("0 atendimentos"),
      )!;
    fireEvent.click(day);
    expect(chosen).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("considera a última sessão, ignora alunos inativos e cadastros recentes", () => {
    const result = followUpRows(
      [
        { id: "a", active: true, created_at: "2026-01-01" },
        { id: "b", active: false, created_at: "2026-01-01" },
        { id: "c", active: true, created_at: "2026-11-11" },
        { id: "d", active: true, created_at: "2026-01-01" },
      ],
      [
        { student_id: "a", completed_at: "2026-11-10T12:00:00Z" },
        { student_id: "d", completed_at: "2026-10-01T12:00:00Z" },
      ],
      7,
      Date.parse("2026-11-12T12:00:00Z"),
    );
    expect(result.map((row) => row.student.id)).toEqual(["d"]);
  });
  it("permite consultar os pontos e os valores do gráfico por teclado", () => {
    render(
      <MemoryRouter>
        <TrendChart
          title="Carga"
          points={[
            { date: "2026-11-01", value: 10 },
            { date: "2026-11-02", value: 20 },
          ]}
          unit="kg"
        />
      </MemoryRouter>,
    );
    const first = screen.getByRole("button", { name: /10 kg/ });
    fireEvent.focus(first);
    expect(screen.getByText("10 kg")).toBeTruthy();
    expect(screen.getByText("Consultar valores do gráfico")).toBeTruthy();
  });
});
