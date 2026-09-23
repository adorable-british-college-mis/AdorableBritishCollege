export interface StudentScopeContext {
  userId: string;
  roles: string[];
  permissions: string[];
}

export type StudentScope =
  | { mode: "all" }
  | { mode: "self"; userId: string }
  | { mode: "guardian"; userId: string }
  | { mode: "assigned"; userId: string }
  | { mode: "none" };

export function resolveStudentScope(context: StudentScopeContext): StudentScope {
  if (context.permissions.includes("students.read.all")) return { mode: "all" };
  if (context.roles.includes("STUDENT")) return { mode: "self", userId: context.userId };
  if (context.roles.includes("PARENT")) return { mode: "guardian", userId: context.userId };
  if (context.permissions.includes("students.read.assigned")) return { mode: "assigned", userId: context.userId };
  return { mode: "none" };
}
