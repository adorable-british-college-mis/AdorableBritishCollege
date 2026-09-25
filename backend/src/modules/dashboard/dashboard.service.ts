import type { AssessmentResultStatus, AttendanceStatus, BehaviourEventType } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

const percent = (part: number, total: number) => total ? Math.round(part / total * 1000) / 10 : null;
const trend = (current: number | null, previous: number | null) => current != null && previous != null && previous !== 0
  ? Math.round((current - previous) / previous * 1000) / 10
  : null;
const startOfDay = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
const addDays = (value: Date, days: number) => new Date(value.getTime() + days * 86_400_000);

function attendanceSummary(records: Array<{ status: AttendanceStatus }>) {
  const count = (status: AttendanceStatus) => records.filter((record) => record.status === status).length;
  const present = count("PRESENT") + count("LATE");
  const authorisedAbsence = count("AUTHORISED_ABSENCE");
  const unauthorisedAbsence = count("UNAUTHORISED_ABSENCE");
  return { present, authorisedAbsence, unauthorisedAbsence, total: records.length, percentage: percent(present, records.length) };
}

function assessmentSummary(records: Array<{ status: AssessmentResultStatus }>) {
  const count = (status: AssessmentResultStatus) => records.filter((record) => record.status === status).length;
  const completed = count("COMPLETED");
  const inProgress = count("IN_PROGRESS");
  const notStarted = count("NOT_STARTED");
  return { completed, inProgress, notStarted, total: records.length, completionPct: percent(completed, records.length) };
}

