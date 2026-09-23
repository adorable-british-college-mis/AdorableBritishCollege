import type { Prisma } from "@prisma/client";
import { AppError } from "../../common/errors.js";
import { prisma } from "../../db/prisma.js";
import { resolveStudentScope, type StudentScopeContext } from "../../security/student-scope.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import type { z } from "zod";
import type { createStudentSchema, studentListSchema } from "./student.schemas.js";

type ListInput = z.infer<typeof studentListSchema>;
type CreateInput = z.infer<typeof createStudentSchema>;

const studentSelect = {
  id: true,
  admissionNumber: true,
  firstName: true,
  middleName: true,
  lastName: true,
  preferredName: true,
  dateOfBirth: true,
  gender: true,
  nationality: true,
  title: true,
  email: true,
  phone: true,
  addressLine1: true,
  addressLine2: true,
  townCity: true,
  postcode: true,
  photoUrl: true,
  status: true,
  createdAt: true,
  archivedAt: true,
  enrollments: {
    where: { endsOn: null },
    take: 1,
    select: {
      startsOn: true,
      yearGroup: { select: { id: true, code: true, name: true } },
      formGroup: { select: { id: true, code: true, name: true } },
      house: { select: { id: true, code: true, name: true } },
    },
  },
  attendanceRecords: { select: { status: true } },
} satisfies Prisma.StudentSelect;

function withAttendance<T extends { attendanceRecords: Array<{ status: string }> }>(student: T) {
  const { attendanceRecords, ...record } = student;
  const attendancePercentage = attendanceRecords.length
    ? Math.round(attendanceRecords.filter((item) => item.status === "PRESENT").length / attendanceRecords.length * 1000) / 10
    : null;
  return { ...record, attendancePercentage };
}

function scopeWhere(context: StudentScopeContext): Prisma.StudentWhereInput {
  const scope = resolveStudentScope(context);
  switch (scope.mode) {
    case "all": return {};
    case "self": return { userId: scope.userId };
    case "guardian": return { guardians: { some: { guardian: { userId: scope.userId }, hasPortalAccess: true } } };
    case "assigned": return {
      staffAssignments: {
        some: {
          staff: { userId: scope.userId },
          startsOn: { lte: new Date() },
          OR: [{ endsOn: null }, { endsOn: { gte: new Date() } }],
        },
      },
    };
    case "none": return { id: "00000000-0000-0000-0000-000000000000" };
  }
}

