import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../app.js";

const prisma = new PrismaClient();
afterAll(async () => prisma.$disconnect());

describe("communication workspace", () => {
  it("manages contextual messages, replies, drafts and announcements", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email: "admin@abc.test", password: "ChangeMe123!" }).expect(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken as string}` };
    const overview = await request(app).get("/api/v1/communication/overview").set(auth).expect(200);
    const student = overview.body.data.reference.students[0];
    expect(student).toBeTruthy();
    expect(overview.body.data.liveEvents).toBeInstanceOf(Array);

    const assisted = await request(app).post("/api/v1/communication/assistant/draft").set(auth).send({ intent: "FOLLOW_UP", tone: "SUPPORTIVE", audienceLabel: student.firstName, context: { type: "ATTENDANCE", title: "Attendance follow-up", details: "A register requires clarification" } }).expect(200);
    expect(assisted.body.data.body).toContain("Attendance follow-up");

    const thread = await request(app).post("/api/v1/communication/threads").set(auth).send({ subject: `Integration message ${Date.now()}`, type: "DIRECT", channel: "PORTAL", recipients: [{ type: "STUDENT", id: student.id }], body: assisted.body.data.body, saveAsDraft: false, assisted: true }).expect(201);
    const threadId = thread.body.data.id as string;
    expect(thread.body.data.messages[0].status).toBe("SENT");

    const reply = await request(app).post(`/api/v1/communication/threads/${threadId}/messages`).set(auth).send({ body: "Follow-up detail", saveAsDraft: false, assisted: false }).expect(201);
    expect(reply.body.data.body).toBe("Follow-up detail");
    await request(app).post(`/api/v1/communication/threads/${threadId}/read`).set(auth).expect(200);

    const announcement = await request(app).post("/api/v1/communication/announcements").set(auth).send({ title: `Integration announcement ${Date.now()}`, body: "A test announcement for the school community.", audience: { type: "ALL", ids: [] }, audienceLabel: "Whole school community", priority: "IMPORTANT", status: "DRAFT", assisted: false }).expect(201);
    const announcementId = announcement.body.data.id as string;
    const published = await request(app).patch(`/api/v1/communication/announcements/${announcementId}`).set(auth).send({ status: "PUBLISHED" }).expect(200);
    expect(published.body.data.publishedAt).toBeTruthy();

    await request(app).post(`/api/v1/communication/announcements/${announcementId}/archive`).set(auth).expect(200);
    await request(app).post(`/api/v1/communication/threads/${threadId}/archive`).set(auth).expect(200);

    const entityIds = [threadId, announcementId, ...thread.body.data.messages.map((item: { id: string }) => item.id), reply.body.data.id];
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: entityIds } } });
    await prisma.announcement.delete({ where: { id: announcementId } });
    await prisma.communicationThread.delete({ where: { id: threadId } });
  });
});
