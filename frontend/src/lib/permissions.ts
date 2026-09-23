import type { AuthUser } from "../types";

export function can(user: AuthUser | null, permission: string): boolean {
  return Boolean(user?.permissions.includes(permission));
}
