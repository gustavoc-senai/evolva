import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "./Auth";
import { supabase } from "../lib/supabase";
import { errorText } from "../lib/utils";
import type { Access, Student, Workspace } from "../lib/types";
const Context = createContext<{
  accesses: Access[];
  access: Access | null;
  loading: boolean;
  error: string;
  isAdmin: boolean;
  select: (key: string) => void;
  reload: () => void;
}>({
  accesses: [],
  access: null,
  loading: true,
  error: "",
  isAdmin: false,
  select: () => {},
  reload: () => {},
});
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [accesses, setAccesses] = useState<Access[]>([]),
    [selected, setSelected] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [isAdmin, setAdmin] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setAccesses([]);
    setAdmin(false);
    setError("");
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      supabase.from("evolva_workspaces").select("*").order("created_at"),
      supabase
        .from("evolva_students")
        .select("*")
        .eq("account_id", user.id)
        .eq("active", true),
      supabase.rpc("evolva_is_admin"),
    ])
      .then(([w, s, admin]) => {
        if (!active) return;
        if (w.error) throw w.error;
        if (s.error) throw s.error;
        if (admin.error) throw admin.error;
        const spaces = (w.data ?? []) as Workspace[],
          students = (s.data ?? []) as Student[];
        const all: Access[] = spaces.flatMap<Access>((workspace) =>
          workspace.owner_id === user.id
            ? [{ workspace, role: "TRAINER" as const }]
            : students
                .filter((s) => s.workspace_id === workspace.id)
                .map((s) => ({
                  workspace,
                  role: "STUDENT" as const,
                  studentId: s.id,
                  studentName: s.name,
                })),
        );
        setAccesses(all);
        setAdmin(Boolean(admin.data));
        let saved = "";
        try {
          saved = localStorage.getItem("evolva-workspace:" + user.id) || "";
        } catch {
          /* memória apenas */
        }
        setSelected(
          all.some((a) => a.workspace.id + ":" + a.role === saved)
            ? saved
            : all[0]
              ? all[0].workspace.id + ":" + all[0].role
              : "",
        );
      })
      .catch((e) => active && setError(errorText(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user?.id, version]);
  function select(key: string) {
    setSelected(key);
    try {
      localStorage.setItem("evolva-workspace:" + user?.id, key);
    } catch {
      /* memória apenas */
    }
  }
  const access =
    accesses.find((a) => a.workspace.id + ":" + a.role === selected) ?? null;
  return (
    <Context.Provider
      value={{
        accesses,
        access,
        loading,
        error,
        isAdmin,
        select,
        reload: () => setVersion((v) => v + 1),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useWorkspace = () => useContext(Context);
