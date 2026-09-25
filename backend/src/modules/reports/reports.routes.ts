import { Router, type Request } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/async-handler.js";
import { requireAuthentication, requirePermission } from "../../security/auth.middleware.js";
import { generateReportSchema, reportFiltersSchema } from "./reports.schemas.js";
import * as reports from "./reports.service.js";

export const reportsRouter = Router();
const actor = (req: Request) => ({ userId: req.auth!.userId });
const id = (req: Request) => z.uuid().parse(req.params.reportId);

reportsRouter.use(requireAuthentication, requirePermission("reports.read"));
reportsRouter.get("/overview", asyncHandler(async (req, res) => res.json({ data: await reports.getOverview(reportFiltersSchema.parse(req.query)) })));
reportsRouter.post("/generate", requirePermission("reports.manage"), asyncHandler(async (req, res) => res.status(201).json({ data: await reports.generateReport(generateReportSchema.parse(req.body), actor(req), req.requestId) })));
reportsRouter.get("/:reportId", asyncHandler(async (req, res) => res.json({ data: await reports.getReport(id(req)) })));
reportsRouter.get("/:reportId/download", asyncHandler(async (req, res) => {
  const download = await reports.downloadReport(id(req));
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="${download.filename}"`);
  res.send(download.csv);
}));
reportsRouter.post("/:reportId/archive", requirePermission("reports.manage"), asyncHandler(async (req, res) => res.json({ data: await reports.archiveReport(id(req), actor(req), req.requestId) })));
