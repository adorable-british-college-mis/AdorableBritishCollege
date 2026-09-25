import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const optionalUuid = z.union([z.uuid(), z.literal("")]).optional().default("");

export const behaviourCategorySchema = z.object({
  code: z.string().trim().min(2).max(20).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(100),
  type: z.enum(["POSITIVE", "INCIDENT"]),
  defaultPoints: z.coerce.number().int().min(-100).max(100),
  description: optionalText(500),
});
export const updateBehaviourCategorySchema = behaviourCategorySchema.partial();

export const behaviourEventSchema = z.object({
  studentId: z.uuid(), termId: z.uuid(), categoryId: z.uuid(), staffId: optionalUuid,
  formGroupId: optionalUuid, type: z.enum(["POSITIVE", "INCIDENT"]),
  status: z.enum(["OPEN", "RESOLVED", "ESCALATED"]).default("OPEN"),
  summary: z.string().trim().min(2).max(160), details: optionalText(1500),
  location: optionalText(120), points: z.coerce.number().int().min(-100).max(100),
  occurredAt: z.iso.datetime(),
});
export const updateBehaviourEventSchema = behaviourEventSchema.partial();

export const behaviourRewardSchema = z.object({
  studentId: z.uuid(), termId: z.uuid(), staffId: optionalUuid,
  title: z.string().trim().min(2).max(160), description: optionalText(1500),
  points: z.coerce.number().int().min(1).max(100), awardedAt: z.iso.datetime(),
  status: z.enum(["AWARDED", "REVOKED"]).default("AWARDED"),
});
export const updateBehaviourRewardSchema = behaviourRewardSchema.partial();

export const behaviourSanctionSchema = z.object({
  studentId: z.uuid(), termId: z.uuid(), staffId: optionalUuid,
  behaviourEventId: optionalUuid,
  type: z.enum(["DETENTION", "INTERNAL_EXCLUSION", "SUSPENSION", "COMMUNITY_SERVICE", "REPORT_CARD", "OTHER"]),
  status: z.enum(["PENDING", "ACTIVE", "COMPLETED", "CANCELLED"]).default("PENDING"),
  title: z.string().trim().min(2).max(160), description: optionalText(1500),
  scheduledFor: z.union([z.iso.datetime(), z.literal("")]).optional().default(""),
  completedAt: z.union([z.iso.datetime(), z.literal("")]).optional().default(""),
});
export const updateBehaviourSanctionSchema = behaviourSanctionSchema.partial();
