import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../app.js";

const prisma = new PrismaClient();
afterAll(async () => prisma.$disconnect());

describe("academic workspace", () => {
  it("manages and archives linked academic records without deleting history", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email: "admin@abc.test", password: "ChangeMe123!" }).expect(200);
    const auth = { Authorization: `Bearer ${login.body.data.accessToken as string}` };
    const reference = await request(app).get("/api/v1/academics/reference").set(auth).expect(200);
    const academicYear = reference.body.data.academicYears.find((item: { isCurrent: boolean }) => item.isCurrent);
    const yearGroup = reference.body.data.yearGroups[0];
    const term = academicYear.terms[0];
    const suffix = Date.now().toString().slice(-7);

    const department = await request(app).post("/api/v1/academics/departments").set(auth).send({ code: `Q${suffix}`, name: `Quality ${suffix}`, description: "Integration test department" }).expect(201);
    const subject = await request(app).post("/api/v1/academics/subjects").set(auth).send({ code: `S${suffix}`, name: `Assurance ${suffix}`, departmentId: department.body.data.id }).expect(201);
    const teacher = await request(app).post("/api/v1/academics/teachers").set(auth).send({ staffNumber: `QA-${suffix}`, firstName: "Quality", lastName: "Teacher", jobTitle: "Teacher", departmentId: department.body.data.id }).expect(201);
    const curriculum = await request(app).post("/api/v1/academics/curricula").set(auth).send({ code: `CUR-${suffix}`, name: `QA Curriculum ${suffix}`, academicYearId: academicYear.id, yearGroupId: yearGroup.id, subjectIds: [subject.body.data.id] }).expect(201);
    const formGroup = await request(app).post("/api/v1/academics/classes").set(auth).send({ code: `C${suffix}`, name: `QA Class ${suffix}`, yearGroupId: yearGroup.id, tutorStaffId: teacher.body.data.id, curriculumId: curriculum.body.data.id, departmentId: department.body.data.id }).expect(201);
    const assignment = await request(app).post("/api/v1/academics/teaching-assignments").set(auth).send({ academicYearId: academicYear.id, formGroupId: formGroup.body.data.id, subjectId: subject.body.data.id, staffId: teacher.body.data.id, departmentId: department.body.data.id }).expect(201);
    const dueAt = new Date(Math.max(new Date(term.startsOn).getTime(), Date.now()) + 86_400_000);
    if (dueAt > new Date(term.endsOn)) dueAt.setTime(new Date(term.endsOn).getTime() - 86_400_000);
    const assessment = await request(app).post("/api/v1/academics/assessment-plans").set(auth).send({ title: `QA Assessment ${suffix}`, termId: term.id, yearGroupId: yearGroup.id, subjectId: subject.body.data.id, dueAt: dueAt.toISOString() }).expect(201);

    await request(app).patch(`/api/v1/academics/subjects/${subject.body.data.id}`).set(auth).send({ name: `Updated Assurance ${suffix}` }).expect(200);
    await request(app).patch(`/api/v1/academics/classes/${formGroup.body.data.id}`).set(auth).send({ name: `Updated QA Class ${suffix}` }).expect(200);
    await request(app).patch(`/api/v1/academics/teachers/${teacher.body.data.id}`).set(auth).send({ jobTitle: "Lead Teacher" }).expect(200);
    await request(app).patch(`/api/v1/academics/departments/${department.body.data.id}`).set(auth).send({ description: "Updated description" }).expect(200);

    const overview = await request(app).get("/api/v1/academics/overview").set(auth).expect(200);
    expect(overview.body.data.teachingAssignments.some((item: { id: string }) => item.id === assignment.body.data.id)).toBe(true);
    expect(overview.body.data.curricula.some((item: { id: string }) => item.id === curriculum.body.data.id)).toBe(true);

    await request(app).post(`/api/v1/academics/subjects/${subject.body.data.id}/archive`).set(auth).expect(200);
    const activeReference = await request(app).get("/api/v1/academics/reference").set(auth).expect(200);
    expect(activeReference.body.data.subjects.some((item: { id: string }) => item.id === subject.body.data.id)).toBe(false);
    expect(await prisma.subject.findUnique({ where: { id: subject.body.data.id } })).not.toBeNull();

    const entityIds = [department.body.data.id, subject.body.data.id, teacher.body.data.id, curriculum.body.data.id, formGroup.body.data.id, assignment.body.data.id, assessment.body.data.id];
    await prisma.$transaction([
      prisma.auditEvent.deleteMany({ where: { entityId: { in: entityIds } } }),
      prisma.assessment.delete({ where: { id: assessment.body.data.id } }),
      prisma.teachingAssignment.deleteMany({ where: { subjectId: subject.body.data.id } }),
      prisma.formGroup.delete({ where: { id: formGroup.body.data.id } }),
      prisma.curriculumSubject.deleteMany({ where: { curriculumId: curriculum.body.data.id } }),
      prisma.curriculum.delete({ where: { id: curriculum.body.data.id } }),
      prisma.staff.delete({ where: { id: teacher.body.data.id } }),
      prisma.subject.delete({ where: { id: subject.body.data.id } }),
      prisma.department.delete({ where: { id: department.body.data.id } }),
    ]);
  });
});
