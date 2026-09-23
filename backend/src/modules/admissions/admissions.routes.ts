import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { z } from "zod";
import { asyncHandler } from "../../common/async-handler.js";
import { AppError } from "../../common/errors.js";
import { requireAuthentication, requirePermission } from "../../security/auth.middleware.js";
import {
  adminApplicationListSchema,
  admissionTransitionSchema,
  documentCategorySchema,
  enrolApplicationSchema,
  sectionKeys,
  trackApplicationSchema,
  type SectionKey,
} from "./admissions.schemas.js";
import * as admissions from "./admissions.service.js";

const storageDirectory = fileURLToPath(new URL("../../../storage/admissions", import.meta.url));
mkdirSync(storageDirectory, { recursive: true });

const allowedMimeTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["application/pdf", ".pdf"],
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: storageDirectory,
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${allowedMimeTypes.get(file.mimetype) ?? extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) return callback(new AppError(400, "UNSUPPORTED_FILE_TYPE", "Only PDF, JPG, and PNG files are accepted."));
    callback(null, true);
  },
});

const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: "draft-8", legacyHeaders: false });
const createLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false });

export const admissionsRouter = Router();

admissionsRouter.get("/admin/applications", requireAuthentication, requirePermission("admissions.read"), asyncHandler(async (req, res) => {
  res.json({ data: await admissions.listAdminApplications(adminApplicationListSchema.parse(req.query)) });
}));

admissionsRouter.get("/admin/applications/:applicationId", requireAuthentication, requirePermission("admissions.read"), asyncHandler(async (req, res) => {
  res.json({ data: await admissions.getAdminApplication(z.uuid().parse(req.params.applicationId)) });
}));

admissionsRouter.get("/admin/applications/:applicationId/documents/:documentId", requireAuthentication, requirePermission("admissions.read"), asyncHandler(async (req, res) => {
  const applicationId = z.uuid().parse(req.params.applicationId);
  const documentId = z.uuid().parse(req.params.documentId);
  const document = await admissions.getAdminDocument(applicationId, documentId);
  res.type(document.mimeType);
  res.download(join(storageDirectory, document.storedName), document.originalName);
}));

admissionsRouter.post("/admin/applications/:applicationId/transition", requireAuthentication, requirePermission("admissions.manage"), asyncHandler(async (req, res) => {
  const applicationId = z.uuid().parse(req.params.applicationId);
  res.json({ data: await admissions.transitionApplication(applicationId, admissionTransitionSchema.parse(req.body), req.auth!.userId, req.requestId) });
}));

admissionsRouter.post("/admin/applications/:applicationId/enrol", requireAuthentication, requirePermission("admissions.enrol"), asyncHandler(async (req, res) => {
  const applicationId = z.uuid().parse(req.params.applicationId);
  res.json({ data: await admissions.enrolAcceptedApplication(applicationId, enrolApplicationSchema.parse(req.body), req.auth!.userId, req.requestId) });
}));

admissionsRouter.use(publicLimiter);

const applicationToken = (header: string | undefined) => header?.trim() || undefined;

admissionsRouter.post("/applications", createLimiter, asyncHandler(async (req, res) => {
  res.status(201).json({ data: await admissions.startApplication(req.body, req.requestId) });
}));

admissionsRouter.post("/track", createLimiter, asyncHandler(async (req, res) => {
  res.json({ data: await admissions.trackApplication(trackApplicationSchema.parse(req.body)) });
}));

admissionsRouter.get("/applications/:applicationId", asyncHandler(async (req, res) => {
  const id = z.uuid().parse(req.params.applicationId);
  res.json({ data: await admissions.getApplication(id, applicationToken(req.header("x-application-token"))) });
}));

admissionsRouter.patch("/applications/:applicationId/sections/:section", asyncHandler(async (req, res) => {
  const id = z.uuid().parse(req.params.applicationId);
  const section = z.enum(sectionKeys as [SectionKey, ...SectionKey[]]).parse(req.params.section);
  const result = await admissions.saveSection(id, applicationToken(req.header("x-application-token")), section, req.body, req.requestId);
  res.json({ data: result });
}));

admissionsRouter.post(
  "/applications/:applicationId/documents",
  asyncHandler(async (req, _res, next) => {
    const id = z.uuid().parse(req.params.applicationId);
    await admissions.authorizeApplication(id, applicationToken(req.header("x-application-token")));
    next();
  }),
  upload.single("file"),
  asyncHandler(async (req, res) => {
  const id = z.uuid().parse(req.params.applicationId);
  if (!req.file) throw new AppError(400, "FILE_REQUIRED", "Select a document to upload.");
  const categoryResult = documentCategorySchema.safeParse(req.body.category);
  if (!categoryResult.success) {
    await unlink(join(storageDirectory, req.file.filename)).catch(() => undefined);
    throw categoryResult.error;
  }
  const document = await admissions.addDocument(id, applicationToken(req.header("x-application-token")), req.file, categoryResult.data, req.requestId);
  res.status(201).json({ data: document });
  }),
);

admissionsRouter.post("/applications/:applicationId/submit", createLimiter, asyncHandler(async (req, res) => {
  const id = z.uuid().parse(req.params.applicationId);
  res.json({ data: await admissions.submitApplication(id, applicationToken(req.header("x-application-token")), req.requestId) });
}));
