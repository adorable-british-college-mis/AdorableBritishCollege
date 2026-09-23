import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("permission helper", () => {
  it("requires an authenticated user with an explicit permission", () => {
    expect(can(null, "students.read")).toBe(false);
    expect(can({ id: "1", email: "test@example.test", firstName: "Test", lastName: "User", roles: ["TEACHER"], permissions: ["students.read"] }, "students.read")).toBe(true);
    expect(can({ id: "1", email: "test@example.test", firstName: "Test", lastName: "User", roles: ["TEACHER"], permissions: ["students.read"] }, "students.archive")).toBe(false);
  });
});
