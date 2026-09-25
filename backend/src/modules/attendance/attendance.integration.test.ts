import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../app.js";

const prisma = new PrismaClient();
afterAll(async () => prisma.$disconnect());

describe("attendance workspace", () => {
  it("opens, saves and submits an auditable lesson register", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email: "admin@abc.test", password: "ChangeMe123!" }).expect(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken as string}` };
    const timetable = await request(app).get("/api/v1/timetable/overview").set(auth).expect(200);
    const slot = timetable.body.data.slots[0];
    expect(slot).toBeTruthy();
    const date = `2026-10-${String(10 + Math.floor(Math.random() * 15)).padStart(2, "0")}`;

    const opened = await request(app).post("/api/v1/attendance/registers").set(auth).send({ timetableSlotId: slot.id, date }).expect(201);
    expect(opened.body.data.timetableSlotId).toBe(slot.id);
    const registerId = opened.body.data.id as string;
    const records = (opened.body.data.students as Array<{ id: string }>).map((student) => ({ studentId: student.id, status: "PRESENT", note: "Integration test" }));

    await request(app).patch(`/api/v1/attendance/registers/${registerId}/draft`).set(auth).send({ records }).expect(200);
    const submitted = await request(app).post(`/api/v1/attendance/registers/${registerId}/submit`).set(auth).send({ records }).expect(200);
    expect(submitted.body.data.status).toBe("SUBMITTED");
    await request(app).patch(`/api/v1/attendance/registers/${registerId}/draft`).set(auth).send({ records }).expect(409);

    await prisma.$transaction([
      prisma.auditEvent.deleteMany({ where: { entityId: registerId } }),
      prisma.attendanceRecord.deleteMany({ where: { registerId } }),
      prisma.attendanceRegister.delete({ where: { id: registerId } }),
    ]);
  });
});
