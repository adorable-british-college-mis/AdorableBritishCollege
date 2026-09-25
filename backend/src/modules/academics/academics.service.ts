import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { AppError } from "../../common/errors.js";
import { prisma } from "../../db/prisma.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import type {
  createAssessmentPlanSchema, createClassSchema, createCurriculumSchema,
  createDepartmentSchema, createSubjectSchema, createTeacherSchema,
  createTeachingAssignmentSchema, curriculumSubjectSchema,
  updateAssessmentPlanSchema, updateClassSchema, updateCurriculumSchema,
  updateDepartmentSchema, updateSubjectSchema, updateTeacherSchema,
  updateTeachingAssignmentSchema, updateCurriculumSubjectSchema,
} from "./academics.schemas.js";

type Actor = { userId: string };
type SubjectInput = z.infer<typeof createSubjectSchema>;
type DepartmentInput = z.infer<typeof createDepartmentSchema>;
type CurriculumInput = z.infer<typeof createCurriculumSchema>;
type ClassInput = z.infer<typeof createClassSchema>;
type TeacherInput = z.infer<typeof createTeacherSchema>;
type AssignmentInput = z.infer<typeof createTeachingAssignmentSchema>;
type AssessmentInput = z.infer<typeof createAssessmentPlanSchema>;
type MappingInput = z.infer<typeof curriculumSubjectSchema>;

const average = (values: Array<number | null>) => {
  const present = values.filter((value): value is number => value != null);
  return present.length ? Math.round(present.reduce((sum, value) => sum + value, 0) / present.length * 10) / 10 : null;
};
const nullable = (value: string | undefined) => value || null;

async function audit(actor: Actor, requestId: string, action: string, entityType: string, entity: { id: string }) {
  await recordAuditEvent({ actorUserId: actor.userId, action, entityType, entityId: entity.id, requestId, after: entity as Prisma.InputJsonValue });
}

async function activeDepartment(id?: string) {
  if (!id) return null;
  const record = await prisma.department.findFirst({ where: { id, isActive: true, archivedAt: null } });
  if (!record) throw new AppError(400, "DEPARTMENT_UNAVAILABLE", "The selected department is archived or unavailable.");
  return record;
}

async function activeSubject(id: string) {
  const record = await prisma.subject.findFirst({ where: { id, isActive: true, archivedAt: null, OR: [{ departmentId: null }, { academicDepartment: { isActive: true, archivedAt: null } }] } });
  if (!record) throw new AppError(400, "SUBJECT_UNAVAILABLE", "The selected subject is archived or unavailable.");
  return record;
}

async function activeTeacher(id?: string) {
  if (!id) return null;
  const record = await prisma.staff.findFirst({ where: { id, status: "ACTIVE", archivedAt: null, OR: [{ departmentId: null }, { academicDepartment: { isActive: true, archivedAt: null } }] } });
  if (!record) throw new AppError(400, "TEACHER_UNAVAILABLE", "The selected teacher or tutor is archived or unavailable.");
  return record;
}

async function activeCurriculum(id?: string) {
  if (!id) return null;
  const record = await prisma.curriculum.findFirst({ where: { id, isActive: true, archivedAt: null } });
  if (!record) throw new AppError(400, "CURRICULUM_UNAVAILABLE", "The selected curriculum is archived or unavailable.");
  return record;
}

