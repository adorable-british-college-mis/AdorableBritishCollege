import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../app.js";

const prisma = new PrismaClient();
afterAll(async () => prisma.$disconnect());

describe("reports workspace", () => {
  it("builds live summaries and manages generated report history", async () => {
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@abc.test", password: "ChangeMe123!" })
      .expect(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken as string}` };

    const overview = await request(app).get("/api/v1/reports/overview").set(auth).expect(200);
    expect(overview.body.data.metrics).toMatchObject({
      totalStudents: expect.any(Number),
      reportsGenerated: expect.any(Number),
      behaviourIncidents: expect.any(Number),
      trends: expect.any(Object),
    });
    expect(overview.body.data.academicPerformance).toBeInstanceOf(Array);
    expect(overview.body.data.attendanceByYearGroup).toBeInstanceOf(Array);

    const generated = await request(app)
      .post("/api/v1/reports/generate")
      .set(auth)
      .send({ type: "ACADEMIC", name: `Integration Academic Report ${Date.now()}` })
      .expect(201);
    const reportId = generated.body.data.id as string;

    const detail = await request(app).get(`/api/v1/reports/${reportId}`).set(auth).expect(200);
    expect(detail.body.data).toMatchObject({ id: reportId, type: "ACADEMIC", status: "COMPLETED" });

    const download = await request(app).get(`/api/v1/reports/${reportId}/download`).set(auth).expect(200);
    expect(download.headers["content-type"]).toContain("text/csv");
    expect(download.text).toContain("Section,Metric,Value");

    await request(app).post(`/api/v1/reports/${reportId}/archive`).set(auth).expect(200);
    await request(app).get(`/api/v1/reports/${reportId}`).set(auth).expect(404);

    await prisma.auditEvent.deleteMany({ where: { entityType: "GeneratedReport", entityId: reportId } });
    await prisma.generatedReport.delete({ where: { id: reportId } });
  });
});
