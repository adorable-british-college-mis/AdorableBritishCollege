import { Router, type Request } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/async-handler.js";
import { requireAuthentication, requirePermission } from "../../security/auth.middleware.js";
import { announcementSchema, assistantDraftSchema, createThreadSchema, sendMessageSchema, updateAnnouncementSchema } from "./communication.schemas.js";
import * as communication from "./communication.service.js";
import { providerConfiguration, verifyResendSignature, verifyTwilioSignature } from "./communication.providers.js";

export const communicationRouter = Router();
const actor = (req: Request) => ({ userId: req.auth!.userId });
const id = (req: Request) => z.uuid().parse(req.params.id);

communicationRouter.post("/webhooks/twilio/status", asyncHandler(async (req, res) => {
  const config = providerConfiguration();
  const signature = String(req.header("x-twilio-signature") ?? "");
  const url = `${config.publicUrl}${req.originalUrl}`;
  if (!config.publicUrl || !verifyTwilioSignature(url, req.body as Record<string, unknown>, signature, config)) return res.status(401).json({ error: { code: "INVALID_WEBHOOK_SIGNATURE", message: "Invalid Twilio webhook signature." } });
  const payload = z.object({ MessageSid: z.string().min(1), MessageStatus: z.string().min(1), ErrorCode: z.string().optional(), ErrorMessage: z.string().optional() }).passthrough().parse(req.body);
  await communication.updateTwilioDelivery(payload.MessageSid, payload.MessageStatus, payload.ErrorCode, payload.ErrorMessage);
  return res.status(204).send();
}));

communicationRouter.post("/webhooks/twilio/incoming", asyncHandler(async (req, res) => {
  const config = providerConfiguration();
  const signature = String(req.header("x-twilio-signature") ?? "");
  const url = `${config.publicUrl}${req.originalUrl}`;
  if (!config.publicUrl || !verifyTwilioSignature(url, req.body as Record<string, unknown>, signature, config)) return res.status(401).type("text/xml").send("<Response/>");
  const payload = z.object({ MessageSid: z.string().min(1), From: z.string().min(1), Body: z.string().trim().min(1).max(10_000) }).passthrough().parse(req.body);
  await communication.receiveWhatsAppMessage(payload.From, payload.Body, payload.MessageSid);
  return res.status(200).type("text/xml").send("<Response/>");
}));

communicationRouter.post("/webhooks/resend", asyncHandler(async (req, res) => {
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
  const headers = { id: req.header("svix-id") ?? undefined, timestamp: req.header("svix-timestamp") ?? undefined, signature: req.header("svix-signature") ?? undefined };
  if (!verifyResendSignature(rawBody, headers)) return res.status(401).json({ error: { code: "INVALID_WEBHOOK_SIGNATURE", message: "Invalid Resend webhook signature." } });
  const payload = z.object({ type: z.string().min(1), data: z.object({ email_id: z.string().min(1) }).passthrough() }).passthrough().parse(req.body);
  await communication.updateResendDelivery(payload.data.email_id, payload.type);
  return res.status(204).send();
}));

communicationRouter.use(requireAuthentication, requirePermission("communication.read"));
communicationRouter.get("/overview", asyncHandler(async (_req, res) => res.json({ data: await communication.getOverview() })));
communicationRouter.post("/assistant/draft", requirePermission("communication.manage"), asyncHandler(async (req, res) => res.json({ data: communication.draftWithAssistant(assistantDraftSchema.parse(req.body)) })));
communicationRouter.post("/threads", requirePermission("communication.manage"), asyncHandler(async (req, res) => res.status(201).json({ data: await communication.createThread(createThreadSchema.parse(req.body), actor(req), req.requestId) })));
communicationRouter.post("/threads/:id/messages", requirePermission("communication.manage"), asyncHandler(async (req, res) => res.status(201).json({ data: await communication.sendMessage(id(req), sendMessageSchema.parse(req.body), actor(req), req.requestId) })));
communicationRouter.post("/threads/:id/read", asyncHandler(async (req, res) => res.json({ data: await communication.markThreadRead(id(req)) })));
communicationRouter.post("/threads/:id/archive", requirePermission("communication.manage"), asyncHandler(async (req, res) => res.json({ data: await communication.archiveThread(id(req), actor(req), req.requestId) })));
communicationRouter.post("/announcements", requirePermission("communication.manage"), asyncHandler(async (req, res) => res.status(201).json({ data: await communication.createAnnouncement(announcementSchema.parse(req.body), actor(req), req.requestId) })));
communicationRouter.patch("/announcements/:id", requirePermission("communication.manage"), asyncHandler(async (req, res) => res.json({ data: await communication.updateAnnouncement(id(req), updateAnnouncementSchema.parse(req.body), actor(req), req.requestId) })));
communicationRouter.post("/announcements/:id/archive", requirePermission("communication.manage"), asyncHandler(async (req, res) => res.json({ data: await communication.archiveAnnouncement(id(req), actor(req), req.requestId) })));