async function generateAdmissionNumber(tx: Prisma.TransactionClient) {
  const year = String(new Date().getFullYear()).slice(-2);
  const prefix = `ABC-${year}`;
  const existing = await tx.student.findMany({
    where: { admissionNumber: { startsWith: prefix } },
    select: { admissionNumber: true },
  });
  const highest = existing.reduce((maximum, student) => {
    const suffix = Number(student.admissionNumber.slice(prefix.length));
    return Number.isInteger(suffix) ? Math.max(maximum, suffix) : maximum;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, "0")}`;
}

export async function listStudents(input: ListInput, context: StudentScopeContext) {
  const where: Prisma.StudentWhereInput = {
    AND: [
      scopeWhere(context),
      input.status ? { status: input.status } : { archivedAt: null },
      input.yearGroupId ? { enrollments: { some: { yearGroupId: input.yearGroupId, endsOn: null } } } : {},
      input.formGroupId ? { enrollments: { some: { formGroupId: input.formGroupId, endsOn: null } } } : {},
      input.houseId ? { enrollments: { some: { houseId: input.houseId, endsOn: null } } } : {},
      input.search ? {
        OR: [
          { admissionNumber: { contains: input.search, mode: "insensitive" } },
          { firstName: { contains: input.search, mode: "insensitive" } },
          { lastName: { contains: input.search, mode: "insensitive" } },
        ],
      } : {},
    ],
  };
  const [items, total] = await prisma.$transaction([
    prisma.student.findMany({
      where,
      select: studentSelect,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.student.count({ where }),
  ]);
  return { items: items.map(withAttendance), pagination: { page: input.page, pageSize: input.pageSize, total, pages: Math.ceil(total / input.pageSize) } };
}

export async function getStudent(studentId: string, context: StudentScopeContext) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, AND: [scopeWhere(context)] },
    select: { ...studentSelect, guardians: { select: { relationship: true, isPrimaryContact: true, guardian: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } } } },
  });
  if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "The student was not found or is outside your permitted scope.");
  return withAttendance(student);
}

export async function createStudent(input: CreateInput, actor: StudentScopeContext, requestId: string) {
  if (!actor.permissions.includes("students.create")) throw new AppError(403, "FORBIDDEN", "You cannot create students.");
  const formGroup = input.formGroupId ? await prisma.formGroup.findUnique({ where: { id: input.formGroupId }, select: { yearGroupId: true, isActive: true } }) : null;
  if (formGroup && (!formGroup.isActive || formGroup.yearGroupId !== input.yearGroupId)) throw new AppError(400, "INVALID_FORM_GROUP", "The selected form does not belong to the selected year group.");
  const student = await prisma.$transaction(async (tx) => {
    // Serialise number allocation so concurrent enrolments cannot receive the same identifier.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('abc-student-admission-number'))`;
    const admissionNumber = input.admissionNumber || await generateAdmissionNumber(tx);
    if (input.admissionNumber && await tx.student.findUnique({ where: { admissionNumber }, select: { id: true } })) {
      throw new AppError(409, "ADMISSION_NUMBER_EXISTS", "That admission number is already in use. Leave the field blank to generate the next number automatically.");
    }
    const created = await tx.student.create({
      data: {
        admissionNumber,
        title: input.title || null,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
        gender: input.gender,
        status: input.status,
        middleName: input.middleName || null,
        preferredName: input.preferredName || null,
        nationality: input.nationality || null,
        email: input.email || null,
        phone: input.phone || null,
        addressLine1: input.addressLine1 || null,
        addressLine2: input.addressLine2 || null,
        townCity: input.townCity || null,
        postcode: input.postcode || null,
        enrollments: { create: {
          yearGroupId: input.yearGroupId,
          academicYearId: input.academicYearId,
          formGroupId: input.formGroupId || null,
          houseId: input.houseId || null,
          startsOn: new Date(`${input.enrolmentDate}T00:00:00.000Z`),
        } },
      },
      select: studentSelect,
    });
    const guardian = await tx.parentGuardian.create({
      data: { firstName: input.guardian.firstName, lastName: input.guardian.lastName, email: input.guardian.email || null, phone: input.guardian.phone || null },
    });
    await tx.studentGuardian.create({
      data: { studentId: created.id, guardianId: guardian.id, relationship: input.guardian.relationship, isPrimaryContact: true, hasPortalAccess: true, hasParentalResponsibility: true },
    });
    return created;
  });
  await recordAuditEvent({ actorUserId: actor.userId, action: "student.create", entityType: "Student", entityId: student.id, requestId, after: student as unknown as Prisma.InputJsonValue });
  return withAttendance(student);
}

export async function archiveStudent(studentId: string, actor: StudentScopeContext, requestId: string) {
  if (!actor.permissions.includes("students.archive")) throw new AppError(403, "FORBIDDEN", "You cannot archive students.");
  const existing = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, status: true, archivedAt: true } });
  if (!existing) throw new AppError(404, "STUDENT_NOT_FOUND", "The student was not found.");
  const archived = await prisma.student.update({ where: { id: studentId }, data: { status: "ARCHIVED", archivedAt: new Date() }, select: studentSelect });
  await recordAuditEvent({ actorUserId: actor.userId, action: "student.archive", entityType: "Student", entityId: studentId, requestId, before: existing, after: { status: archived.status, archivedAt: archived.archivedAt } });
  return archived;
}

export async function getStudentStats(context: StudentScopeContext) {
  const scope = scopeWhere(context);
  const [active, applicants, archived, total] = await prisma.$transaction([
    prisma.student.count({ where: { AND: [scope, { status: "ACTIVE" }] } }),
    prisma.student.count({ where: { AND: [scope, { status: "APPLICANT" }] } }),
    prisma.student.count({ where: { AND: [scope, { status: "ARCHIVED" }] } }),
    prisma.student.count({ where: scope }),
  ]);
  return { active, applicants, archived, total };
}
