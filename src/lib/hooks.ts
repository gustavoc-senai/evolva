import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { errorText } from "./utils";
// Paginação estável: evita truncar saldos e históricos no limite padrão do PostgREST.
export function useRows<T = any>(
  table: string,
  filters: Record<string, unknown> = {},
  order = "created_at",
  refresh = 0,
  options: { enabled?: boolean; columns?: string } = {},
) {
  const enabled =
    options.enabled !== false &&
    !Object.values(filters).some((value) => value === undefined);
  const columns = options.columns || "*";
  const [rows, setRows] = useState<T[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [global, setGlobal] = useState(0);
  useEffect(() => {
    const reload = () => setGlobal((v) => v + 1);
    window.addEventListener("evolva:changed", reload);
    return () => window.removeEventListener("evolva:changed", reload);
  }, []);
  const signature = JSON.stringify(filters);
  const scope = JSON.stringify([table, signature, order, columns]);
  const [dataScope, setDataScope] = useState(scope);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (dataScope !== scope) setRows([]);
    setDataScope(scope);
    setLoading(true);
    setError("");
    if (!enabled) {
      setRows([]);
      setLoading(false);
      return () => {
        active = false;
        controller.abort();
      };
    }
    async function load() {
      try {
        const result: T[] = [];
        const primary =
          (
            {
              evolva_plans: "code",
              evolva_subscriptions: "workspace_id",
              evolva_student_notes: "student_id",
              evolva_reminder_preferences: "student_id",
            } as Record<string, string>
          )[table] || "id";
        for (let start = 0; active; start += 500) {
          let q = supabase.from(table).select(columns);
          if (typeof q.abortSignal === "function")
            q = q.abortSignal(controller.signal);
          for (const [key, value] of Object.entries(JSON.parse(signature)))
            q = value === null ? q.is(key, null) : q.eq(key, value);
          q = q.order(order, { ascending: false });
          if (primary !== order) q = q.order(primary);
          const { data, error } = await q.range(start, start + 499);
          if (error) throw error;
          result.push(...((data ?? []) as T[]));
          if (!data || data.length < 500) break;
        }
        if (active) setRows(result);
      } catch (e) {
        if (active) setError(errorText(e));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [table, signature, order, refresh, global, enabled, columns]);
  return {
    rows: enabled && dataScope === scope ? rows : [],
    loading: enabled && (dataScope !== scope || loading),
    error: enabled && dataScope === scope ? error : "",
  };
}
