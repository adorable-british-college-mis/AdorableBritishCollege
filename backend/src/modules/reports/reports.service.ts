import type { AttendanceStatus, Prisma, ReportType } from "@prisma/client";
import type { z } from "zod";
import { AppError } from "../../common/errors.js";
import { prisma } from "../../db/prisma.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import type { generateReportSchema, reportFiltersSchema } from "./reports.schemas.js";

type Filters = z.infer<typeof reportFiltersSchema>;
type GenerateInput = z.infer<typeof generateReportSchema>;
type Actor = { userId: string };
const presentCodes: AttendanceStatus[] = ["PRESENT", "LATE"];
const reportLabels: Record<ReportType, string> = {
  ACADEMIC: "Academic Performance Report",
  ATTENDANCE: "Attendance Summary",
  BEHAVIOUR: "Behaviour Incident Report",
  STUDENT: "Student Records Report",
  EXAM: "Examination Results Report",
  OTHER: "School Data Export",
};

const percentage = (value: number, total: number) => total ? Math.round(value / total * 1000) / 10 : null;
const average = (values: Array<number | null>) => {
  const valid = values.filter((value): value is number => value !== null);
  return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length * 10) / 10 : null;
};
const change = (current: number, previous: number) => previous
  ? Math.round((current - previous) / previous * 1000) / 10
  : null;

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastSixMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1));
    return { key: monthKey(date), label: new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(date) };
  });
}

async function context(filters: Filters) {
  const academicYear = filters.academicYearId
    ? await prisma.academicYear.findUnique({ where: { id: filters.academicYearId }, include: { terms: { orderBy: { startsOn: "asc" } } } })
    : await prisma.academicYear.findFirst({ where: { isCurrent: true }, include: { terms: { orderBy: { startsOn: "asc" } } } })
      ?? await prisma.academicYear.findFirst({ include: { terms: { orderBy: { startsOn: "asc" } } }, orderBy: { startsOn: "desc" } });
  if (!academicYear) throw new AppError(409, "ACADEMIC_YEAR_REQUIRED", "Configure an academic year before generating reports.");
  const term = filters.termId
    ? academicYear.terms.find((item) => item.id === filters.termId)
    : academicYear.terms.find((item) => item.startsOn <= new Date() && item.endsOn >= new Date()) ?? academicYear.terms[0] ?? null;
  if (filters.termId && !term) throw new AppError(400, "TERM_MISMATCH", "The selected term does not belong to this academic year.");
  if (filters.yearGroupId && !(await prisma.yearGroup.findUnique({ where: { id: filters.yearGroupId } }))) throw new AppError(400, "YEAR_GROUP_NOT_FOUND", "The selected year group is unavailable.");
  if (filters.studentId) {
    const student = await prisma.student.findFirst({ where: { id: filters.studentId, status: "ACTIVE", archivedAt: null, enrollments: { some: { academicYearId: academicYear.id } } } });
    if (!student) throw new AppError(400, "STUDENT_NOT_FOUND", "The selected student is not active in this academic year.");
  }
  return { academicYear, term };
}

