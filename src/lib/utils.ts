export const money = (n: number | string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(n),
  );
export function date(value: string | undefined | null, withTime = false) {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? value + "T12:00:00" : value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(
        "pt-BR",
        withTime
          ? { dateStyle: "short", timeStyle: "short" }
          : { dateStyle: "short" },
      );
}
export function errorText(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (code === "23505")
    return "Já existe um registro com esses dados. Confira antes de repetir.";
  if (code === "23514" || code === "23502")
    return "Confira os campos obrigatórios e os limites dos valores informados.";
  if (code === "42501")
    return "Seu perfil não tem permissão para esta operação.";
  if (error && typeof error === "object" && "message" in error)
    return String(error.message);
  return "Não foi possível concluir. Tente novamente.";
}
export const today = () => new Date().toLocaleDateString("sv-SE");
export function safeNext(raw: string | null) {
  return raw && /^\/convite\/[a-f0-9-]{36}$/i.test(raw) ? raw : "/app";
}
export const statusLabel = (s: string) =>
  (
    ({
      DRAFT: "Rascunho",
      PUBLISHED: "Publicado",
      ARCHIVED: "Arquivado",
      SCHEDULED: "Agendado",
      CONFIRMED: "Confirmado",
      COMPLETED: "Concluído",
      CANCELLED: "Cancelado",
      OPEN: "Em aberto",
      PAID: "Recebido",
      TRIAL: "Período de teste",
      ACTIVE: "Ativo",
      SUSPENDED: "Suspenso",
      PENDING: "Pendente",
      APPROVED: "Aprovado",
      REJECTED: "Recusado",
    }) as Record<string, string>
  )[s] || s;
export const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function exportCsv(
  filename: string,
  headers: string[],
  rows: unknown[][],
) {
  const cell = (x: unknown) =>
    '"' +
    String(x ?? "")
      .replace(/^[=+@-]/, "'")
      .replaceAll('"', '""') +
    '"';
  const blob = new Blob(
    [
      "\ufeff" +
        [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
export function videoUrl(url: string | null) {
  try {
    const u = new URL(url ?? "");
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
