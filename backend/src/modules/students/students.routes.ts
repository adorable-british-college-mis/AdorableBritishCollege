import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/async-handler.js";
import { requireAuthentication, requirePermission } from "../../security/auth.middleware.js";
import { createStudentSchema, studentListSchema } from "./student.schemas.js";
import * as students from "./students.service.js";

export const studentsRouter = Router();
studentsRouter.use(requireAuthentication);

const context = (auth: NonNullable<Express.Request["auth"]>) => ({ userId: auth.userId, roles: auth.roles, permissions: auth.permissions });

studentsRouter.get("/stats", requirePermission("students.read"), asyncHandler(async (req, res) => {
  res.json({ data: await students.getStudentStats(context(req.auth!)) });
}));

studentsRouter.get("/", requirePermission("students.read"), asyncHandler(async (req, res) => {
  const query = studentListSchema.parse(req.query);
  res.json({ data: await students.listStudents(query, context(req.auth!)) });
}));

studentsRouter.get("/:studentId", requirePermission("students.read"), asyncHandler(async (req, res) => {
  const studentId = z.uuid().parse(req.params.studentId);
  res.json({ data: await students.getStudent(studentId, context(req.auth!)) });
}));

studentsRouter.post("/", requirePermission("students.create"), asyncHandler(async (req, res) => {
  const input = createStudentSchema.parse(req.body);
  const student = await students.createStudent(input, context(req.auth!), req.requestId);
  res.status(201).json({ data: student });
}));

studentsRouter.post("/:studentId/archive", requirePermission("students.archive"), asyncHandler(async (req, res) => {
  const studentId = z.uuid().parse(req.params.studentId);
  res.json({ data: await students.archiveStudent(studentId, context(req.auth!), req.requestId) });
}));
