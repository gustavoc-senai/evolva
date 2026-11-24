import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import QuickNavigation from "../src/components/QuickNavigation";
import DashboardFocus from "../src/components/DashboardFocus";

afterEach(cleanup);
function CurrentPage() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

describe("Busca de páginas", () => {
  it("abre pelo teclado, encontra termos sem acento e navega com Enter", () => {
    render(
      <MemoryRouter>
        <QuickNavigation trainer admin={false} />
        <CurrentPage />
      </MemoryRouter>,
    );
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.change(screen.getByLabelText("Buscar página"), {
      target: { value: "avaliacoes" },
    });
    fireEvent.submit(screen.getByLabelText("Buscar página").closest("form")!);
    expect(screen.getByTestId("path").textContent).toBe("/app/avaliacoes");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("mostra páginas de aluno e mantém administração fora dos resultados", () => {
    render(
      <MemoryRouter>
        <QuickNavigation trainer={false} admin={false} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Buscar páginas" }));
    expect(screen.getByRole("button", { name: /Check-in/ })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Cadastros, objetivos/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Administração do Evolva/ }),
    ).toBeNull();
    fireEvent.change(screen.getByLabelText("Buscar página"), {
      target: { value: "inexistente" },
    });
    expect(screen.getByRole("status").textContent).toContain("Nenhuma página");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Prioridades do painel", () => {
  it("conta somente alunos ativos sem publicação e cobranças abertas vencidas", () => {
    render(
      <MemoryRouter>
        <DashboardFocus
          today="2026-11-12"
          students={[
            { id: "a", active: true },
            { id: "b", active: true },
            { id: "c", active: false },
          ]}
          workouts={[
            { student_id: "a", status: "PUBLISHED" },
            { student_id: "b", status: "DRAFT" },
          ]}
          charges={[
            { status: "OPEN", due_on: "2026-11-01" },
            { status: "PAID", due_on: "2026-11-01" },
            { status: "OPEN", due_on: "2026-11-20" },
          ]}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: /Alunos sem treino publicado/ })
        .textContent,
    ).toBe("1Alunos sem treino publicado");
    expect(
      screen.getByRole("link", { name: /Cobranças vencidas/ }).textContent,
    ).toBe("1Cobranças vencidas em aberto");
    expect(screen.queryByText("Vamos preparar seu espaço")).toBeNull();
  });
  it("orienta os primeiros passos em um espaço vazio", () => {
    render(
      <MemoryRouter>
        <DashboardFocus
          students={[]}
          workouts={[]}
          charges={[]}
          today="2026-11-12"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Vamos preparar seu espaço")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Cadastre seu primeiro aluno/ })
        .getAttribute("href"),
    ).toBe("/app/alunos");
  });
});
