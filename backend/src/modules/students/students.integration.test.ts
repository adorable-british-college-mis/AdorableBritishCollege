import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../app.js";

const prisma = new PrismaClient();

afterAll(async () => prisma.$disconnect());

describe("student enrolment", () => {
  it("saves a complete student and assigns an admission number", async () => {
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@abc.test", password: "ChangeMe123!" })
      .expect(200);
    const token = login.body.data.accessToken as string;
    const reference = await request(app)
      .get("/api/v1/academics/reference")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const academicYear = reference.body.data.academicYears.find((item: { isCurrent: boolean }) => item.isCurrent);
    const yearGroup = reference.body.data.yearGroups[0];

    const response = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${token}`)
      .send({
        admissionNumber: "",
        firstName: "Integration",
        lastName: "Student",
        dateOfBirth: "2014-04-15",
        gender: "FEMALE",
        nationality: "Nigerian",
        academicYearId: academicYear.id,
        yearGroupId: yearGroup.id,
        enrolmentDate: "2026-09-23",
        status: "ACTIVE",
        guardian: { firstName: "Integration", lastName: "Guardian", relationship: "Guardian" },
      })
      .expect(201);

    const studentId = response.body.data.id as string;
    expect(response.body.data.admissionNumber).toMatch(/^ABC-26\d{3}$/);
    expect(await prisma.student.findUnique({ where: { id: studentId } })).toMatchObject({
      firstName: "Integration",
      lastName: "Student",
    });

    const duplicate = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${token}`)
      .send({
        admissionNumber: response.body.data.admissionNumber,
        firstName: "Duplicate",
        lastName: "Student",
        dateOfBirth: "2014-04-15",
        gender: "MALE",
        nationality: "Nigerian",
        academicYearId: academicYear.id,
        yearGroupId: yearGroup.id,
        enrolmentDate: "2026-09-23",
        status: "ACTIVE",
        guardian: { firstName: "Duplicate", lastName: "Guardian", relationship: "Guardian" },
      })
      .expect(409);
    expect(duplicate.body.error.message).toContain("already in use");

    const updated = await request(app)
      .patch(`/api/v1/students/${studentId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        admissionNumber: response.body.data.admissionNumber,
        firstName: "Integration",
        lastName: "Student Updated",
        dateOfBirth: "2014-04-15",
        gender: "FEMALE",
        nationality: "British Nigerian",
        phone: "+2348000000002",
        academicYearId: academicYear.id,
        yearGroupId: yearGroup.id,
        enrolmentDate: "2026-09-23",
        status: "ACTIVE",
        guardian: { firstName: "Updated", lastName: "Guardian", relationship: "Mother", phone: "+2348000000003" },
      })
      .expect(200);
    expect(updated.body.data.lastName).toBe("Student Updated");
    const detail = await request(app).get(`/api/v1/students/${studentId}`).set("Authorization", `Bearer ${token}`).expect(200);
    expect(detail.body.data.guardians[0].guardian.firstName).toBe("Updated");

    const links = await prisma.studentGuardian.findMany({ where: { studentId }, select: { guardianId: true } });
    await prisma.$transaction([
      prisma.auditEvent.deleteMany({ where: { entityType: "Student", entityId: studentId } }),
      prisma.behaviourSanction.deleteMany({ where: { studentId } }),
      prisma.behaviourReward.deleteMany({ where: { studentId } }),
      prisma.behaviourEvent.deleteMany({ where: { studentId } }),
      prisma.attendanceRecord.deleteMany({ where: { studentId } }),
      prisma.assessmentResult.deleteMany({ where: { studentId } }),
      prisma.staffStudentAssignment.deleteMany({ where: { studentId } }),
      prisma.studentGuardian.deleteMany({ where: { studentId } }),
      prisma.enrollment.deleteMany({ where: { studentId } }),
      prisma.student.delete({ where: { id: studentId } }),
      prisma.parentGuardian.deleteMany({ where: { id: { in: links.map((link) => link.guardianId) } } }),
    ]);
  });
});