export async function getOverview(filters: Filters = {}) {
  const { academicYear, term } = await context(filters);
  const comparisonTerm = term
    ? await prisma.term.findFirst({ where: { endsOn: { lt: term.startsOn } }, orderBy: { endsOn: "desc" } })
    : null;
  const studentWhere: Prisma.StudentWhereInput = {
    status: "ACTIVE", archivedAt: null,
    ...(filters.studentId ? { id: filters.studentId } : {}),
    enrollments: { some: { academicYearId: academicYear.id, ...(filters.yearGroupId ? { yearGroupId: filters.yearGroupId } : {}) } },
  };
  const reportWhere: Prisma.GeneratedReportWhereInput = {
    academicYearId: academicYear.id,
    archivedAt: null,
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.termId ? { termId: filters.termId } : {}),
    ...((filters.yearGroupId || filters.studentId) ? {
      AND: [
        ...(filters.yearGroupId ? [{ filters: { path: ["yearGroupId"], equals: filters.yearGroupId } }] : []),
        ...(filters.studentId ? [{ filters: { path: ["studentId"], equals: filters.studentId } }] : []),
      ],
    } : {}),
  };
  const comparisonStudentWhere: Prisma.StudentWhereInput | undefined = comparisonTerm ? {
    status: "ACTIVE", archivedAt: null,
    ...(filters.studentId ? { id: filters.studentId } : {}),
    enrollments: { some: { academicYearId: comparisonTerm.academicYearId, ...(filters.yearGroupId ? { yearGroupId: filters.yearGroupId } : {}) } },
  } : undefined;
  const comparisonReportWhere: Prisma.GeneratedReportWhereInput | undefined = comparisonTerm ? {
    academicYearId: comparisonTerm.academicYearId, termId: comparisonTerm.id, archivedAt: null,
    ...(filters.type ? { type: filters.type } : {}),
  } : undefined;
  const months = lastSixMonths();
  const trendStart = new Date(`${months[0]!.key}-01T00:00:00.000Z`);
  const [academicYears, yearGroups, students, results, attendanceRecords, incidents, reports, trendReports, reportCount, reportDistributionRows, comparisonStudents, comparisonAttendance, comparisonIncidents, comparisonReports] = await Promise.all([
    prisma.academicYear.findMany({ include: { terms: { orderBy: { startsOn: "asc" } } }, orderBy: { startsOn: "desc" } }),
    prisma.yearGroup.findMany({ where: { code: { in: ["Y7", "Y8", "Y9", "Y10", "Y11", "Y12"] }, ...(filters.yearGroupId ? { id: filters.yearGroupId } : {}) }, orderBy: { displayOrder: "asc" } }),
    prisma.student.findMany({ where: studentWhere, select: { id: true, admissionNumber: true, firstName: true, lastName: true, enrollments: { where: { academicYearId: academicYear.id }, select: { yearGroupId: true, yearGroup: { select: { id: true, name: true } } } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.assessmentResult.findMany({
      where: { ...(filters.studentId ? { studentId: filters.studentId } : {}), assessment: { term: { academicYearId: academicYear.id }, ...(filters.termId ? { termId: filters.termId } : {}), ...(filters.yearGroupId ? { yearGroupId: filters.yearGroupId } : {}), isActive: true, archivedAt: null } },
      select: { attainmentPct: true, progressPct: true, assessment: { select: { yearGroupId: true, subject: { select: { name: true } } } } },
    }),
    prisma.attendanceRecord.findMany({
      where: { ...(filters.studentId ? { studentId: filters.studentId } : {}), register: { term: { academicYearId: academicYear.id }, ...(filters.termId ? { termId: filters.termId } : {}), ...(filters.yearGroupId ? { yearGroupId: filters.yearGroupId } : {}) } },
      select: { status: true, register: { select: { yearGroupId: true } } },
    }),
    prisma.behaviourEvent.findMany({
      where: { archivedAt: null, type: "INCIDENT", term: { academicYearId: academicYear.id }, ...(filters.termId ? { termId: filters.termId } : {}), ...(filters.studentId ? { studentId: filters.studentId } : {}), ...(filters.yearGroupId ? { student: { enrollments: { some: { academicYearId: academicYear.id, yearGroupId: filters.yearGroupId } } } } : {}) },
      select: { id: true },
    }),
    prisma.generatedReport.findMany({ where: reportWhere, include: { generatedBy: { select: { firstName: true, lastName: true } }, term: { select: { id: true, name: true } } }, orderBy: { generatedAt: "desc" }, take: 10 }),
    prisma.generatedReport.findMany({ where: { ...reportWhere, generatedAt: { gte: trendStart } }, select: { generatedAt: true } }),
    prisma.generatedReport.count({ where: reportWhere }),
    prisma.generatedReport.groupBy({ by: ["type"], where: reportWhere, _count: { _all: true } }),
    comparisonStudentWhere ? prisma.student.count({ where: comparisonStudentWhere }) : Promise.resolve(null),
    comparisonTerm ? prisma.attendanceRecord.findMany({ where: { ...(filters.studentId ? { studentId: filters.studentId } : {}), register: { termId: comparisonTerm.id, ...(filters.yearGroupId ? { yearGroupId: filters.yearGroupId } : {}) } }, select: { status: true } }) : Promise.resolve(null),
    comparisonTerm ? prisma.behaviourEvent.count({ where: { archivedAt: null, type: "INCIDENT", termId: comparisonTerm.id, ...(filters.studentId ? { studentId: filters.studentId } : {}), ...(filters.yearGroupId ? { student: { enrollments: { some: { academicYearId: comparisonTerm.academicYearId, yearGroupId: filters.yearGroupId } } } } : {}) } }) : Promise.resolve(null),
    comparisonReportWhere ? prisma.generatedReport.count({ where: comparisonReportWhere }) : Promise.resolve(null),
  ]);

  const subjectKind = (name?: string) => {
    const normalized = name?.toLowerCase() ?? "";
    if (normalized.includes("math")) return "Mathematics";
    if (normalized.includes("english")) return "English";
    if (normalized.includes("science") || normalized.includes("biology") || normalized.includes("chemistry") || normalized.includes("physics")) return "Science";
    return null;
  };
  const academicPerformance = yearGroups.map((yearGroup) => ({
    id: yearGroup.id,
    name: yearGroup.name,
    subjects: ["Mathematics", "English", "Science"].map((subject) => ({
      subject,
      value: average(results.filter((row) => row.assessment.yearGroupId === yearGroup.id && subjectKind(row.assessment.subject?.name) === subject).map((row) => row.attainmentPct)),
    })),
  }));
  const attendanceByYearGroup = yearGroups.map((yearGroup) => {
    const rows = attendanceRecords.filter((row) => row.register.yearGroupId === yearGroup.id);
    return { id: yearGroup.id, name: yearGroup.name, percentage: percentage(rows.filter((row) => presentCodes.includes(row.status)).length, rows.length) };
  });
  const attendanceRate = percentage(attendanceRecords.filter((row) => presentCodes.includes(row.status)).length, attendanceRecords.length);
  const comparisonAttendanceRate = comparisonAttendance
    ? percentage(comparisonAttendance.filter((row) => presentCodes.includes(row.status)).length, comparisonAttendance.length)
    : null;
  const reportTrends = months.map((month) => ({ ...month, count: trendReports.filter((report) => monthKey(report.generatedAt) === month.key).length }));
  const reportDistribution = (["ACADEMIC", "ATTENDANCE", "BEHAVIOUR", "STUDENT", "EXAM", "OTHER"] as ReportType[]).map((type) => ({ type, count: reportDistributionRows.find((row) => row.type === type)?._count._all ?? 0 }));
  return {
    academicYear, term,
    metrics: {
      totalStudents: students.length,
      reportsGenerated: reportCount,
      attendanceRate,
      behaviourIncidents: incidents.length,
      trends: {
        totalStudents: comparisonStudents == null ? null : change(students.length, comparisonStudents),
        reportsGenerated: comparisonReports == null ? null : change(reportCount, comparisonReports),
        attendanceRate: attendanceRate == null || comparisonAttendanceRate == null ? null : Math.round((attendanceRate - comparisonAttendanceRate) * 10) / 10,
        behaviourIncidents: comparisonIncidents == null ? null : change(incidents.length, comparisonIncidents),
      },
    },
    academicPerformance, attendanceByYearGroup, reportTrends, reportDistribution,
    recentReports: reports,
    reference: { academicYears, yearGroups, students },
  };
}

export async function generateReport(input: GenerateInput, actor: Actor, requestId: string) {
  const { academicYear, term } = await context(input);
  const overview = await getOverview(input);
  const snapshot = input.type === "ACADEMIC" || input.type === "EXAM"
    ? { academicPerformance: overview.academicPerformance }
    : input.type === "ATTENDANCE"
      ? { attendanceRate: overview.metrics.attendanceRate, attendanceByYearGroup: overview.attendanceByYearGroup }
      : input.type === "BEHAVIOUR"
        ? { behaviourIncidents: overview.metrics.behaviourIncidents }
        : input.type === "STUDENT"
          ? { totalStudents: overview.metrics.totalStudents, students: overview.reference.students }
          : { metrics: overview.metrics, academicPerformance: overview.academicPerformance, attendanceByYearGroup: overview.attendanceByYearGroup };
  const report = await prisma.generatedReport.create({
    data: {
      name: input.name || reportLabels[input.type], type: input.type, academicYearId: academicYear.id,
      termId: term?.id, generatedById: actor.userId,
      filters: { academicYearId: academicYear.id, termId: input.termId ?? null, yearGroupId: input.yearGroupId ?? null, studentId: input.studentId ?? null } as Prisma.InputJsonValue,
      snapshot: snapshot as Prisma.InputJsonValue,
    },
    include: { generatedBy: { select: { firstName: true, lastName: true } }, term: { select: { id: true, name: true } } },
  });
  await recordAuditEvent({ actorUserId: actor.userId, action: "report.generate", entityType: "GeneratedReport", entityId: report.id, requestId, metadata: { type: input.type, academicYearId: academicYear.id } });
  return report;
}

export async function getReport(id: string) {
  const report = await prisma.generatedReport.findFirst({ where: { id, archivedAt: null }, include: { academicYear: true, term: true, generatedBy: { select: { firstName: true, lastName: true } } } });
  if (!report) throw new AppError(404, "REPORT_NOT_FOUND", "The report could not be found.");
  return report;
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function flattenSnapshot(value: unknown, path = "Report"): Array<[string, string, unknown]> {
  if (Array.isArray(value)) return value.flatMap((item, index) => flattenSnapshot(item, `${path} ${index + 1}`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => flattenSnapshot(item, path === "Report" ? key : `${path} / ${key}`));
  const parts = path.split(" / ");
  return [[parts.slice(0, -1).join(" / ") || "Report", parts.at(-1) ?? "Value", value]];
}

export async function downloadReport(id: string) {
  const report = await getReport(id);
  const rows = flattenSnapshot(report.snapshot);
  const csv = ["Section,Metric,Value", ...rows.map((row) => row.map(csvCell).join(","))].join("\r\n");
  return { filename: `${report.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report"}.csv`, csv };
}

export async function archiveReport(id: string, actor: Actor, requestId: string) {
  const existing = await getReport(id);
  const report = await prisma.generatedReport.update({ where: { id }, data: { archivedAt: new Date() } });
  await recordAuditEvent({ actorUserId: actor.userId, action: "report.archive", entityType: "GeneratedReport", entityId: id, requestId, before: { archivedAt: existing.archivedAt }, after: { archivedAt: report.archivedAt } });
  return report;
}