export async function getOverview() {
  const academicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true }, include: { terms: { orderBy: { startsOn: "asc" } } }, orderBy: { startsOn: "desc" } })
    ?? await prisma.academicYear.findFirst({ include: { terms: { orderBy: { startsOn: "asc" } } }, orderBy: { startsOn: "desc" } });
  const academicYearId = academicYear?.id;
  const [subjects, classes, teachers, assessments, curriculumMappings, curricula, departments, assignments, results, yearGroups] = await Promise.all([
    prisma.subject.findMany({ include: { academicDepartment: true }, orderBy: [{ name: "asc" }] }),
    prisma.formGroup.findMany({
      include: {
        yearGroup: true, tutor: true, curriculum: true, department: true,
        enrollments: { where: { ...(academicYearId ? { academicYearId } : {}), endsOn: null }, select: { studentId: true } },
        teachingAssignments: { where: academicYearId ? { academicYearId } : {}, include: { subject: true, staff: true, department: true } },
      }, orderBy: [{ yearGroup: { displayOrder: "asc" } }, { name: "asc" }],
    }),
    prisma.staff.findMany({ include: { academicDepartment: true, formGroups: { select: { id: true, code: true } }, teachingAssignments: { where: academicYearId ? { academicYearId } : {}, include: { formGroup: true, subject: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.assessment.findMany({ where: academicYearId ? { term: { academicYearId } } : {}, include: { term: true, yearGroup: true, subject: true, results: { select: { status: true } } }, orderBy: { dueAt: "asc" } }),
    prisma.curriculumSubject.findMany({ where: academicYearId ? { academicYearId } : {}, include: { yearGroup: true, subject: { include: { academicDepartment: true } }, academicYear: true, curriculum: true }, orderBy: [{ yearGroup: { displayOrder: "asc" } }, { subject: { name: "asc" } }] }),
    prisma.curriculum.findMany({ where: academicYearId ? { academicYearId } : {}, include: { academicYear: true, yearGroup: true, subjects: { include: { subject: true } }, formGroups: { select: { id: true, code: true, name: true } } }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ include: { _count: { select: { subjects: true, staff: true, formGroups: true } } }, orderBy: { name: "asc" } }),
    prisma.teachingAssignment.findMany({ where: academicYearId ? { academicYearId } : {}, include: { academicYear: true, formGroup: { include: { yearGroup: true } }, subject: true, staff: true, department: true }, orderBy: [{ formGroup: { code: "asc" } }, { subject: { name: "asc" } }] }),
    prisma.assessmentResult.findMany({ where: academicYearId ? { assessment: { term: { academicYearId } } } : {}, select: { progressPct: true, attainmentPct: true, assessment: { select: { termId: true, yearGroupId: true } }, studentId: true } }),
    prisma.yearGroup.findMany({ orderBy: { displayOrder: "asc" } }),
  ]);
  const activeSubjects = subjects.filter((item) => item.isActive && !item.archivedAt);
  const activeClasses = classes.filter((item) => item.isActive && !item.archivedAt);
  const activeTeachers = teachers.filter((item) => item.status === "ACTIVE" && !item.archivedAt);
  const activeAssessments = assessments.filter((item) => item.isActive && !item.archivedAt);
  const terms = academicYear?.terms ?? [];
  const performance = yearGroups.map((yearGroup) => ({ id: yearGroup.id, name: yearGroup.name, displayOrder: yearGroup.displayOrder, terms: terms.map((term) => ({ termId: term.id, termName: term.name, value: average(results.filter((row) => row.assessment.yearGroupId === yearGroup.id && row.assessment.termId === term.id).map((row) => row.progressPct ?? row.attainmentPct)) })) }));
  const classRows = classes.map((group) => {
    const studentIds = new Set(group.enrollments.map((item) => item.studentId));
    const classResults = results.filter((row) => studentIds.has(row.studentId));
    return { ...group, students: group.enrollments.length, subjects: group.teachingAssignments.filter((item) => item.isActive && !item.archivedAt).length || curriculumMappings.filter((item) => item.yearGroupId === group.yearGroup.id && item.isActive && !item.archivedAt).length, averageProgress: average(classResults.map((row) => row.progressPct ?? row.attainmentPct)) };
  });
  const calendar = [...(academicYear?.terms.flatMap((term) => [{ id: `${term.id}-start`, title: `${term.name} term begins`, date: term.startsOn.toISOString(), type: "term" }, { id: `${term.id}-end`, title: `End of ${term.name} term`, date: term.endsOn.toISOString(), type: "term" }]) ?? []), ...activeAssessments.map((item) => ({ id: item.id, title: item.title, date: item.dueAt.toISOString(), type: "assessment" }))].filter((item) => new Date(item.date) >= new Date()).sort((a, b) => +new Date(a.date) - +new Date(b.date)).slice(0, 4);
  return {
    academicYear,
    metrics: { subjects: activeSubjects.length, classes: activeClasses.length, teachers: activeTeachers.length, assessmentPlans: activeAssessments.length, averageProgress: average(results.map((row) => row.progressPct ?? row.attainmentPct)) },
    subjects, classes: classRows, teachers, assessments, curriculum: curriculumMappings, curricula, departments, teachingAssignments: assignments, performance, calendar,
  };
}

export async function createDepartment(input: DepartmentInput, actor: Actor, requestId: string) {
  if (await prisma.department.findFirst({ where: { OR: [{ code: input.code }, { name: { equals: input.name, mode: "insensitive" } }] } })) throw new AppError(409, "DEPARTMENT_EXISTS", "That department code or name is already in use.");
  const record = await prisma.department.create({ data: { ...input, description: input.description || null } });
  await audit(actor, requestId, "academic.department.create", "Department", record); return record;
}
export async function updateDepartment(id: string, input: z.infer<typeof updateDepartmentSchema>, actor: Actor, requestId: string) {
  if (!await prisma.department.findUnique({ where: { id } })) throw new AppError(404, "DEPARTMENT_NOT_FOUND", "Department not found.");
  const record = await prisma.department.update({ where: { id }, data: { ...input, description: input.description || undefined } });
  await audit(actor, requestId, "academic.department.update", "Department", record); return record;
}
export async function archiveDepartment(id: string, actor: Actor, requestId: string) {
  const record = await prisma.department.update({ where: { id }, data: { isActive: false, archivedAt: new Date() } });
  await audit(actor, requestId, "academic.department.archive", "Department", record); return record;
}

export async function createSubject(input: SubjectInput, actor: Actor, requestId: string) {
  if (await prisma.subject.findUnique({ where: { code: input.code } })) throw new AppError(409, "SUBJECT_CODE_EXISTS", "That subject code is already in use.");
  const department = await activeDepartment(input.departmentId || undefined);
  const record = await prisma.subject.create({ data: { code: input.code, name: input.name, departmentId: department?.id, department: department?.name ?? input.department ?? null } });
  await audit(actor, requestId, "academic.subject.create", "Subject", record); return record;
}
export async function updateSubject(id: string, input: z.infer<typeof updateSubjectSchema>, actor: Actor, requestId: string) {
  if (!await prisma.subject.findUnique({ where: { id } })) throw new AppError(404, "SUBJECT_NOT_FOUND", "Subject not found.");
  const department = input.departmentId !== undefined ? await activeDepartment(input.departmentId || undefined) : undefined;
  const record = await prisma.subject.update({ where: { id }, data: { code: input.code, name: input.name, departmentId: department === undefined ? undefined : department?.id ?? null, department: department?.name ?? input.department } });
  await audit(actor, requestId, "academic.subject.update", "Subject", record); return record;
}
export async function archiveSubject(id: string, actor: Actor, requestId: string) {
  const record = await prisma.$transaction(async (tx) => { const subject = await tx.subject.update({ where: { id }, data: { isActive: false, archivedAt: new Date() } }); await tx.curriculumSubject.updateMany({ where: { subjectId: id, isActive: true }, data: { isActive: false, archivedAt: new Date() } }); await tx.teachingAssignment.updateMany({ where: { subjectId: id, isActive: true }, data: { isActive: false, archivedAt: new Date() } }); return subject; });
  await audit(actor, requestId, "academic.subject.archive", "Subject", record); return record;
}

export async function createCurriculum(input: CurriculumInput, actor: Actor, requestId: string) {
  if (await prisma.curriculum.findUnique({ where: { academicYearId_code: { academicYearId: input.academicYearId, code: input.code } } })) throw new AppError(409, "CURRICULUM_CODE_EXISTS", "That curriculum code is already in use for this academic year.");
  await Promise.all(input.subjectIds.map(activeSubject));
  const record = await prisma.$transaction(async (tx) => { const curriculum = await tx.curriculum.create({ data: { code: input.code, name: input.name, description: input.description || null, academicYearId: input.academicYearId, yearGroupId: nullable(input.yearGroupId) } }); if (input.yearGroupId) await Promise.all(input.subjectIds.map((subjectId) => tx.curriculumSubject.upsert({ where: { academicYearId_yearGroupId_subjectId: { academicYearId: input.academicYearId, yearGroupId: input.yearGroupId!, subjectId } }, update: { curriculumId: curriculum.id, isActive: true, archivedAt: null }, create: { academicYearId: input.academicYearId, yearGroupId: input.yearGroupId!, subjectId, curriculumId: curriculum.id } }))); return curriculum; });
  await audit(actor, requestId, "academic.curriculum.create", "Curriculum", record); return record;
}
export async function updateCurriculum(id: string, input: z.infer<typeof updateCurriculumSchema>, actor: Actor, requestId: string) {
  const existing = await prisma.curriculum.findUnique({ where: { id } }); if (!existing) throw new AppError(404, "CURRICULUM_NOT_FOUND", "Curriculum not found.");
  if (input.subjectIds) await Promise.all(input.subjectIds.map(activeSubject));
  const academicYearId = input.academicYearId ?? existing.academicYearId; const yearGroupId = input.yearGroupId === undefined ? existing.yearGroupId : nullable(input.yearGroupId);
  const record = await prisma.$transaction(async (tx) => { const curriculum = await tx.curriculum.update({ where: { id }, data: { code: input.code, name: input.name, description: input.description, academicYearId: input.academicYearId, yearGroupId } }); if (input.subjectIds) { await tx.curriculumSubject.updateMany({ where: { curriculumId: id }, data: { isActive: false, archivedAt: new Date() } }); if (yearGroupId) await Promise.all(input.subjectIds.map((subjectId) => tx.curriculumSubject.upsert({ where: { academicYearId_yearGroupId_subjectId: { academicYearId, yearGroupId, subjectId } }, update: { curriculumId: id, isActive: true, archivedAt: null }, create: { academicYearId, yearGroupId, subjectId, curriculumId: id } }))); } return curriculum; });
  await audit(actor, requestId, "academic.curriculum.update", "Curriculum", record); return record;
}
export async function archiveCurriculum(id: string, actor: Actor, requestId: string) {
  const record = await prisma.$transaction(async (tx) => { const curriculum = await tx.curriculum.update({ where: { id }, data: { isActive: false, archivedAt: new Date() } }); await tx.curriculumSubject.updateMany({ where: { curriculumId: id, isActive: true }, data: { isActive: false, archivedAt: new Date() } }); return curriculum; });
  await audit(actor, requestId, "academic.curriculum.archive", "Curriculum", record); return record;
}

export async function createClass(input: ClassInput, actor: Actor, requestId: string) {
  if (await prisma.formGroup.findUnique({ where: { code: input.code } })) throw new AppError(409, "CLASS_CODE_EXISTS", "That class code is already in use.");
  const [tutor, curriculum, department] = await Promise.all([activeTeacher(input.tutorStaffId || undefined), activeCurriculum(input.curriculumId || undefined), activeDepartment(input.departmentId || undefined)]);
  if (curriculum?.yearGroupId && curriculum.yearGroupId !== input.yearGroupId) throw new AppError(400, "CURRICULUM_YEAR_MISMATCH", "The curriculum is not available for the selected year group.");
  const record = await prisma.formGroup.create({ data: { code: input.code, name: input.name, yearGroupId: input.yearGroupId, tutorStaffId: tutor?.id, curriculumId: curriculum?.id, departmentId: department?.id }, include: { yearGroup: true, tutor: true, curriculum: true, department: true } });
  await audit(actor, requestId, "academic.class.create", "FormGroup", record); return record;
}
export async function updateClass(id: string, input: z.infer<typeof updateClassSchema>, actor: Actor, requestId: string) {
  const existing = await prisma.formGroup.findUnique({ where: { id } }); if (!existing) throw new AppError(404, "CLASS_NOT_FOUND", "Class not found.");
  const [tutor, curriculum, department] = await Promise.all([input.tutorStaffId === undefined ? undefined : activeTeacher(input.tutorStaffId || undefined), input.curriculumId === undefined ? undefined : activeCurriculum(input.curriculumId || undefined), input.departmentId === undefined ? undefined : activeDepartment(input.departmentId || undefined)]);
  const yearGroupId = input.yearGroupId ?? existing.yearGroupId; if (curriculum?.yearGroupId && curriculum.yearGroupId !== yearGroupId) throw new AppError(400, "CURRICULUM_YEAR_MISMATCH", "The curriculum is not available for the selected year group.");
  const record = await prisma.formGroup.update({ where: { id }, data: { code: input.code, name: input.name, yearGroupId: input.yearGroupId, tutorStaffId: tutor === undefined ? undefined : tutor?.id ?? null, curriculumId: curriculum === undefined ? undefined : curriculum?.id ?? null, departmentId: department === undefined ? undefined : department?.id ?? null }, include: { yearGroup: true, tutor: true, curriculum: true, department: true } });
  await audit(actor, requestId, "academic.class.update", "FormGroup", record); return record;
}
export async function archiveClass(id: string, actor: Actor, requestId: string) {
  const record = await prisma.$transaction(async (tx) => { const group = await tx.formGroup.update({ where: { id }, data: { isActive: false, archivedAt: new Date() } }); await tx.teachingAssignment.updateMany({ where: { formGroupId: id, isActive: true }, data: { isActive: false, archivedAt: new Date() } }); return group; });
  await audit(actor, requestId, "academic.class.archive", "FormGroup", record); return record;
}

export async function createTeacher(input: TeacherInput, actor: Actor, requestId: string) {
  if (await prisma.staff.findUnique({ where: { staffNumber: input.staffNumber } })) throw new AppError(409, "STAFF_NUMBER_EXISTS", "That staff number is already in use.");
  const department = await activeDepartment(input.departmentId || undefined);
  const record = await prisma.staff.create({ data: { staffNumber: input.staffNumber, firstName: input.firstName, lastName: input.lastName, jobTitle: input.jobTitle, departmentId: department?.id, department: department?.name ?? input.department ?? null } });
  await audit(actor, requestId, "academic.teacher.create", "Staff", record); return record;
}
export async function updateTeacher(id: string, input: z.infer<typeof updateTeacherSchema>, actor: Actor, requestId: string) {
  if (!await prisma.staff.findUnique({ where: { id } })) throw new AppError(404, "TEACHER_NOT_FOUND", "Teacher not found.");
  const department = input.departmentId === undefined ? undefined : await activeDepartment(input.departmentId || undefined);
  const record = await prisma.staff.update({ where: { id }, data: { staffNumber: input.staffNumber, firstName: input.firstName, lastName: input.lastName, jobTitle: input.jobTitle, departmentId: department === undefined ? undefined : department?.id ?? null, department: department?.name ?? input.department } });
  await audit(actor, requestId, "academic.teacher.update", "Staff", record); return record;
}
export async function archiveTeacher(id: string, actor: Actor, requestId: string) {
  const record = await prisma.$transaction(async (tx) => { const teacher = await tx.staff.update({ where: { id }, data: { status: "ARCHIVED", archivedAt: new Date() } }); await tx.teachingAssignment.updateMany({ where: { staffId: id, isActive: true }, data: { isActive: false, archivedAt: new Date() } }); return teacher; });
  await audit(actor, requestId, "academic.teacher.archive", "Staff", record); return record;
}

export async function createTeachingAssignment(input: AssignmentInput, actor: Actor, requestId: string) {
  const [group, subject, staff, department] = await Promise.all([prisma.formGroup.findFirst({ where: { id: input.formGroupId, isActive: true, archivedAt: null, AND: [{ OR: [{ curriculumId: null }, { curriculum: { isActive: true, archivedAt: null } }] }, { OR: [{ departmentId: null }, { department: { isActive: true, archivedAt: null } }] }] }, include: { yearGroup: true } }), activeSubject(input.subjectId), activeTeacher(input.staffId), activeDepartment(input.departmentId || undefined)]);
  if (!group) throw new AppError(400, "CLASS_UNAVAILABLE", "The selected class is archived or unavailable.");
  const mapped = await prisma.curriculumSubject.findFirst({ where: { academicYearId: input.academicYearId, yearGroupId: group.yearGroupId, subjectId: subject.id, isActive: true, archivedAt: null } });
  if (!mapped) throw new AppError(400, "SUBJECT_NOT_IN_CURRICULUM", "Assign this subject to the class curriculum before assigning a teacher.");
  const record = await prisma.teachingAssignment.upsert({ where: { academicYearId_formGroupId_subjectId: { academicYearId: input.academicYearId, formGroupId: input.formGroupId, subjectId: input.subjectId } }, update: { staffId: staff!.id, departmentId: department?.id ?? subject.departmentId, isActive: true, archivedAt: null }, create: { academicYearId: input.academicYearId, formGroupId: input.formGroupId, subjectId: input.subjectId, staffId: staff!.id, departmentId: department?.id ?? subject.departmentId } });
  await audit(actor, requestId, "academic.assignment.create", "TeachingAssignment", record); return record;
}
export async function updateTeachingAssignment(id: string, input: z.infer<typeof updateTeachingAssignmentSchema>, actor: Actor, requestId: string) {
  const existing = await prisma.teachingAssignment.findUnique({ where: { id } }); if (!existing) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Teaching assignment not found.");
  const complete = { academicYearId: input.academicYearId ?? existing.academicYearId, formGroupId: input.formGroupId ?? existing.formGroupId, subjectId: input.subjectId ?? existing.subjectId, staffId: input.staffId ?? existing.staffId, departmentId: input.departmentId === undefined ? existing.departmentId ?? "" : input.departmentId };
  await activeSubject(complete.subjectId); await activeTeacher(complete.staffId); await activeDepartment(complete.departmentId || undefined);
  const record = await prisma.teachingAssignment.update({ where: { id }, data: { ...complete, departmentId: nullable(complete.departmentId), isActive: true, archivedAt: null } });
  await audit(actor, requestId, "academic.assignment.update", "TeachingAssignment", record); return record;
}
export async function archiveTeachingAssignment(id: string, actor: Actor, requestId: string) {
  const record = await prisma.teachingAssignment.update({ where: { id }, data: { isActive: false, archivedAt: new Date() } });
  await audit(actor, requestId, "academic.assignment.archive", "TeachingAssignment", record); return record;
}

async function validateAssessment(input: Partial<AssessmentInput>, existing?: { termId: string; dueAt: Date }) {
  const termId = input.termId ?? existing?.termId; const dueAt = input.dueAt ? new Date(input.dueAt) : existing?.dueAt;
  if (!termId || !dueAt) return; const term = await prisma.term.findUnique({ where: { id: termId } }); if (!term) throw new AppError(404, "TERM_NOT_FOUND", "The selected term was not found.");
  if (dueAt < term.startsOn || dueAt > term.endsOn) throw new AppError(400, "DATE_OUTSIDE_TERM", "The due date must fall within the selected term.");
  if (input.subjectId) await activeSubject(input.subjectId);
}
export async function createAssessmentPlan(input: AssessmentInput, actor: Actor, requestId: string) { await validateAssessment(input); const record = await prisma.assessment.create({ data: { title: input.title, termId: input.termId, yearGroupId: input.yearGroupId, subjectId: nullable(input.subjectId), dueAt: new Date(input.dueAt) } }); await audit(actor, requestId, "academic.assessment.create", "Assessment", record); return record; }
export async function updateAssessmentPlan(id: string, input: z.infer<typeof updateAssessmentPlanSchema>, actor: Actor, requestId: string) { const existing = await prisma.assessment.findUnique({ where: { id } }); if (!existing) throw new AppError(404, "ASSESSMENT_NOT_FOUND", "Assessment plan not found."); await validateAssessment(input, existing); const record = await prisma.assessment.update({ where: { id }, data: { ...input, subjectId: input.subjectId === undefined ? undefined : nullable(input.subjectId), dueAt: input.dueAt ? new Date(input.dueAt) : undefined } }); await audit(actor, requestId, "academic.assessment.update", "Assessment", record); return record; }
export async function archiveAssessmentPlan(id: string, actor: Actor, requestId: string) { const record = await prisma.assessment.update({ where: { id }, data: { isActive: false, archivedAt: new Date() } }); await audit(actor, requestId, "academic.assessment.archive", "Assessment", record); return record; }

export async function assignCurriculumSubject(input: MappingInput, actor: Actor, requestId: string) {
  await activeSubject(input.subjectId); await activeCurriculum(input.curriculumId || undefined);
  const record = await prisma.curriculumSubject.upsert({ where: { academicYearId_yearGroupId_subjectId: { academicYearId: input.academicYearId, yearGroupId: input.yearGroupId, subjectId: input.subjectId } }, update: { weeklyPeriods: input.weeklyPeriods, curriculumId: nullable(input.curriculumId), isActive: true, archivedAt: null }, create: { ...input, curriculumId: nullable(input.curriculumId) } });
  await audit(actor, requestId, "academic.curriculum.assign", "CurriculumSubject", record); return record;
}
export async function updateCurriculumSubject(id: string, input: z.infer<typeof updateCurriculumSubjectSchema>, actor: Actor, requestId: string) { if (!await prisma.curriculumSubject.findUnique({ where: { id } })) throw new AppError(404, "CURRICULUM_MAPPING_NOT_FOUND", "Curriculum mapping not found."); if (input.subjectId) await activeSubject(input.subjectId); const record = await prisma.curriculumSubject.update({ where: { id }, data: { ...input, curriculumId: input.curriculumId === undefined ? undefined : nullable(input.curriculumId) } }); await audit(actor, requestId, "academic.curriculum.mapping.update", "CurriculumSubject", record); return record; }
export async function archiveCurriculumSubject(id: string, actor: Actor, requestId: string) { const record = await prisma.curriculumSubject.update({ where: { id }, data: { isActive: false, archivedAt: new Date() } }); await audit(actor, requestId, "academic.curriculum.mapping.archive", "CurriculumSubject", record); return record; }
