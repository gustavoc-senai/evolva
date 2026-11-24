import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
const Context = createContext<{
  user: User | null;
  loading: boolean;
  recovery: boolean;
  clearRecovery: () => void;
}>({ user: null, loading: true, recovery: false, clearRecovery: () => {} });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [recovery, setRecovery] = useState(false);
  useEffect(() => {
    let active = true,
      changed = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      changed = true;
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setRecovery(false);
    });
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active && !changed) {
          setUser(error ? null : (data.session?.user ?? null));
          setLoading(false);
        }
      })
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  return (
    <Context.Provider
      value={{
        user,
        loading,
        recovery,
        clearRecovery: () => setRecovery(false),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
