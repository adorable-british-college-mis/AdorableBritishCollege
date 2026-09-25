import { z } from "zod";

export const recipientSchema = z.object({
  type: z.enum(["STUDENT", "GUARDIAN", "STAFF", "USER"]),
  id: z.uuid(),
});

export const createThreadSchema = z.object({
  subject: z.string().trim().min(2).max(180),
  type: z.enum(["DIRECT", "GROUP"]).default("DIRECT"),
  channel: z.enum(["PORTAL", "EMAIL", "WHATSAPP"]).default("PORTAL"),
  recipients: z.array(recipientSchema).min(1).max(80),
  body: z.string().trim().min(1).max(10_000),
  saveAsDraft: z.boolean().default(false),
  assisted: z.boolean().default(false),
});

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  saveAsDraft: z.boolean().default(false),
  assisted: z.boolean().default(false),
});

const audienceSchema = z.object({
  type: z.enum(["ALL", "STUDENTS", "GUARDIANS", "STAFF", "YEAR_GROUP", "CUSTOM"]),
  ids: z.array(z.uuid()).max(100).default([]),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(2).max(180),
  body: z.string().trim().min(1).max(10_000),
  audience: audienceSchema,
  audienceLabel: z.string().trim().min(2).max(160),
  priority: z.enum(["NORMAL", "IMPORTANT", "URGENT"]).default("NORMAL"),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  publishAt: z.union([z.iso.datetime(), z.literal("")]).optional().default(""),
  expiresAt: z.union([z.iso.datetime(), z.literal("")]).optional().default(""),
  assisted: z.boolean().default(false),
});
export const updateAnnouncementSchema = announcementSchema.partial();

export const assistantDraftSchema = z.object({
  intent: z.enum(["MESSAGE", "ANNOUNCEMENT", "FOLLOW_UP"]),
  tone: z.enum(["WARM", "FORMAL", "CONCISE", "SUPPORTIVE"]).default("WARM"),
  audienceLabel: z.string().trim().min(2).max(160),
  context: z.object({
    type: z.string().trim().max(80),
    title: z.string().trim().max(180),
    details: z.string().trim().max(1000),
  }).optional(),
  instruction: z.string().trim().max(1000).optional().default(""),
});
