import { describe, expect, it } from "vitest";
import { resolveStudentScope } from "./student-scope.js";

describe("student record scopes", () => {
  it("limits parents to linked learners", () => {
    expect(resolveStudentScope({ userId: "parent-1", roles: ["PARENT"], permissions: ["students.read"] }))
      .toEqual({ mode: "guardian", userId: "parent-1" });
  });

  it("limits students to their own record", () => {
    expect(resolveStudentScope({ userId: "student-1", roles: ["STUDENT"], permissions: ["students.read"] }))
      .toEqual({ mode: "self", userId: "student-1" });
  });

  it("limits teachers to assigned learners", () => {
    expect(resolveStudentScope({ userId: "teacher-1", roles: ["TEACHER"], permissions: ["students.read", "students.read.assigned"] }))
      .toEqual({ mode: "assigned", userId: "teacher-1" });
  });

  it("allows explicitly privileged staff to view all learners", () => {
    expect(resolveStudentScope({ userId: "admin-1", roles: ["SCHOOL_ADMIN"], permissions: ["students.read.all"] }))
      .toEqual({ mode: "all" });
  });

  it("denies users without a recognized record scope", () => {
    expect(resolveStudentScope({ userId: "user-1", roles: [], permissions: ["students.read"] }))
      .toEqual({ mode: "none" });
  });
});
