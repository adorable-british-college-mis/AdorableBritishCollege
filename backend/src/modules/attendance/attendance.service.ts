import type { AttendanceStatus, Prisma } from "@prisma/client";
import type { z } from "zod";
import { AppError } from "../../common/errors.js";
import { prisma } from "../../db/prisma.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import type { openRegisterSchema, saveRegisterSchema } from "./attendance.schemas.js";

type Actor = { userId: string };
type OpenInput = z.infer<typeof openRegisterSchema>;
type SaveInput = z.infer<typeof saveRegisterSchema>;
const day = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00.000Z`) : value;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};
const addDays = (value: Date, count: number) => new Date(value.getTime() + count * 86_400_000);
const presentCodes: AttendanceStatus[] = ["PRESENT", "LATE"];

const registerInclude = {
  term: { select: { id: true, name: true } },
  yearGroup: { select: { id: true, name: true, displayOrder: true } },
  formGroup: { select: { id: true, code: true, name: true } },
  teacher: { select: { id: true, firstName: true, lastName: true } },
  timetableSlot: { include: {
    subject: { select: { id: true, name: true } },
    staff: { select: { id: true, firstName: true, lastName: true } },
  } },
  records: { select: { id: true, studentId: true, status: true, note: true, markedAt: true } },
} satisfies Prisma.AttendanceRegisterInclude;

function percentage(records: Array<{ status: AttendanceStatus }>) {
  return records.length ? Math.round(records.filter((row) => presentCodes.includes(row.status)).length / records.length * 1000) / 10 : null;
}

export async function getAttendanceOverview() {
  const now = new Date();
  const today = day(now);
  const academicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true }, include: { terms: { orderBy: { startsOn: "asc" } } }, orderBy: { startsOn: "desc" } })
    ?? await prisma.academicYear.findFirst({ include: { terms: { orderBy: { startsOn: "asc" } } }, orderBy: { startsOn: "desc" } });
  const term = academicYear?.terms.find((item) => item.startsOn <= now && item.endsOn >= now) ?? academicYear?.terms[0] ?? null;
  if (!term) return { academicYear, currentTerm: null, metrics: { present: 0, absent: 0, late: 0, unauthorised: 0, rate: null }, registers: [], byYearGroup: [], week: [], alerts: [], availableLessons: [], exceptions: [] };

  const monday = addDays(today, -((today.getUTCDay() + 6) % 7));
  const [registers, weekRecords, yearGroups, lessons, students, exceptionRecords] = await Promise.all([
    prisma.attendanceRegister.findMany({ where: { termId: term.id, date: today }, include: registerInclude, orderBy: [{ periodLabel: "asc" }, { yearGroup: { displayOrder: "asc" } }] }),
    prisma.attendanceRecord.findMany({ where: { register: { termId: term.id, date: { gte: monday, lt: addDays(monday, 5) } } }, select: { status: true, register: { select: { date: true, yearGroupId: true } } } }),
    prisma.yearGroup.findMany({ where: { code: { in: ["Y7", "Y8", "Y9", "Y10", "Y11", "Y12"] } }, orderBy: { displayOrder: "asc" } }),
    prisma.timetableSlot.findMany({ where: { termId: term.id, weekday: now.getUTCDay() || 1, subject: { isActive: true, archivedAt: null }, OR: [{ formGroupId: null }, { formGroup: { isActive: true, archivedAt: null } }], AND: [{ OR: [{ staffId: null }, { staff: { status: "ACTIVE", archivedAt: null } }] }] }, include: { yearGroup: true, formGroup: true, subject: true, staff: true }, orderBy: { startsAt: "asc" } }),
    prisma.student.findMany({ where: { status: "ACTIVE", enrollments: { some: { academicYearId: academicYear!.id } } }, select: { id: true, firstName: true, lastName: true, enrollments: { where: { academicYearId: academicYear!.id }, select: { yearGroupId: true } } } }),
    prisma.attendanceRecord.findMany({
      where: { register: { termId: term.id }, status: { in: ["LATE", "ABSENT", "AUTHORISED_ABSENCE", "UNAUTHORISED_ABSENCE", "MEDICAL"] } },
      select: {
        id: true, status: true, note: true, markedAt: true,
        student: { select: { id: true, admissionNumber: true, firstName: true, lastName: true } },
        register: { select: { date: true, periodLabel: true, yearGroup: { select: { name: true } }, formGroup: { select: { code: true } }, timetableSlot: { select: { subject: { select: { name: true } } } } } },
      },
      orderBy: { markedAt: "desc" },
      take: 250,
    }),
  ]);
  const allToday = registers.flatMap((register) => register.records);
  const count = (status: AttendanceStatus) => allToday.filter((record) => record.status === status).length;
  const virtualRegisters = lessons.map((lesson) => {
    const existing = registers.find((register) => register.timetableSlotId === lesson.id);
    const studentCount = students.filter((student) => student.enrollments.some((enrolment) => enrolment.yearGroupId === lesson.yearGroupId)).length;
    return existing ?? { id: null, termId: term.id, yearGroupId: lesson.yearGroupId, formGroupId: lesson.formGroupId, timetableSlotId: lesson.id, teacherId: lesson.staffId, date: today, periodLabel: lesson.periodLabel, registerType: "LESSON", status: "OPEN", submittedAt: null, createdAt: today, updatedAt: today, term: { id: term.id, name: term.name }, yearGroup: lesson.yearGroup, formGroup: lesson.formGroup, teacher: lesson.staff, timetableSlot: lesson, records: [], studentCount };
  });
  const week = Array.from({ length: 5 }, (_, index) => {
    const date = addDays(monday, index);
    const rows = weekRecords.filter((row) => day(row.register.date).getTime() === date.getTime());
    return { date: date.toISOString(), label: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(date), percentage: percentage(rows) };
  });
  const byYearGroup = yearGroups.map((group) => ({ id: group.id, name: group.name, percentage: percentage(weekRecords.filter((row) => row.register.yearGroupId === group.id)) }));
  const absenceCounts = new Map<string, number>();
  for (const record of await prisma.attendanceRecord.findMany({ where: { status: { in: ["ABSENT", "UNAUTHORISED_ABSENCE"] }, register: { termId: term.id } }, select: { studentId: true } })) absenceCounts.set(record.studentId, (absenceCounts.get(record.studentId) ?? 0) + 1);
  const alertIds = [...absenceCounts.entries()].filter(([, total]) => total >= 2).map(([id]) => id);
  const alertStudents = await prisma.student.findMany({ where: { id: { in: alertIds } }, select: { id: true, firstName: true, lastName: true, enrollments: { where: { academicYearId: academicYear!.id }, select: { yearGroup: { select: { name: true } } } } } });
  return {
    academicYear, currentTerm: term,
    metrics: { present: count("PRESENT"), absent: count("ABSENT") + count("AUTHORISED_ABSENCE") + count("UNAUTHORISED_ABSENCE") + count("MEDICAL"), late: count("LATE"), unauthorised: count("UNAUTHORISED_ABSENCE"), rate: percentage(allToday) },
    registers: virtualRegisters,
    byYearGroup, week,
    alerts: alertStudents.map((student) => ({ id: student.id, name: `${student.firstName} ${student.lastName}`, yearGroup: student.enrollments[0]?.yearGroup.name ?? "Unassigned", absences: absenceCounts.get(student.id) ?? 0 })),
    availableLessons: lessons,
    exceptions: exceptionRecords.map((record) => ({
      id: record.id,
      status: record.status,
      note: record.note,
      markedAt: record.markedAt,
      date: record.register.date,
      periodLabel: record.register.periodLabel,
      className: record.register.formGroup?.code ?? record.register.yearGroup.name,
      subject: record.register.timetableSlot?.subject.name ?? "General register",
      student: record.student,
    })),
  };
}

export async function openRegister(input: OpenInput, actor: Actor, requestId: string) {
  const date = day(input.date);
  const slot = await prisma.timetableSlot.findUnique({ where: { id: input.timetableSlotId }, include: { term: true, subject: true, formGroup: true, staff: true } });
  if (!slot) throw new AppError(404, "LESSON_NOT_FOUND", "The selected lesson could not be found.");
  if (!slot.subject.isActive || slot.subject.archivedAt || (slot.formGroup && (!slot.formGroup.isActive || slot.formGroup.archivedAt)) || (slot.staff && (slot.staff.status !== "ACTIVE" || slot.staff.archivedAt))) throw new AppError(400, "ACADEMIC_SETUP_UNAVAILABLE", "The class, subject, or assigned teacher is archived and cannot be used for a new register.");
  let register = await prisma.attendanceRegister.findFirst({ where: { timetableSlotId: slot.id, date } });
  if (!register) register = await prisma.attendanceRegister.create({ data: { termId: slot.termId, yearGroupId: slot.yearGroupId, formGroupId: slot.formGroupId, timetableSlotId: slot.id, teacherId: slot.staffId, date, periodLabel: slot.periodLabel, registerType: "LESSON" } });
  await recordAuditEvent({ actorUserId: actor.userId, action: "attendance.register.open", entityType: "AttendanceRegister", entityId: register.id, requestId });
  return getRegister(register.id);
}

export async function getRegister(id: string) {
  const register = await prisma.attendanceRegister.findUnique({ where: { id }, include: registerInclude });
  if (!register) throw new AppError(404, "REGISTER_NOT_FOUND", "Attendance register not found.");
  const academicYearId = (await prisma.term.findUniqueOrThrow({ where: { id: register.termId }, select: { academicYearId: true } })).academicYearId;
  const students = await prisma.student.findMany({ where: { status: "ACTIVE", enrollments: { some: { academicYearId, yearGroupId: register.yearGroupId, ...(register.formGroupId ? { OR: [{ formGroupId: register.formGroupId }, { formGroupId: null }] } : {}) } } }, select: { id: true, admissionNumber: true, firstName: true, lastName: true, preferredName: true, enrollments: { where: { academicYearId }, select: { yearGroup: { select: { name: true } }, formGroup: { select: { code: true } } } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
  const records = new Map(register.records.map((record) => [record.studentId, record]));
  return { ...register, students: students.map((student) => ({ ...student, attendance: records.get(student.id) ?? null })) };
}

async function persistRegister(id: string, input: SaveInput, submit: boolean, actor: Actor, requestId: string) {
  const existing = await prisma.attendanceRegister.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) throw new AppError(404, "REGISTER_NOT_FOUND", "Attendance register not found.");
  if (existing.status === "SUBMITTED") throw new AppError(409, "REGISTER_LOCKED", "This register has been submitted and is locked.");
  await prisma.$transaction(async (tx) => {
    for (const record of input.records) await tx.attendanceRecord.upsert({ where: { registerId_studentId: { registerId: id, studentId: record.studentId } }, update: { status: record.status, note: record.note || null, markedAt: new Date() }, create: { registerId: id, studentId: record.studentId, status: record.status, note: record.note || null } });
    await tx.attendanceRegister.update({ where: { id }, data: submit ? { status: "SUBMITTED", submittedAt: new Date() } : { status: "OPEN" } });
  });
  await recordAuditEvent({ actorUserId: actor.userId, action: submit ? "attendance.register.submit" : "attendance.register.draft", entityType: "AttendanceRegister", entityId: id, requestId, after: { marked: input.records.length } });
  return getRegister(id);
}

export const saveDraft = (id: string, input: SaveInput, actor: Actor, requestId: string) => persistRegister(id, input, false, actor, requestId);
export const submitRegister = (id: string, input: SaveInput, actor: Actor, requestId: string) => persistRegister(id, input, true, actor, requestId);
