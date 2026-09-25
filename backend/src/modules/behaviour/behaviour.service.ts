import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { AppError } from "../../common/errors.js";
import { prisma } from "../../db/prisma.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import type { behaviourCategorySchema, behaviourEventSchema, behaviourRewardSchema, behaviourSanctionSchema, updateBehaviourCategorySchema, updateBehaviourEventSchema, updateBehaviourRewardSchema, updateBehaviourSanctionSchema } from "./behaviour.schemas.js";

type Actor = { userId: string };
type CategoryInput = z.infer<typeof behaviourCategorySchema>;
type EventInput = z.infer<typeof behaviourEventSchema>;
type RewardInput = z.infer<typeof behaviourRewardSchema>;
type SanctionInput = z.infer<typeof behaviourSanctionSchema>;
const nullable = (value?: string) => value || null;
const includeStudent = { enrollments: { include: { academicYear: true, yearGroup: true, formGroup: true }, orderBy: { startsOn: "desc" as const } } };
const eventInclude = { student: { include: includeStudent }, term: { include: { academicYear: true } }, category: true, staff: true, formGroup: { include: { yearGroup: true } } } satisfies Prisma.BehaviourEventInclude;
const rewardInclude = { student: { include: includeStudent }, term: { include: { academicYear: true } }, staff: true } satisfies Prisma.BehaviourRewardInclude;
const sanctionInclude = { student: { include: includeStudent }, term: { include: { academicYear: true } }, staff: true, behaviourEvent: { include: { category: true } } } satisfies Prisma.BehaviourSanctionInclude;

async function audit(actor: Actor, requestId: string, action: string, entityType: string, entity: { id: string }) {
  await recordAuditEvent({ actorUserId: actor.userId, action, entityType, entityId: entity.id, requestId, after: entity as Prisma.InputJsonValue });
}

async function validateStudentTerm(studentId: string, termId: string) {
  const [student, term] = await Promise.all([
    prisma.student.findFirst({ where: { id: studentId, status: "ACTIVE", archivedAt: null } }),
    prisma.term.findUnique({ where: { id: termId }, include: { academicYear: true } }),
  ]);
  if (!student) throw new AppError(400, "STUDENT_UNAVAILABLE", "The selected student is archived or unavailable.");
  if (!term) throw new AppError(400, "TERM_UNAVAILABLE", "The selected term is unavailable.");
  const enrollment = await prisma.enrollment.findFirst({ where: { studentId, academicYearId: term.academicYearId, startsOn: { lte: term.endsOn }, OR: [{ endsOn: null }, { endsOn: { gte: term.startsOn } }] } });
  if (!enrollment) throw new AppError(400, "STUDENT_NOT_ENROLLED", "The selected student is not enrolled in this term's academic year.");
  return { student, term, enrollment };
}

async function validateStaff(staffId?: string) {
  if (!staffId) return null;
  const staff = await prisma.staff.findFirst({ where: { id: staffId, status: "ACTIVE", archivedAt: null } });
  if (!staff) throw new AppError(400, "STAFF_UNAVAILABLE", "The selected staff member is archived or unavailable.");
  return staff;
}

async function validateCategory(categoryId: string, type: EventInput["type"]) {
  const category = await prisma.behaviourCategory.findFirst({ where: { id: categoryId, type, isActive: true, archivedAt: null } });
  if (!category) throw new AppError(400, "CATEGORY_UNAVAILABLE", "Choose an active category that matches the event type.");
  return category;
}

function percentage(value: number, total: number) { return total ? Math.round(value / total * 1000) / 10 : 0; }

