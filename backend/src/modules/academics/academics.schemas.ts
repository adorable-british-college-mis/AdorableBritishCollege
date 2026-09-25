import { z } from "zod";

const optionalId = z.uuid().optional().or(z.literal(""));

export const createSubjectSchema = z.object({
  code: z.string().trim().min(2).max(16).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(100),
  departmentId: optionalId,
  department: z.string().trim().min(2).max(100).optional(),
});
export const updateSubjectSchema = createSubjectSchema.partial();

export const createDepartmentSchema = z.object({
  code: z.string().trim().min(2).max(16).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
});
export const updateDepartmentSchema = createDepartmentSchema.partial();

export const createCurriculumSchema = z.object({
  code: z.string().trim().min(2).max(24).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().max(500).optional(),
  academicYearId: z.uuid(),
  yearGroupId: optionalId,
  subjectIds: z.array(z.uuid()).default([]),
});
export const updateCurriculumSchema = createCurriculumSchema.partial();

export const createClassSchema = z.object({
  code: z.string().trim().min(2).max(20).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(100),
  yearGroupId: z.uuid(),
  tutorStaffId: optionalId,
  curriculumId: optionalId,
  departmentId: optionalId,
});
export const updateClassSchema = createClassSchema.partial();

export const createTeacherSchema = z.object({
  staffNumber: z.string().trim().min(2).max(32).transform((value) => value.toUpperCase()),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  departmentId: optionalId,
  department: z.string().trim().max(100).optional(),
  jobTitle: z.string().trim().min(2).max(100).default("Teacher"),
});
export const updateTeacherSchema = createTeacherSchema.partial();

export const createTeachingAssignmentSchema = z.object({
  academicYearId: z.uuid(),
  formGroupId: z.uuid(),
  subjectId: z.uuid(),
  staffId: z.uuid(),
  departmentId: optionalId,
});
export const updateTeachingAssignmentSchema = createTeachingAssignmentSchema.partial();

export const createAssessmentPlanSchema = z.object({
  title: z.string().trim().min(2).max(140),
  termId: z.uuid(),
  yearGroupId: z.uuid(),
  subjectId: optionalId,
  dueAt: z.iso.datetime(),
});
export const updateAssessmentPlanSchema = createAssessmentPlanSchema.partial();

export const curriculumSubjectSchema = z.object({
  academicYearId: z.uuid(),
  yearGroupId: z.uuid(),
  subjectId: z.uuid(),
  curriculumId: optionalId,
  weeklyPeriods: z.coerce.number().int().min(1).max(20),
});
export const updateCurriculumSubjectSchema = curriculumSubjectSchema.partial();
