export type DraftItem = {
  exercise_id: string;
  sets: number;
  repetitions: string;
  rest_seconds: number;
  notes: string;
};
export type WorkoutDraft = {
  version: 1;
  updatedAt: string;
  fields: { student: string; title: string; notes: string };
  items: DraftItem[];
  request: { signature: string; id: string };
};
export function readWorkoutDraft(key: string): WorkoutDraft | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.fields ||
      !Array.isArray(parsed.items) ||
      parsed.items.length > 50
    )
      return null;
    if (
      ![parsed.fields.student, parsed.fields.title, parsed.fields.notes].every(
        (value) => typeof value === "string",
      )
    )
      return null;
    if (
      !parsed.items.every(
        (item: DraftItem) =>
          item &&
          typeof item.exercise_id === "string" &&
          Number.isInteger(item.sets) &&
          typeof item.repetitions === "string" &&
          typeof item.rest_seconds === "number" &&
          typeof item.notes === "string",
      )
    )
      return null;
    if (
      !parsed.request ||
      typeof parsed.request.signature !== "string" ||
      typeof parsed.request.id !== "string"
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}