export async function getReference() {
  const academicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true }, include: { terms: { orderBy: { startsOn: "asc" } } }, orderBy: { startsOn: "desc" } }) ?? await prisma.academicYear.findFirst({ include: { terms: { orderBy: { startsOn: "asc" } } }, orderBy: { startsOn: "desc" } });
  const [students, staff, categories, incidentEvents] = await Promise.all([
    prisma.student.findMany({ where: { status: "ACTIVE", archivedAt: null, enrollments: academicYear ? { some: { academicYearId: academicYear.id, endsOn: null } } : undefined }, include: { enrollments: { where: academicYear ? { academicYearId: academicYear.id } : {}, include: { yearGroup: true, formGroup: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.staff.findMany({ where: { status: "ACTIVE", archivedAt: null }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.behaviourCategory.findMany({ where: { isActive: true, archivedAt: null }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
    prisma.behaviourEvent.findMany({ where: { type: "INCIDENT", archivedAt: null }, include: { student: true, category: true }, orderBy: { occurredAt: "desc" }, take: 100 }),
  ]);
  return { academicYear, students, staff, categories, incidentEvents };
}

export async function getOverview() {
  const reference = await getReference();
  const term = reference.academicYear?.terms.find((item) => item.startsOn <= new Date() && item.endsOn >= new Date()) ?? reference.academicYear?.terms[0] ?? null;
  const where = term ? { termId: term.id } : {};
  const [events, rewards, sanctions, categories] = await Promise.all([
    prisma.behaviourEvent.findMany({ where, include: eventInclude, orderBy: { occurredAt: "desc" }, take: 500 }),
    prisma.behaviourReward.findMany({ where, include: rewardInclude, orderBy: { awardedAt: "desc" }, take: 500 }),
    prisma.behaviourSanction.findMany({ where, include: sanctionInclude, orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }], take: 500 }),
    prisma.behaviourCategory.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }),
  ]);
  const activeEvents = events.filter((item) => !item.archivedAt);
  const activeRewards = rewards.filter((item) => !item.archivedAt && item.status === "AWARDED");
  const activeSanctions = sanctions.filter((item) => !item.archivedAt);
  const today = new Date(); const start = new Date(today); start.setHours(0, 0, 0, 0); const end = new Date(start); end.setDate(end.getDate() + 1);
  const todayEvents = activeEvents.filter((item) => item.occurredAt >= start && item.occurredAt < end);
  const yearMap = new Map<string, { id: string; name: string; order: number; positive: number; negative: number }>();
  for (const event of activeEvents) {
    const enrollment = event.student.enrollments.find((item) => item.academicYearId === term?.academicYearId) ?? event.student.enrollments[0];
    if (!enrollment) continue;
    const row = yearMap.get(enrollment.yearGroupId) ?? { id: enrollment.yearGroupId, name: enrollment.yearGroup.name, order: enrollment.yearGroup.displayOrder, positive: 0, negative: 0 };
    if (event.points >= 0) row.positive += event.points; else row.negative += Math.abs(event.points);
    yearMap.set(enrollment.yearGroupId, row);
  }
  const categoryMap = new Map<string, { id: string; name: string; type: string; count: number }>();
  for (const event of todayEvents) { const key = event.category?.id ?? event.summary; const row = categoryMap.get(key) ?? { id: key, name: event.category?.name ?? event.summary, type: event.type, count: 0 }; row.count += 1; categoryMap.set(key, row); }
  const monthMap = new Map<string, { month: string; positive: number; negative: number }>();
  for (const event of activeEvents) { const month = event.occurredAt.toISOString().slice(0, 7); const row = monthMap.get(month) ?? { month, positive: 0, negative: 0 }; if (event.type === "POSITIVE") row.positive += 1; else row.negative += 1; monthMap.set(month, row); }
  return {
    academicYear: reference.academicYear, term, events, rewards, sanctions, categories,
    metrics: {
      eventsToday: todayEvents.length,
      positivePoints: activeEvents.filter((item) => item.type === "POSITIVE").reduce((sum, item) => sum + Math.max(0, item.points), 0) + activeRewards.reduce((sum, item) => sum + item.points, 0),
      negativePoints: activeEvents.filter((item) => item.type === "INCIDENT").reduce((sum, item) => sum + Math.abs(Math.min(0, item.points)), 0),
      activeSanctions: activeSanctions.filter((item) => item.status === "ACTIVE" || item.status === "PENDING").length,
      detentionsToday: activeSanctions.filter((item) => item.type === "DETENTION" && item.scheduledFor && item.scheduledFor >= start && item.scheduledFor < end).length,
    },
    yearGroupBalance: [...yearMap.values()].sort((a, b) => a.order - b.order),
    topCategories: [...categoryMap.values()].sort((a, b) => b.count - a.count).slice(0, 6),
    reports: {
      totalEvents: activeEvents.length, positiveEvents: activeEvents.filter((item) => item.type === "POSITIVE").length,
      incidents: activeEvents.filter((item) => item.type === "INCIDENT").length,
      resolvedIncidents: activeEvents.filter((item) => item.type === "INCIDENT" && item.status === "RESOLVED").length,
      resolutionRate: percentage(activeEvents.filter((item) => item.type === "INCIDENT" && item.status === "RESOLVED").length, activeEvents.filter((item) => item.type === "INCIDENT").length),
      monthlyTrend: [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month)),
    },
  };
}

export async function createCategory(input: CategoryInput, actor: Actor, requestId: string) { if (await prisma.behaviourCategory.findFirst({ where: { OR: [{ code: input.code }, { name: { equals: input.name, mode: "insensitive" } }] } })) throw new AppError(409, "CATEGORY_EXISTS", "That category code or name is already in use."); const record = await prisma.behaviourCategory.create({ data: { ...input, description: nullable(input.description) } }); await audit(actor, requestId, "behaviour.category.create", "BehaviourCategory", record); return record; }
export async function updateCategory(id: string, input: z.infer<typeof updateBehaviourCategorySchema>, actor: Actor, requestId: string) { const record = await prisma.behaviourCategory.update({ where: { id }, data: { ...input, description: input.description === undefined ? undefined : nullable(input.description) } }); await audit(actor, requestId, "behaviour.category.update", "BehaviourCategory", record); return record; }
export async function archiveCategory(id: string, actor: Actor, requestId: string) { const record = await prisma.behaviourCategory.update({ where: { id }, data: { isActive: false, archivedAt: new Date() } }); await audit(actor, requestId, "behaviour.category.archive", "BehaviourCategory", record); return record; }

export async function createEvent(input: EventInput, actor: Actor, requestId: string) { const [{ enrollment }, category] = await Promise.all([validateStudentTerm(input.studentId, input.termId), validateCategory(input.categoryId, input.type), validateStaff(input.staffId)]); if (input.formGroupId && input.formGroupId !== enrollment.formGroupId) throw new AppError(400, "CLASS_MISMATCH", "The selected class does not match the student's enrolment."); const record = await prisma.behaviourEvent.create({ data: { ...input, categoryId: category.id, staffId: nullable(input.staffId), formGroupId: nullable(input.formGroupId) ?? enrollment.formGroupId, details: nullable(input.details), location: nullable(input.location), occurredAt: new Date(input.occurredAt), resolvedAt: input.status === "RESOLVED" ? new Date() : null }, include: eventInclude }); await audit(actor, requestId, "behaviour.event.create", "BehaviourEvent", record); return record; }
export async function updateEvent(id: string, input: z.infer<typeof updateBehaviourEventSchema>, actor: Actor, requestId: string) { const existing = await prisma.behaviourEvent.findUnique({ where: { id } }); if (!existing) throw new AppError(404, "EVENT_NOT_FOUND", "Behaviour event not found."); const merged = { ...existing, ...input }; const { enrollment } = await validateStudentTerm(merged.studentId, merged.termId); await validateCategory(merged.categoryId!, merged.type); await validateStaff(merged.staffId ?? undefined); if (merged.formGroupId && merged.formGroupId !== enrollment.formGroupId) throw new AppError(400, "CLASS_MISMATCH", "The selected class does not match the student's enrolment."); const record = await prisma.behaviourEvent.update({ where: { id }, data: { ...input, staffId: input.staffId === undefined ? undefined : nullable(input.staffId), formGroupId: input.formGroupId === undefined ? undefined : nullable(input.formGroupId) ?? enrollment.formGroupId, details: input.details === undefined ? undefined : nullable(input.details), location: input.location === undefined ? undefined : nullable(input.location), occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined, resolvedAt: input.status === "RESOLVED" ? existing.resolvedAt ?? new Date() : input.status ? null : undefined }, include: eventInclude }); await audit(actor, requestId, "behaviour.event.update", "BehaviourEvent", record); return record; }
export async function archiveEvent(id: string, actor: Actor, requestId: string) { const record = await prisma.behaviourEvent.update({ where: { id }, data: { archivedAt: new Date() } }); await audit(actor, requestId, "behaviour.event.archive", "BehaviourEvent", record); return record; }

export async function createReward(input: RewardInput, actor: Actor, requestId: string) { await Promise.all([validateStudentTerm(input.studentId, input.termId), validateStaff(input.staffId)]); const record = await prisma.behaviourReward.create({ data: { ...input, staffId: nullable(input.staffId), description: nullable(input.description), awardedAt: new Date(input.awardedAt) }, include: rewardInclude }); await audit(actor, requestId, "behaviour.reward.create", "BehaviourReward", record); return record; }
export async function updateReward(id: string, input: z.infer<typeof updateBehaviourRewardSchema>, actor: Actor, requestId: string) { const existing = await prisma.behaviourReward.findUnique({ where: { id } }); if (!existing) throw new AppError(404, "REWARD_NOT_FOUND", "Reward not found."); await Promise.all([validateStudentTerm(input.studentId ?? existing.studentId, input.termId ?? existing.termId), validateStaff(input.staffId === undefined ? existing.staffId ?? undefined : input.staffId)]); const record = await prisma.behaviourReward.update({ where: { id }, data: { ...input, staffId: input.staffId === undefined ? undefined : nullable(input.staffId), description: input.description === undefined ? undefined : nullable(input.description), awardedAt: input.awardedAt ? new Date(input.awardedAt) : undefined }, include: rewardInclude }); await audit(actor, requestId, "behaviour.reward.update", "BehaviourReward", record); return record; }
export async function archiveReward(id: string, actor: Actor, requestId: string) { const record = await prisma.behaviourReward.update({ where: { id }, data: { archivedAt: new Date() } }); await audit(actor, requestId, "behaviour.reward.archive", "BehaviourReward", record); return record; }

async function validateLinkedEvent(eventId: string | undefined, studentId: string, termId: string) { if (!eventId) return null; const event = await prisma.behaviourEvent.findFirst({ where: { id: eventId, studentId, termId, type: "INCIDENT", archivedAt: null } }); if (!event) throw new AppError(400, "INCIDENT_MISMATCH", "The linked incident must belong to the same student and term."); return event; }
export async function createSanction(input: SanctionInput, actor: Actor, requestId: string) { await Promise.all([validateStudentTerm(input.studentId, input.termId), validateStaff(input.staffId), validateLinkedEvent(input.behaviourEventId, input.studentId, input.termId)]); const record = await prisma.behaviourSanction.create({ data: { ...input, staffId: nullable(input.staffId), behaviourEventId: nullable(input.behaviourEventId), description: nullable(input.description), scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null, completedAt: input.completedAt ? new Date(input.completedAt) : input.status === "COMPLETED" ? new Date() : null }, include: sanctionInclude }); await audit(actor, requestId, "behaviour.sanction.create", "BehaviourSanction", record); return record; }
export async function updateSanction(id: string, input: z.infer<typeof updateBehaviourSanctionSchema>, actor: Actor, requestId: string) { const existing = await prisma.behaviourSanction.findUnique({ where: { id } }); if (!existing) throw new AppError(404, "SANCTION_NOT_FOUND", "Sanction not found."); const studentId = input.studentId ?? existing.studentId; const termId = input.termId ?? existing.termId; const eventId = input.behaviourEventId === undefined ? existing.behaviourEventId ?? undefined : input.behaviourEventId; await Promise.all([validateStudentTerm(studentId, termId), validateStaff(input.staffId === undefined ? existing.staffId ?? undefined : input.staffId), validateLinkedEvent(eventId, studentId, termId)]); const record = await prisma.behaviourSanction.update({ where: { id }, data: { ...input, staffId: input.staffId === undefined ? undefined : nullable(input.staffId), behaviourEventId: input.behaviourEventId === undefined ? undefined : nullable(input.behaviourEventId), description: input.description === undefined ? undefined : nullable(input.description), scheduledFor: input.scheduledFor === undefined ? undefined : input.scheduledFor ? new Date(input.scheduledFor) : null, completedAt: input.completedAt === undefined ? input.status === "COMPLETED" ? existing.completedAt ?? new Date() : undefined : input.completedAt ? new Date(input.completedAt) : null }, include: sanctionInclude }); await audit(actor, requestId, "behaviour.sanction.update", "BehaviourSanction", record); return record; }
export async function archiveSanction(id: string, actor: Actor, requestId: string) { const record = await prisma.behaviourSanction.update({ where: { id }, data: { archivedAt: new Date() } }); await audit(actor, requestId, "behaviour.sanction.archive", "BehaviourSanction", record); return record; }
