import { Router } from "express";
import { asyncHandler } from "../../common/async-handler.js";
import { requireAuthentication, requirePermission } from "../../security/auth.middleware.js";
import { getDashboardSummary } from "./dashboard.service.js";

export const dashboardRouter = Router();
dashboardRouter.use(
  requireAuthentication,
  requirePermission("students.read.all"),
  requirePermission("admissions.read"),
  requirePermission("audit.read"),
);
dashboardRouter.get("/summary", asyncHandler(async (_req, res) => {
  res.json({ data: await getDashboardSummary() });
}));
