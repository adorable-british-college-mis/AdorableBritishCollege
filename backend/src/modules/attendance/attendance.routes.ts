import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/async-handler.js";
import { requireAuthentication, requirePermission } from "../../security/auth.middleware.js";
import { openRegisterSchema, saveRegisterSchema } from "./attendance.schemas.js";
import * as attendance from "./attendance.service.js";

export const attendanceRouter = Router();
attendanceRouter.use(requireAuthentication);
const actor = (req: Express.Request) => ({ userId: req.auth!.userId });

attendanceRouter.get("/overview", requirePermission("attendance.read"), asyncHandler(async (_req, res) => res.json({ data: await attendance.getAttendanceOverview() })));
attendanceRouter.post("/registers", requirePermission("attendance.manage"), asyncHandler(async (req, res) => res.status(201).json({ data: await attendance.openRegister(openRegisterSchema.parse(req.body), actor(req), req.requestId) })));
attendanceRouter.get("/registers/:registerId", requirePermission("attendance.read"), asyncHandler(async (req, res) => res.json({ data: await attendance.getRegister(z.uuid().parse(req.params.registerId)) })));
attendanceRouter.patch("/registers/:registerId/draft", requirePermission("attendance.manage"), asyncHandler(async (req, res) => res.json({ data: await attendance.saveDraft(z.uuid().parse(req.params.registerId), saveRegisterSchema.parse(req.body), actor(req), req.requestId) })));
attendanceRouter.post("/registers/:registerId/submit", requirePermission("attendance.manage"), asyncHandler(async (req, res) => res.json({ data: await attendance.submitRegister(z.uuid().parse(req.params.registerId), saveRegisterSchema.parse(req.body), actor(req), req.requestId) })));
