import type { Prisma } from "@prisma/client";
import { AppError } from "../../common/errors.js";
import { prisma } from "../../db/prisma.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import type { z } from "zod";
import type { createCoverSchema, createLessonSchema } from "./timetable.schemas.js";

type LessonInput = z.infer<typeof createLessonSchema>;
type CoverInput = z.infer<typeof createCoverSchema>;
type Actor = { userId: string };
const startOfDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const overlaps = (a: { startsAt: string; endsAt: string }, b: { startsAt: string; endsAt: string }) => a.startsAt < b.endsAt && b.startsAt < a.endsAt;

const slotInclude = {
  term: { select: { id: true, name: true } },
  yearGroup: { select: { id: true, name: true, displayOrder: true } },
  formGroup: { select: { id: true, code: true, name: true } },
  subject: { select: { id: true, code: true, name: true, department: true } },
  staff: { select: { id: true, staffNumber: true, firstName: true, lastName: true } },
} satisfies Prisma.TimetableSlotInclude;

function clashReasons(candidate: LessonInput, existing: Array<{ room: string | null; staffId: string | null; formGroupId: string | null; yearGroupId: string; startsAt: string; endsAt: string }>) {
  const reasons = new Set<string>();
  existing.filter((slot) => overlaps(candidate, slot)).forEach((slot) => {
    if (candidate.room && slot.room?.toLowerCase() === candidate.room.toLowerCase()) reasons.add(`Room ${candidate.room} is already in use.`);
    if (candidate.staffId && slot.staffId === candidate.staffId) reasons.add("The selected teacher is already teaching another lesson.");
    if (candidate.formGroupId ? slot.formGroupId === candidate.formGroupId : !slot.formGroupId && slot.yearGroupId === candidate.yearGroupId) reasons.add("The selected class already has a lesson at this time.");
  });
  return [...reasons];
}

