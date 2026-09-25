import { Router } from "express";
import { asyncHandler } from "../../common/async-handler.js";
import { prisma } from "../../db/prisma.js";
import { requireAuthentication, requirePermission } from "../../security/auth.middleware.js";
import {
  createAssessmentPlanSchema, createClassSchema, createCurriculumSchema,
  createDepartmentSchema, createSubjectSchema, createTeacherSchema,
  createTeachingAssignmentSchema, curriculumSubjectSchema,
  updateAssessmentPlanSchema, updateClassSchema, updateCurriculumSchema,
  updateCurriculumSubjectSchema, updateDepartmentSchema, updateSubjectSchema,
  updateTeacherSchema, updateTeachingAssignmentSchema,
} from "./academics.schemas.js";
import * as academics from "./academics.service.js";

export const academicsRouter = Router();
academicsRouter.use(requireAuthentication, requirePermission("academics.read"));

academicsRouter.get("/reference", asyncHandler(async (_req, res) => {
  const [academicYears, yearGroups, subjects, formGroups, houses, departments, curricula, teachers] = await prisma.$transaction([
    prisma.academicYear.findMany({ include: { terms: true }, orderBy: { startsOn: "desc" } }),
    prisma.yearGroup.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.subject.findMany({ where: { isActive: true, archivedAt: null, OR: [{ departmentId: null }, { academicDepartment: { isActive: true, archivedAt: null } }] }, include: { academicDepartment: true }, orderBy: { name: "asc" } }),
    prisma.formGroup.findMany({ where: { isActive: true, archivedAt: null, AND: [{ OR: [{ curriculumId: null }, { curriculum: { isActive: true, archivedAt: null } }] }, { OR: [{ departmentId: null }, { department: { isActive: true, archivedAt: null } }] }] }, include: { yearGroup: { select: { id: true, name: true } }, curriculum: true, department: true }, orderBy: [{ yearGroup: { displayOrder: "asc" } }, { name: "asc" }] }),
    prisma.house.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { isActive: true, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.curriculum.findMany({ where: { isActive: true, archivedAt: null }, include: { yearGroup: true, subjects: { where: { isActive: true, archivedAt: null }, include: { subject: true } } }, orderBy: { name: "asc" } }),
    prisma.staff.findMany({ where: { status: "ACTIVE", archivedAt: null, OR: [{ departmentId: null }, { academicDepartment: { isActive: true, archivedAt: null } }] }, include: { academicDepartment: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
  ]);
  res.json({ data: { academicYears, yearGroups, subjects, formGroups, houses, departments, curricula, teachers } });
}));

academicsRouter.get("/overview", asyncHandler(async (_req, res) => {
  res.json({ data: await academics.getOverview() });
}));

const actor = (req: Express.Request) => ({ userId: req.auth!.userId });
const recordId = (req: { params: Record<string, string | string[]> }) => String(req.params.id);

academicsRouter.post("/subjects", requirePermission("academics.manage"), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await academics.createSubject(createSubjectSchema.parse(req.body), actor(req), req.requestId) });
}));
academicsRouter.patch("/subjects/:id", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.json({ data: await academics.updateSubject(recordId(req), updateSubjectSchema.parse(req.body), actor(req), req.requestId) })));
academicsRouter.post("/subjects/:id/archive", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.json({ data: await academics.archiveSubject(recordId(req), actor(req), req.requestId) })));

academicsRouter.post("/departments", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.status(201).json({ data: await academics.createDepartment(createDepartmentSchema.parse(req.body), actor(req), req.requestId) })));
academicsRouter.patch("/departments/:id", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.json({ data: await academics.updateDepartment(recordId(req), updateDepartmentSchema.parse(req.body), actor(req), req.requestId) })));
academicsRouter.post("/departments/:id/archive", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.json({ data: await academics.archiveDepartment(recordId(req), actor(req), req.requestId) })));

academicsRouter.post("/curricula", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.status(201).json({ data: await academics.createCurriculum(createCurriculumSchema.parse(req.body), actor(req), req.requestId) })));
academicsRouter.patch("/curricula/:id", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.json({ data: await academics.updateCurriculum(recordId(req), updateCurriculumSchema.parse(req.body), actor(req), req.requestId) })));
academicsRouter.post("/curricula/:id/archive", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.json({ data: await academics.archiveCurriculum(recordId(req), actor(req), req.requestId) })));
academicsRouter.post("/classes", requirePermission("academics.manage"), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await academics.createClass(createClassSchema.parse(req.body), actor(req), req.requestId) });
}));
academicsRouter.patch("/classes/:id", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.json({ data: await academics.updateClass(recordId(req), updateClassSchema.parse(req.body), actor(req), req.requestId) })));
academicsRouter.post("/classes/:id/archive", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.json({ data: await academics.archiveClass(recordId(req), actor(req), req.requestId) })));
academicsRouter.post("/teachers", requirePermission("academics.manage"), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await academics.createTeacher(createTeacherSchema.parse(req.body), actor(req), req.requestId) });
}));
academicsRouter.patch("/teachers/:id", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.json({ data: await academics.updateTeacher(recordId(req), updateTeacherSchema.parse(req.body), actor(req), req.requestId) })));
academicsRouter.post("/teachers/:id/archive", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.json({ data: await academics.archiveTeacher(recordId(req), actor(req), req.requestId) })));

academicsRouter.post("/teaching-assignments", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.status(201).json({ data: await academics.createTeachingAssignment(createTeachingAssignmentSchema.parse(req.body), actor(req), req.requestId) })));
academicsRouter.patch("/teaching-assignments/:id", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.json({ data: await academics.updateTeachingAssignment(recordId(req), updateTeachingAssignmentSchema.parse(req.body), actor(req), req.requestId) })));
academicsRouter.post("/teaching-assignments/:id/archive", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.json({ data: await academics.archiveTeachingAssignment(recordId(req), actor(req), req.requestId) })));
academicsRouter.post("/assessment-plans", requirePermission("academics.manage"), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await academics.createAssessmentPlan(createAssessmentPlanSchema.parse(req.body), actor(req), req.requestId) });
}));
academicsRouter.patch("/assessment-plans/:id", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.json({ data: await academics.updateAssessmentPlan(recordId(req), updateAssessmentPlanSchema.parse(req.body), actor(req), req.requestId) })));
academicsRouter.post("/assessment-plans/:id/archive", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.json({ data: await academics.archiveAssessmentPlan(recordId(req), actor(req), req.requestId) })));
academicsRouter.post("/curriculum", requirePermission("academics.manage"), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await academics.assignCurriculumSubject(curriculumSubjectSchema.parse(req.body), actor(req), req.requestId) });
}));
academicsRouter.patch("/curriculum/:id", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.json({ data: await academics.updateCurriculumSubject(recordId(req), updateCurriculumSubjectSchema.parse(req.body), actor(req), req.requestId) })));
academicsRouter.post("/curriculum/:id/archive", requirePermission("academics.manage"), asyncHandler(async (req, res) => res.json({ data: await academics.archiveCurriculumSubject(recordId(req), actor(req), req.requestId) })));
