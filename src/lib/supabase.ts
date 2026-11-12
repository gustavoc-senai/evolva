import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(
  url && key && !url.includes("SEU-PROJETO") && !key.includes("SUA_CHAVE"),
);
export const supabase = createClient(
  configured ? url : "https://placeholder.supabase.co",
  configured ? key : "placeholder",
);
export async function rpc<T = any>(
  name: string,
  args: Record<string, unknown> = {},
) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  if (
    typeof window !== "undefined" &&
    /^evolva_(customize|attach|delete|queue|confirm|create|save|add|invite|accept|revoke|workout_status|complete|submit|send|read_notification|record|reverse|cancel|request_plan|admin_subscription|register|unregister)/.test(
      name,
    )
  )
    window.dispatchEvent(new Event("evolva:changed"));
  return data as T;
}
