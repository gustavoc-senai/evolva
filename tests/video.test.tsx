import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import ExerciseVideo from "../src/components/ExerciseVideo";
const sign = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/supabase", () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: sign }) } },
}));
beforeEach(() => {
  sign.mockReset();
  sign.mockResolvedValue({
    data: { signedUrl: "https://example.com/signed.mp4" },
    error: null,
  });
});
afterEach(cleanup);
it("solicita URL temporária somente ao abrir vídeo privado", async () => {
  const { container } = render(
    <ExerciseVideo path="workspace/video.mp4" name="Remada" />,
  );
  expect(sign).not.toHaveBeenCalled();
  const details = container.querySelector("details")!;
  details.open = true;
  fireEvent(details, new Event("toggle"));
  await waitFor(() =>
    expect(sign).toHaveBeenCalledWith("workspace/video.mp4", 900),
  );
  expect(await screen.findByLabelText("Demonstração de Remada")).toHaveProperty(
    "src",
    "https://example.com/signed.mp4",
  );
});
it("incorpora somente o identificador do vídeo do YouTube", () => {
  const { container } = render(
    <ExerciseVideo url="https://youtu.be/dQw4w9WgXcQ?t=15" name="Remada" />,
  );
  expect(container.querySelector("iframe")?.getAttribute("src")).toBe(
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
  expect(screen.getByTitle("Demonstração de Remada")).toBeTruthy();
});
it("oferece vídeo nativo para MP4", () => {
  const { container } = render(
    <ExerciseVideo url="https://example.com/remada.mp4" name="Remada" />,
  );
  expect(container.querySelector("video")?.hasAttribute("controls")).toBe(true);
});
it("usa link externo para outras plataformas sem incorporá-las", () => {
  const { container } = render(
    <ExerciseVideo url="https://example.com/video" name="Remada" />,
  );
  expect(container.querySelector("iframe")).toBeNull();
  expect(screen.getByRole("link").getAttribute("href")).toBe(
    "https://example.com/video",
  );
});
it("não exibe links inseguros", () => {
  const { container } = render(
    <ExerciseVideo url="javascript:alert(1)" name="Remada" />,
  );
  expect(container.innerHTML).toBe("");
});
