import { createContext, use } from "react";
import type { AuthUser } from "../../types";

export interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = use(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
