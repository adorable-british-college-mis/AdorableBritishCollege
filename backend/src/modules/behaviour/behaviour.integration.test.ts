import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../app.js";

const prisma = new PrismaClient();
afterAll(async () => prisma.$disconnect());

describe("behaviour workspace", () => {
  it("manages linked events, rewards and sanctions while preserving archived history", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email: "admin@abc.test", password: "ChangeMe123!" }).expect(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken as string}` };
    const reference = await request(app).get("/api/v1/behaviour/reference").set(auth).expect(200);
    const student = reference.body.data.students[0];
    const staff = reference.body.data.staff[0];
    const term = reference.body.data.academicYear.terms[0];
    const suffix = Date.now().toString().slice(-7);
    const occurredAt = new Date(new Date(term.startsOn).getTime() + 86_400_000).toISOString();

    const category = await request(app).post("/api/v1/behaviour/categories").set(auth).send({ code: `QA${suffix}`, name: `Quality Award ${suffix}`, type: "POSITIVE", defaultPoints: 7, description: "Integration test category" }).expect(201);
    const event = await request(app).post("/api/v1/behaviour/events").set(auth).send({ studentId: student.id, termId: term.id, categoryId: category.body.data.id, staffId: staff.id, formGroupId: student.enrollments[0]?.formGroupId ?? "", type: "POSITIVE", status: "OPEN", summary: "Strong collaborative work", details: "Integration test", points: 7, occurredAt }).expect(201);
    const reward = await request(app).post("/api/v1/behaviour/rewards").set(auth).send({ studentId: student.id, termId: term.id, staffId: staff.id, title: "Quality commendation", description: "Integration test", points: 8, awardedAt: occurredAt, status: "AWARDED" }).expect(201);

    const incidentCategory = reference.body.data.categories.find((item: { type: string }) => item.type === "INCIDENT");
    const incident = await request(app).post("/api/v1/behaviour/events").set(auth).send({ studentId: student.id, termId: term.id, categoryId: incidentCategory.id, staffId: staff.id, formGroupId: student.enrollments[0]?.formGroupId ?? "", type: "INCIDENT", status: "OPEN", summary: "Follow-up incident", points: incidentCategory.defaultPoints, occurredAt }).expect(201);
    const sanction = await request(app).post("/api/v1/behaviour/sanctions").set(auth).send({ studentId: student.id, termId: term.id, staffId: staff.id, behaviourEventId: incident.body.data.id, type: "DETENTION", status: "PENDING", title: "Restorative detention", scheduledFor: occurredAt }).expect(201);

    await request(app).patch(`/api/v1/behaviour/events/${event.body.data.id}`).set(auth).send({ status: "RESOLVED", summary: "Strong collaborative work completed" }).expect(200);
    await request(app).patch(`/api/v1/behaviour/rewards/${reward.body.data.id}`).set(auth).send({ points: 10 }).expect(200);
    await request(app).patch(`/api/v1/behaviour/sanctions/${sanction.body.data.id}`).set(auth).send({ status: "COMPLETED" }).expect(200);

    const overview = await request(app).get("/api/v1/behaviour/overview").set(auth).expect(200);
    expect(overview.body.data.events.some((item: { id: string }) => item.id === event.body.data.id)).toBe(true);
    expect(overview.body.data.rewards.some((item: { id: string; points: number }) => item.id === reward.body.data.id && item.points === 10)).toBe(true);
    expect(overview.body.data.sanctions.some((item: { id: string; status: string }) => item.id === sanction.body.data.id && item.status === "COMPLETED")).toBe(true);

    await request(app).post(`/api/v1/behaviour/categories/${category.body.data.id}/archive`).set(auth).expect(200);
    const activeReference = await request(app).get("/api/v1/behaviour/reference").set(auth).expect(200);
    expect(activeReference.body.data.categories.some((item: { id: string }) => item.id === category.body.data.id)).toBe(false);
    expect(await prisma.behaviourEvent.findUnique({ where: { id: event.body.data.id } })).not.toBeNull();

    const ids = [category.body.data.id, event.body.data.id, reward.body.data.id, incident.body.data.id, sanction.body.data.id];
    await prisma.$transaction([
      prisma.auditEvent.deleteMany({ where: { entityId: { in: ids } } }),
      prisma.behaviourSanction.delete({ where: { id: sanction.body.data.id } }),
      prisma.behaviourReward.delete({ where: { id: reward.body.data.id } }),
      prisma.behaviourEvent.deleteMany({ where: { id: { in: [event.body.data.id, incident.body.data.id] } } }),
      prisma.behaviourCategory.delete({ where: { id: category.body.data.id } }),
    ]);
  });
});