export async function getDashboardSummary() {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const academicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true }, include: { terms: { orderBy: { startsOn: "asc" } } }, orderBy: { startsOn: "desc" } })
    ?? await prisma.academicYear.findFirst({ include: { terms: { orderBy: { startsOn: "asc" } } }, orderBy: { startsOn: "desc" } });
  const currentTerm = academicYear?.terms.find((term) => term.startsOn <= now && term.endsOn >= now) ?? academicYear?.terms[0] ?? null;
  const currentTermIndex = academicYear && currentTerm ? academicYear.terms.findIndex((term) => term.id === currentTerm.id) : -1;
  const previousTerm = currentTermIndex > 0 ? academicYear!.terms[currentTermIndex - 1]! : null;
  const newSince = currentTerm?.startsOn ?? academicYear?.startsOn ?? now;
  const termId = currentTerm?.id;

  const [students, guardians, staff, newThisTerm, admissionGroups, enrolmentGroups, recentActivity, currentAttendance, previousAttendance, currentAssessments, previousAssessments, behaviour, schedule, openRegisters, assessmentsDueToday] = await Promise.all([
    prisma.student.groupBy({ by: ["status"], _count: { id: true }, orderBy: { status: "asc" } }),
    prisma.parentGuardian.count({ where: { archivedAt: null } }),
    prisma.staff.count({ where: { status: "ACTIVE", archivedAt: null } }),
    prisma.student.count({ where: { createdAt: { gte: newSince }, archivedAt: null } }),
    prisma.admissionApplication.groupBy({ where: { status: { not: "DRAFT" } }, by: ["status"], _count: { id: true }, orderBy: { status: "asc" } }),
    prisma.enrollment.groupBy({ ...(academicYear ? { where: { academicYearId: academicYear.id } } : {}), by: ["yearGroupId"], _count: { id: true }, orderBy: { yearGroupId: "asc" } }),
    prisma.auditEvent.findMany({ take: 6, orderBy: { createdAt: "desc" }, select: { id: true, action: true, entityType: true, entityId: true, outcome: true, createdAt: true, actor: { select: { firstName: true, lastName: true } } } }),
    termId ? prisma.attendanceRecord.findMany({ where: { register: { termId } }, select: { status: true, register: { select: { date: true } } } }) : Promise.resolve([]),
    previousTerm ? prisma.attendanceRecord.findMany({ where: { register: { termId: previousTerm.id } }, select: { status: true } }) : Promise.resolve([]),
    termId ? prisma.assessmentResult.findMany({ where: { assessment: { termId } }, select: { status: true, attainmentPct: true, progressPct: true, assessment: { select: { yearGroup: { select: { name: true, displayOrder: true } } } } } }) : Promise.resolve([]),
    previousTerm ? prisma.assessmentResult.findMany({ where: { assessment: { termId: previousTerm.id } }, select: { status: true } }) : Promise.resolve([]),
    termId ? prisma.behaviourEvent.findMany({ where: { termId, archivedAt: null }, select: { type: true, resolvedAt: true } }) : Promise.resolve([]),
    termId ? prisma.timetableSlot.findMany({ where: { termId, weekday: now.getDay() }, select: { id: true, startsAt: true, endsAt: true, periodLabel: true, room: true, subject: { select: { name: true } }, yearGroup: { select: { name: true } } }, orderBy: { startsAt: "asc" }, take: 5 }) : Promise.resolve([]),
    termId ? prisma.attendanceRegister.count({ where: { termId, date: today, status: "OPEN" } }) : Promise.resolve(0),
    termId ? prisma.assessment.count({ where: { termId, dueAt: { gte: today, lt: tomorrow } } }) : Promise.resolve(0),
  ] as const);

  const yearGroupRecords = await prisma.yearGroup.findMany({
    where: { code: { in: ["Y7", "Y8", "Y9", "Y10", "Y11", "Y12"] } },
    select: { id: true, name: true, displayOrder: true },
    orderBy: { displayOrder: "asc" },
  });
  const studentCount = (status: string) => students.find((item) => item.status === status)?._count.id ?? 0;
  const admissionCount = (statuses: string[]) => admissionGroups.filter((item) => statuses.includes(item.status)).reduce((total, item) => total + item._count.id, 0);
  const attendance = attendanceSummary(currentAttendance);
  const previousAttendanceSummary = attendanceSummary(previousAttendance);
  const assessment = assessmentSummary(currentAssessments);
  const previousAssessmentSummary = assessmentSummary(previousAssessments);
  const behaviourCount = (type: BehaviourEventType) => behaviour.filter((event) => event.type === type).length;
  const positive = behaviourCount("POSITIVE");
  const incidents = behaviourCount("INCIDENT");
  const unresolved = behaviour.filter((event) => event.type === "INCIDENT" && !event.resolvedAt).length;
  const maxDate = today;
  const monday = addDays(maxDate, -((maxDate.getUTCDay() + 6) % 7));
  const attendanceWeek = Array.from({ length: 5 }, (_, index) => {
    const day = addDays(monday, index);
    const dayRecords = currentAttendance.filter((record) => startOfDay(record.register.date).getTime() === day.getTime());
    return { date: day.toISOString(), label: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(day), percentage: attendanceSummary(dayRecords).percentage };
  });
  const assessmentByYearGroup = [...new Set(currentAssessments.map((result) => result.assessment.yearGroup.name))].map((name) => {
    const rows = currentAssessments.filter((result) => result.assessment.yearGroup.name === name);
    const average = (field: "attainmentPct" | "progressPct") => { const values = rows.map((row) => row[field]).filter((value): value is number => value != null); return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : null; };
    return { name, displayOrder: rows[0]!.assessment.yearGroup.displayOrder, attainment: average("attainmentPct"), progress: average("progressPct") };
  }).sort((a, b) => a.displayOrder - b.displayOrder);
  const enrolledBeforeTerm = currentTerm ? await prisma.enrollment.count({ where: { startsOn: { lt: currentTerm.startsOn }, OR: [{ endsOn: null }, { endsOn: { gte: currentTerm.startsOn } }] } }) : 0;
  const activeStudents = studentCount("ACTIVE");

  return {
    academicYear,
    currentTerm,
    students: { total: students.reduce((total, item) => total + item._count.id, 0), active: activeStudents, applicants: studentCount("APPLICANT"), archived: studentCount("ARCHIVED"), newThisTerm, guardians, staff, trendPct: trend(activeStudents, enrolledBeforeTerm), byYearGroup: yearGroupRecords.map((record) => ({ name: record.name, displayOrder: record.displayOrder, count: enrolmentGroups.find((group) => group.yearGroupId === record.id)?._count.id ?? 0 })) },
    admissions: { total: admissionGroups.reduce((total, item) => total + item._count.id, 0), submitted: admissionCount(["SUBMITTED"]), inReview: admissionCount(["UNDER_REVIEW", "ASSESSMENT"]), interview: admissionCount(["INTERVIEW"]), offered: admissionCount(["OFFERED"]), accepted: admissionCount(["ACCEPTED"]), waitlisted: admissionCount(["WAITLISTED"]), enrolled: admissionCount(["ENROLLED"]) },
    attendance: { ...attendance, trendPct: trend(attendance.percentage, previousAttendanceSummary.percentage), week: attendanceWeek },
    assessment: { ...assessment, trendPct: trend(assessment.completionPct, previousAssessmentSummary.completionPct), byYearGroup: assessmentByYearGroup },
    behaviour: { total: behaviour.length, positive, incidents, unresolved, positivePct: percent(positive, behaviour.length), incidentsPct: percent(incidents, behaviour.length) },
    schedule,
    alerts: { openRegisters, assessmentsDueToday, unresolvedBehaviour: unresolved, other: 0 },
    recentActivity,
  };
}
