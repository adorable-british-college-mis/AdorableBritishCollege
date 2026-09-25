import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../app.js";

const prisma = new PrismaClient();
afterAll(async () => prisma.$disconnect());

describe("timetable workspace", () => {
  it("creates lessons, prevents clashes and records cover arrangements", async () => {
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@abc.test", password: "ChangeMe123!" })
      .expect(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken as string}` };

    const overview = await request(app).get("/api/v1/timetable/overview").set(auth).expect(200);
    const { academicYear, currentTerm, reference } = overview.body.data;
    expect(reference.staff.length).toBeGreaterThanOrEqual(2);

    const suffix = Date.now().toString().slice(-7);
    const lessonPayload = {
      termId: currentTerm.id,
      yearGroupId: reference.yearGroups[0].id,
      formGroupId: reference.formGroups[0].id,
      subjectId: reference.subjects[0].id,
      staffId: reference.staff[0].id,
      weekday: 5,
      periodLabel: `QA ${suffix}`,
      startsAt: "16:00",
      endsAt: "16:30",
      room: `QA-${suffix}`,
    };

    const lesson = await request(app)
      .post("/api/v1/timetable/lessons")
      .set(auth)
      .send(lessonPayload)
      .expect(201);

    const conflict = await request(app)
      .post("/api/v1/timetable/lessons")
      .set(auth)
      .send({
        ...lessonPayload,
        formGroupId: reference.formGroups[1].id,
        yearGroupId: reference.formGroups[1].yearGroupId,
        staffId: reference.staff[1].id,
      })
      .expect(409);
    expect(conflict.body.error.message).toMatch(/conflict/i);

    const moved = await request(app)
      .patch(`/api/v1/timetable/lessons/${lesson.body.data.id}`)
      .set(auth)
      .send({ ...lessonPayload, weekday: 4, periodLabel: `Moved ${suffix}` })
      .expect(200);
    expect(moved.body.data.weekday).toBe(4);
    expect(moved.body.data.periodLabel).toBe(`Moved ${suffix}`);

    const cover = await request(app)
      .post("/api/v1/timetable/covers")
      .set(auth)
      .send({
        timetableSlotId: lesson.body.data.id,
        absentStaffId: reference.staff[0].id,
        coverStaffId: reference.staff[1].id,
        date: new Date(academicYear.startsOn).toISOString().slice(0, 10),
        status: "CONFIRMED",
        note: "Integration test cover",
      })
      .expect(201);

    await prisma.$transaction([
      prisma.auditEvent.deleteMany({ where: { entityId: { in: [lesson.body.data.id, cover.body.data.id] } } }),
      prisma.coverArrangement.delete({ where: { id: cover.body.data.id } }),
      prisma.timetableSlot.delete({ where: { id: lesson.body.data.id } }),
    ]);
  });
});
