import { Router } from "express";
import { asyncHandler } from "../../common/async-handler.js";
import { prisma } from "../../db/prisma.js";
import { requireAuthentication, requirePermission } from "../../security/auth.middleware.js";

export const academicsRouter = Router();
academicsRouter.use(requireAuthentication, requirePermission("academics.read"));

academicsRouter.get("/reference", asyncHandler(async (_req, res) => {
  const [academicYears, yearGroups, subjects, formGroups, houses] = await prisma.$transaction([
    prisma.academicYear.findMany({ include: { terms: true }, orderBy: { startsOn: "desc" } }),
    prisma.yearGroup.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.subject.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.formGroup.findMany({ where: { isActive: true }, include: { yearGroup: { select: { id: true, name: true } } }, orderBy: [{ yearGroup: { displayOrder: "asc" } }, { name: "asc" }] }),
    prisma.house.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  res.json({ data: { academicYears, yearGroups, subjects, formGroups, houses } });
}));
