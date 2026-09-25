import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/async-handler.js";
import { requireAuthentication, requirePermission } from "../../security/auth.middleware.js";
import { createCoverSchema, createLessonSchema, updateLessonSchema } from "./timetable.schemas.js";
import * as timetable from "./timetable.service.js";

export const timetableRouter = Router();
timetableRouter.use(requireAuthentication, requirePermission("timetable.read"));
timetableRouter.get("/overview", asyncHandler(async (_req, res) => res.json({ data: await timetable.getTimetableOverview() })));
timetableRouter.post("/lessons", requirePermission("timetable.manage"), asyncHandler(async (req, res) => res.status(201).json({ data: await timetable.createLesson(createLessonSchema.parse(req.body), { userId: req.auth!.userId }, req.requestId) })));
timetableRouter.patch("/lessons/:lessonId", requirePermission("timetable.manage"), asyncHandler(async (req, res) => res.json({ data: await timetable.updateLesson(z.uuid().parse(req.params.lessonId), updateLessonSchema.parse(req.body), { userId: req.auth!.userId }, req.requestId) })));
timetableRouter.post("/covers", requirePermission("timetable.manage"), asyncHandler(async (req, res) => res.status(201).json({ data: await timetable.createCover(createCoverSchema.parse(req.body), { userId: req.auth!.userId }, req.requestId) })));
