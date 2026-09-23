import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

interface AuditInput {
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  requestId: string;
  outcome?: "SUCCESS" | "FAILURE";
  ipAddress?: string;
  userAgent?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

export async function recordAuditEvent(input: AuditInput): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      requestId: input.requestId,
      outcome: input.outcome ?? "SUCCESS",
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
      ...(input.before ? { before: input.before } : {}),
      ...(input.after ? { after: input.after } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
  });
}