export async function getTimetableOverview() {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const academicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true }, include: { terms: { orderBy: { startsOn: "asc" } } }, orderBy: { startsOn: "desc" } })
    ?? await prisma.academicYear.findFirst({ include: { terms: { orderBy: { startsOn: "asc" } } }, orderBy: { startsOn: "desc" } });
  const currentTerm = academicYear?.terms.find((term) => term.startsOn <= now && term.endsOn >= now) ?? academicYear?.terms[0] ?? null;
  const [slots, covers, yearGroups, formGroups, subjects, staff] = await Promise.all([
    currentTerm ? prisma.timetableSlot.findMany({ where: { termId: currentTerm.id }, include: slotInclude, orderBy: [{ weekday: "asc" }, { startsAt: "asc" }] }) : Promise.resolve([]),
    prisma.coverArrangement.findMany({ where: { date: { gte: today } }, include: { timetableSlot: { include: slotInclude }, absentStaff: { select: { id: true, firstName: true, lastName: true } }, coverStaff: { select: { id: true, firstName: true, lastName: true } } }, orderBy: [{ date: "asc" }, { timetableSlot: { startsAt: "asc" } }], take: 8 }),
    prisma.yearGroup.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.formGroup.findMany({ where: { isActive: true, archivedAt: null, AND: [{ OR: [{ curriculumId: null }, { curriculum: { isActive: true, archivedAt: null } }] }, { OR: [{ departmentId: null }, { department: { isActive: true, archivedAt: null } }] }] }, include: { yearGroup: { select: { id: true, name: true } } }, orderBy: [{ yearGroup: { displayOrder: "asc" } }, { name: "asc" }] }),
    prisma.subject.findMany({ where: { isActive: true, archivedAt: null, OR: [{ departmentId: null }, { academicDepartment: { isActive: true, archivedAt: null } }] }, orderBy: { name: "asc" } }),
    prisma.staff.findMany({ where: { status: "ACTIVE", archivedAt: null, OR: [{ departmentId: null }, { academicDepartment: { isActive: true, archivedAt: null } }] }, select: { id: true, staffNumber: true, firstName: true, lastName: true, jobTitle: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
  ]);
  let conflicts = 0;
  slots.forEach((slot, index) => slots.slice(index + 1).forEach((other) => {
    if (slot.weekday !== other.weekday || !overlaps(slot, other)) return;
    if ((slot.room && other.room && slot.room.toLowerCase() === other.room.toLowerCase()) || (slot.staffId && slot.staffId === other.staffId) || (slot.formGroupId && slot.formGroupId === other.formGroupId)) conflicts += 1;
  }));
  const periods = [...new Map(slots.map((slot) => [`${slot.startsAt}-${slot.endsAt}`, { label: slot.periodLabel, startsAt: slot.startsAt, endsAt: slot.endsAt }])).values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const todayWeekday = now.getDay();
  return {
    academicYear, currentTerm, slots, periods, covers,
    metrics: { totalClasses: slots.length, roomsAssigned: new Set(slots.map((slot) => slot.room).filter(Boolean)).size, coverLessonsToday: covers.filter((cover) => cover.date >= today && cover.date < tomorrow).length, conflicts },
    todaySchedule: slots.filter((slot) => slot.weekday === todayWeekday),
    reference: { yearGroups, formGroups, subjects, staff },
  };
}

async function validateAcademicSelection(input: LessonInput) {
  const [term, group, subject, staff] = await Promise.all([
    prisma.term.findUnique({ where: { id: input.termId }, select: { academicYearId: true } }),
    input.formGroupId ? prisma.formGroup.findFirst({ where: { id: input.formGroupId, isActive: true, archivedAt: null, AND: [{ OR: [{ curriculumId: null }, { curriculum: { isActive: true, archivedAt: null } }] }, { OR: [{ departmentId: null }, { department: { isActive: true, archivedAt: null } }] }] }, select: { id: true, yearGroupId: true, departmentId: true } }) : null,
    prisma.subject.findFirst({ where: { id: input.subjectId, isActive: true, archivedAt: null }, select: { id: true, departmentId: true } }),
    input.staffId ? prisma.staff.findFirst({ where: { id: input.staffId, status: "ACTIVE", archivedAt: null }, select: { id: true } }) : null,
  ]);
  if (!term) throw new AppError(400, "INVALID_TERM", "The selected term is unavailable.");
  if (!subject) throw new AppError(400, "SUBJECT_UNAVAILABLE", "The selected subject is archived or unavailable.");
  if (input.formGroupId && (!group || group.yearGroupId !== input.yearGroupId)) throw new AppError(400, "INVALID_CLASS", "The selected class does not belong to the selected year group.");
  if (input.staffId && !staff) throw new AppError(400, "TEACHER_UNAVAILABLE", "The selected teacher is archived or unavailable.");
  if (group && staff) {
    const mapped = await prisma.curriculumSubject.findFirst({ where: { academicYearId: term.academicYearId, yearGroupId: group.yearGroupId, subjectId: subject.id, isActive: true, archivedAt: null } });
    if (!mapped) throw new AppError(400, "SUBJECT_NOT_IN_CURRICULUM", "Assign this subject to the class curriculum before scheduling it.");
    await prisma.teachingAssignment.upsert({ where: { academicYearId_formGroupId_subjectId: { academicYearId: term.academicYearId, formGroupId: group.id, subjectId: subject.id } }, update: { staffId: staff.id, departmentId: subject.departmentId ?? group.departmentId, isActive: true, archivedAt: null }, create: { academicYearId: term.academicYearId, formGroupId: group.id, subjectId: subject.id, staffId: staff.id, departmentId: subject.departmentId ?? group.departmentId } });
  }
}

export async function createLesson(input: LessonInput, actor: Actor, requestId: string) {
  await validateAcademicSelection(input);
  const sameDay = await prisma.timetableSlot.findMany({ where: { termId: input.termId, weekday: input.weekday }, select: { room: true, staffId: true, formGroupId: true, yearGroupId: true, startsAt: true, endsAt: true } });
  const reasons = clashReasons(input, sameDay);
  if (reasons.length) throw new AppError(409, "TIMETABLE_CONFLICT", "This lesson conflicts with the existing timetable.", reasons);
  const record = await prisma.timetableSlot.create({ data: { ...input, formGroupId: input.formGroupId || null, staffId: input.staffId || null, room: input.room || null }, include: slotInclude });
  await recordAuditEvent({ actorUserId: actor.userId, action: "timetable.lesson.create", entityType: "TimetableSlot", entityId: record.id, requestId, after: record as unknown as Prisma.InputJsonValue });
  return record;
}

export async function updateLesson(lessonId: string, input: LessonInput, actor: Actor, requestId: string) {
  const existing = await prisma.timetableSlot.findUnique({ where: { id: lessonId }, include: slotInclude });
  if (!existing) throw new AppError(404, "LESSON_NOT_FOUND", "The selected lesson was not found.");
  await validateAcademicSelection(input);
  const sameDay = await prisma.timetableSlot.findMany({ where: { termId: input.termId, weekday: input.weekday, id: { not: lessonId } }, select: { room: true, staffId: true, formGroupId: true, yearGroupId: true, startsAt: true, endsAt: true } });
  const reasons = clashReasons(input, sameDay);
  if (reasons.length) throw new AppError(409, "TIMETABLE_CONFLICT", "This lesson conflicts with the existing timetable.", reasons);
  const record = await prisma.timetableSlot.update({ where: { id: lessonId }, data: { ...input, formGroupId: input.formGroupId || null, staffId: input.staffId || null, room: input.room || null }, include: slotInclude });
  await recordAuditEvent({ actorUserId: actor.userId, action: "timetable.lesson.update", entityType: "TimetableSlot", entityId: lessonId, requestId, before: existing as unknown as Prisma.InputJsonValue, after: record as unknown as Prisma.InputJsonValue });
  return record;
}

export async function createCover(input: CoverInput, actor: Actor, requestId: string) {
  const slot = await prisma.timetableSlot.findUnique({ where: { id: input.timetableSlotId }, select: { staffId: true } });
  if (!slot) throw new AppError(404, "LESSON_NOT_FOUND", "The selected lesson was not found.");
  if (slot.staffId && slot.staffId !== input.absentStaffId) throw new AppError(400, "ABSENT_TEACHER_MISMATCH", "The absent teacher must be assigned to the selected lesson.");
  if (input.coverStaffId && input.coverStaffId === input.absentStaffId) throw new AppError(400, "INVALID_COVER_TEACHER", "The absent teacher cannot cover their own lesson.");
  const record = await prisma.coverArrangement.upsert({ where: { timetableSlotId_date: { timetableSlotId: input.timetableSlotId, date: new Date(`${input.date}T00:00:00.000Z`) } }, update: { absentStaffId: input.absentStaffId, coverStaffId: input.coverStaffId || null, status: input.status, note: input.note || null }, create: { timetableSlotId: input.timetableSlotId, absentStaffId: input.absentStaffId, coverStaffId: input.coverStaffId || null, date: new Date(`${input.date}T00:00:00.000Z`), status: input.status, note: input.note || null } });
  await recordAuditEvent({ actorUserId: actor.userId, action: "timetable.cover.save", entityType: "CoverArrangement", entityId: record.id, requestId, after: record as unknown as Prisma.InputJsonValue });
  return record;
}
