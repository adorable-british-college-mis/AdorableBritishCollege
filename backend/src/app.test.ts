import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("service health", () => {
  it("reports a healthy API without exposing internals", async () => {
    const response = await request(app).get("/health").expect(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("abc-mis-api");
    expect(response.headers["x-request-id"]).toBeTruthy();
  });

  it("protects student routes", async () => {
    const response = await request(app).get("/api/v1/students").expect(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("protects the administrative dashboard aggregate", async () => {
    const response = await request(app).get("/api/v1/dashboard/summary").expect(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("publishes the versioned API contract", async () => {
    const response = await request(app).get("/api/v1/openapi.json").expect(200);
    expect(response.body.openapi).toBe("3.1.0");
    expect(response.body.paths["/students"]).toBeTruthy();
  });
});
