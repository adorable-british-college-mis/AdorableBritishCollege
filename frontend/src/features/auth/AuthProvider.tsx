import { useEffect, useMemo, useState, type ReactNode } from "react";
import * as api from "../../lib/api";
import type { AuthUser } from "../../types";
import { AuthContext, type AuthContextValue } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    api.refreshSession().then((response) => setUser(response.user)).catch(() => setUser(null)).finally(() => setInitializing(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    initializing,
    async signIn(email, password) { const response = await api.login(email, password); setUser(response.user); },
    async signOut() { await api.logout(); setUser(null); },
  }), [user, initializing]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
