import type { CommunicationParticipantType, Prisma } from "@prisma/client";
import type { z } from "zod";
import { AppError } from "../../common/errors.js";
import { prisma } from "../../db/prisma.js";
import { recordAuditEvent } from "../audit/audit.service.js";
import type { announcementSchema, assistantDraftSchema, createThreadSchema, sendMessageSchema, updateAnnouncementSchema } from "./communication.schemas.js";
import { DeliveryProviderError, getProviderReadiness, normalizePhoneNumber, sendEmail, sendWhatsApp } from "./communication.providers.js";

type Actor = { userId: string };
type ThreadInput = z.infer<typeof createThreadSchema>;
type MessageInput = z.infer<typeof sendMessageSchema>;
type AnnouncementInput = z.infer<typeof announcementSchema>;
type AnnouncementUpdate = z.infer<typeof updateAnnouncementSchema>;
type AssistantInput = z.infer<typeof assistantDraftSchema>;

const threadInclude = {
  participants: { orderBy: { displayName: "asc" as const } },
  messages: {
    where: { archivedAt: null },
    include: { sender: { select: { id: true, firstName: true, lastName: true } }, senderParticipant: true, deliveries: { include: { participant: true }, orderBy: { createdAt: "asc" as const } } },
    orderBy: { createdAt: "asc" as const },
  },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.CommunicationThreadInclude;

async function resolveRecipients(recipients: ThreadInput["recipients"]) {
  const unique = [...new Map(recipients.map((recipient) => [`${recipient.type}:${recipient.id}`, recipient])).values()];
  const ids = (type: CommunicationParticipantType) => unique.filter((item) => item.type === type).map((item) => item.id);
  const [students, guardians, staff, users] = await Promise.all([
    prisma.student.findMany({ where: { id: { in: ids("STUDENT") }, archivedAt: null, status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, email: true, phone: true } }),
    prisma.parentGuardian.findMany({ where: { id: { in: ids("GUARDIAN") }, archivedAt: null }, select: { id: true, firstName: true, lastName: true, email: true, phone: true } }),
    prisma.staff.findMany({ where: { id: { in: ids("STAFF") }, archivedAt: null, status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, jobTitle: true, user: { select: { email: true } } } }),
    prisma.user.findMany({ where: { id: { in: ids("USER") }, archivedAt: null, status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, email: true } }),
  ]);
  const resolved = [
    ...students.map((item) => ({ type: "STUDENT" as const, entityId: item.id, displayName: `${item.firstName} ${item.lastName}`, roleLabel: "Student", email: item.email, phone: item.phone })),
    ...guardians.map((item) => ({ type: "GUARDIAN" as const, entityId: item.id, displayName: `${item.firstName} ${item.lastName}`, roleLabel: "Parent / Guardian", email: item.email, phone: item.phone })),
    ...staff.map((item) => ({ type: "STAFF" as const, entityId: item.id, displayName: `${item.firstName} ${item.lastName}`, roleLabel: item.jobTitle, email: item.user?.email, phone: null })),
    ...users.map((item) => ({ type: "USER" as const, entityId: item.id, displayName: `${item.firstName} ${item.lastName}`, roleLabel: "System User", email: item.email, phone: null })),
  ];
  if (resolved.length !== unique.length) throw new AppError(400, "RECIPIENT_UNAVAILABLE", "One or more selected recipients are no longer active.");
  return resolved;
}

function startOfDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export async function getOverview() {
  const now = new Date();
  const today = startOfDay(now);
  const soon = new Date(today.getTime() + 7 * 86_400_000);
  const academicYear = await prisma.academicYear.findFirst({ where: { isCurrent: true }, include: { terms: { orderBy: { startsOn: "asc" } } } })
    ?? await prisma.academicYear.findFirst({ include: { terms: { orderBy: { startsOn: "asc" } } }, orderBy: { startsOn: "desc" } });
  const currentTerm = academicYear?.terms.find((term) => term.startsOn <= now && term.endsOn >= now) ?? academicYear?.terms[0] ?? null;

  const [threads, announcements, students, guardians, staff, yearGroups, sentCount, queuedCount, attendanceEvents, behaviourEvents, admissionEvents, assessmentEvents] = await Promise.all([
    prisma.communicationThread.findMany({ where: { archivedAt: null }, include: threadInclude, orderBy: { lastMessageAt: "desc" }, take: 100 }),
    prisma.announcement.findMany({ where: { archivedAt: null }, include: { createdBy: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.student.findMany({ where: { archivedAt: null, status: "ACTIVE", ...(academicYear ? { enrollments: { some: { academicYearId: academicYear.id } } } : {}) }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, admissionNumber: true, enrollments: { where: academicYear ? { academicYearId: academicYear.id } : {}, select: { yearGroup: { select: { id: true, name: true } } }, take: 1 }, guardians: { select: { guardian: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.parentGuardian.findMany({ where: { archivedAt: null }, select: { id: true, firstName: true, lastName: true, email: true, phone: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.staff.findMany({ where: { archivedAt: null, status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, jobTitle: true, user: { select: { email: true } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    prisma.yearGroup.findMany({ orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
    prisma.communicationMessage.count({ where: { status: { in: ["SENT", "DELIVERED"] }, archivedAt: null } }),
    prisma.communicationMessage.count({ where: { status: "QUEUED", archivedAt: null } }),
    currentTerm ? prisma.attendanceRecord.findMany({ where: { status: { in: ["ABSENT", "UNAUTHORISED_ABSENCE", "LATE"] }, register: { termId: currentTerm.id } }, select: { id: true, status: true, note: true, markedAt: true, student: { select: { id: true, firstName: true, lastName: true, guardians: { where: { isPrimaryContact: true }, select: { guardianId: true } } } }, register: { select: { date: true, periodLabel: true } } }, orderBy: { markedAt: "desc" }, take: 4 }) : Promise.resolve([]),
    currentTerm ? prisma.behaviourEvent.findMany({ where: { termId: currentTerm.id, type: "INCIDENT", status: { in: ["OPEN", "ESCALATED"] }, archivedAt: null }, select: { id: true, summary: true, status: true, occurredAt: true, student: { select: { id: true, firstName: true, lastName: true, guardians: { where: { isPrimaryContact: true }, select: { guardianId: true } } } } }, orderBy: { occurredAt: "desc" }, take: 4 }) : Promise.resolve([]),
    prisma.admissionApplication.findMany({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "OFFERED", "ACCEPTED"] } }, select: { id: true, applicationNumber: true, firstName: true, lastName: true, email: true, status: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 4 }),
    currentTerm ? prisma.assessment.findMany({ where: { termId: currentTerm.id, dueAt: { gte: today, lte: soon }, isActive: true, archivedAt: null }, select: { id: true, title: true, dueAt: true, yearGroup: { select: { id: true, name: true } }, subject: { select: { name: true } } }, orderBy: { dueAt: "asc" }, take: 4 }) : Promise.resolve([]),
  ]);

  const liveEvents = [
    ...attendanceEvents.map((event) => ({ id: `attendance:${event.id}`, type: "ATTENDANCE", severity: event.status === "UNAUTHORISED_ABSENCE" ? "HIGH" : "MEDIUM", title: `${event.student.firstName} ${event.student.lastName}: ${event.status.replaceAll("_", " ").toLowerCase()}`, detail: `${event.register.periodLabel} on ${event.register.date.toISOString().slice(0, 10)}${event.note ? ` · ${event.note}` : ""}`, occurredAt: event.markedAt, recipients: [{ type: "STUDENT", id: event.student.id }, ...event.student.guardians.map((item) => ({ type: "GUARDIAN", id: item.guardianId }))] })),
    ...behaviourEvents.map((event) => ({ id: `behaviour:${event.id}`, type: "BEHAVIOUR", severity: event.status === "ESCALATED" ? "HIGH" : "MEDIUM", title: `${event.student.firstName} ${event.student.lastName}: ${event.summary}`, detail: `${event.status.toLowerCase()} behaviour follow-up`, occurredAt: event.occurredAt, recipients: [{ type: "STUDENT", id: event.student.id }, ...event.student.guardians.map((item) => ({ type: "GUARDIAN", id: item.guardianId }))] })),
    ...admissionEvents.map((event) => ({ id: `admission:${event.id}`, type: "ADMISSIONS", severity: "INFO", title: `${event.firstName} ${event.lastName}: application ${event.status.toLowerCase().replaceAll("_", " ")}`, detail: event.applicationNumber, occurredAt: event.updatedAt, recipients: [] as Array<{ type: string; id: string }> })),
    ...assessmentEvents.map((event) => ({ id: `assessment:${event.id}`, type: "ACADEMIC", severity: "INFO", title: `${event.title} due soon`, detail: `${event.yearGroup.name}${event.subject ? ` · ${event.subject.name}` : ""} · ${event.dueAt.toISOString().slice(0, 10)}`, occurredAt: event.dueAt, recipients: [] as Array<{ type: string; id: string }> })),
  ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, 8);

  return {
    academicYear, currentTerm, threads, announcements, liveEvents,
    stats: { messagesSent: sentCount, announcements: announcements.filter((item) => item.status === "PUBLISHED").length, groupChats: threads.filter((item) => item.type === "GROUP").length, queuedEmails: queuedCount, drafts: threads.flatMap((item) => item.messages).filter((item) => item.status === "DRAFT").length + announcements.filter((item) => item.status === "DRAFT").length },
    providers: getProviderReadiness(),
    reference: { students, guardians, staff, yearGroups },
  };
}

async function refreshMessageStatus(messageId: string) {
  const deliveries = await prisma.communicationDelivery.findMany({ where: { messageId } });
  if (!deliveries.length) return;
  const status = deliveries.every((item) => item.status === "DELIVERED") ? "DELIVERED"
    : deliveries.every((item) => item.status === "FAILED") ? "FAILED"
      : deliveries.some((item) => item.status === "SENT" || item.status === "DELIVERED") ? "SENT" : "QUEUED";
  const sentAt = deliveries.some((item) => item.sentAt) ? deliveries.find((item) => item.sentAt)?.sentAt : null;
  await prisma.communicationMessage.update({ where: { id: messageId }, data: { status, sentAt } });
}

async function dispatchMessage(messageId: string) {
  const message = await prisma.communicationMessage.findUnique({
    where: { id: messageId },
    include: { thread: { include: { participants: true } }, deliveries: true },
  });
  if (!message || message.status === "DRAFT" || message.thread.channel === "PORTAL") return;
  if (!message.deliveries.length) {
    await prisma.communicationDelivery.createMany({ data: message.thread.participants.map((participant) => ({
      messageId: message.id,
      participantId: participant.id,
      channel: message.thread.channel,
      destination: message.thread.channel === "EMAIL" ? participant.email! : normalizePhoneNumber(participant.phone!)!,
      provider: message.thread.channel === "EMAIL" ? "RESEND" : "TWILIO",
    })) });
  }
  const deliveries = await prisma.communicationDelivery.findMany({ where: { messageId }, include: { participant: true } });
  await Promise.all(deliveries.map(async (delivery) => {
    try {
      const result = delivery.channel === "EMAIL"
        ? await sendEmail({ to: delivery.destination, subject: message.thread.subject, body: message.body })
        : await sendWhatsApp({ to: delivery.destination, body: `*${message.thread.subject}*\n\n${message.body}` });
      await prisma.communicationDelivery.update({ where: { id: delivery.id }, data: { status: "SENT", providerId: result.providerId, sentAt: new Date(), errorCode: null, errorMessage: null, failedAt: null } });
    } catch (error) {
      const providerError = error instanceof DeliveryProviderError ? error : new DeliveryProviderError("PROVIDER_ERROR", error instanceof Error ? error.message : "The provider request failed.");
      await prisma.communicationDelivery.update({ where: { id: delivery.id }, data: { status: "FAILED", errorCode: providerError.code, errorMessage: providerError.message, failedAt: new Date() } });
    }
  }));
  await refreshMessageStatus(messageId);
}

export async function updateTwilioDelivery(providerId: string, providerStatus: string, errorCode?: string, errorMessage?: string) {
  const existing = await prisma.communicationDelivery.findFirst({ where: { provider: "TWILIO", providerId } });
  if (!existing) return { updated: false };
  const failed = ["failed", "undelivered", "canceled"].includes(providerStatus.toLowerCase());
  const delivered = ["delivered", "read"].includes(providerStatus.toLowerCase());
  await prisma.communicationDelivery.update({ where: { id: existing.id }, data: {
    status: failed ? "FAILED" : delivered ? "DELIVERED" : "SENT",
    deliveredAt: delivered ? new Date() : undefined,
    failedAt: failed ? new Date() : undefined,
    errorCode: failed ? errorCode ?? providerStatus : null,
    errorMessage: failed ? errorMessage ?? "WhatsApp delivery failed." : null,
  } });
  await refreshMessageStatus(existing.messageId);
  return { updated: true };
}

export async function updateResendDelivery(providerId: string, eventType: string) {
  const existing = await prisma.communicationDelivery.findFirst({ where: { provider: "RESEND", providerId } });
  if (!existing) return { updated: false };
  const failed = ["email.bounced", "email.complained", "email.failed"].includes(eventType);
  const delivered = eventType === "email.delivered";
  await prisma.communicationDelivery.update({ where: { id: existing.id }, data: {
    status: failed ? "FAILED" : delivered ? "DELIVERED" : "SENT",
    deliveredAt: delivered ? new Date() : undefined,
    failedAt: failed ? new Date() : undefined,
    errorCode: failed ? eventType : null,
    errorMessage: failed ? "The email provider reported a delivery failure." : null,
  } });
  await refreshMessageStatus(existing.messageId);
  return { updated: true };
}

export async function receiveWhatsAppMessage(from: string, body: string, providerId: string) {
  const phone = normalizePhoneNumber(from.replace(/^whatsapp:/i, ""));
  if (!phone) return { received: false, reason: "INVALID_PHONE" };
  const candidates = await prisma.communicationParticipant.findMany({
    where: { type: "GUARDIAN", phone: { not: null }, thread: { channel: "WHATSAPP", archivedAt: null } },
    include: { thread: true },
    orderBy: { thread: { lastMessageAt: "desc" } },
  });
  const participant = candidates.find((item) => item.phone && normalizePhoneNumber(item.phone) === phone);
  if (!participant) return { received: false, reason: "CONVERSATION_NOT_FOUND" };
  const duplicate = await prisma.communicationMessage.findFirst({ where: { threadId: participant.threadId, body, senderParticipantId: participant.id, createdAt: { gte: new Date(Date.now() - 60_000) } } });
  if (duplicate) return { received: true, duplicate: true, messageId: duplicate.id };
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.communicationMessage.create({ data: { threadId: participant.threadId, senderParticipantId: participant.id, body, status: "DELIVERED", sentAt: new Date() } });
    await tx.communicationThread.update({ where: { id: participant.threadId }, data: { lastMessageAt: new Date() } });
    return created;
  });
  await recordAuditEvent({ action: "communication.whatsapp.inbound", entityType: "CommunicationMessage", entityId: message.id, requestId: providerId, metadata: { threadId: participant.threadId, providerId, guardianId: participant.entityId } });
  return { received: true, duplicate: false, messageId: message.id };
}

export async function createThread(input: ThreadInput, actor: Actor, requestId: string) {
  const recipients = await resolveRecipients(input.recipients);
  if (input.channel === "EMAIL" && recipients.some((recipient) => !recipient.email)) throw new AppError(400, "RECIPIENT_EMAIL_REQUIRED", "Every email recipient must have an email address.");
  if (input.channel === "WHATSAPP" && (recipients.some((recipient) => recipient.type !== "GUARDIAN") || recipients.some((recipient) => !recipient.phone || !normalizePhoneNumber(recipient.phone)))) throw new AppError(400, "RECIPIENT_WHATSAPP_REQUIRED", "WhatsApp messages can only be sent to guardians with a valid phone number.");
  const readiness = getProviderReadiness();
  if (!input.saveAsDraft && input.channel === "EMAIL" && !readiness.email.configured) throw new AppError(503, "EMAIL_PROVIDER_NOT_CONFIGURED", "Live email delivery is not configured. Add the Resend server credentials first.");
  if (!input.saveAsDraft && input.channel === "WHATSAPP" && !readiness.whatsapp.configured) throw new AppError(503, "WHATSAPP_PROVIDER_NOT_CONFIGURED", "Live WhatsApp delivery is not configured. Add the Twilio server credentials first.");
  const status = input.saveAsDraft ? "DRAFT" : input.channel === "PORTAL" ? "SENT" : "QUEUED";
  const now = new Date();
  const thread = await prisma.communicationThread.create({
    data: {
      subject: input.subject, type: input.type, channel: input.channel, createdById: actor.userId,
      participants: { create: recipients },
      messages: { create: { senderUserId: actor.userId, body: input.body, status, assisted: input.assisted, sentAt: status === "SENT" ? now : null } },
    },
    include: threadInclude,
  });
  if (!input.saveAsDraft && input.channel !== "PORTAL") await dispatchMessage(thread.messages[0]!.id);
  await recordAuditEvent({ actorUserId: actor.userId, action: input.saveAsDraft ? "communication.draft" : "communication.send", entityType: "CommunicationThread", entityId: thread.id, requestId, metadata: { channel: input.channel, recipientCount: recipients.length } });
  return prisma.communicationThread.findUniqueOrThrow({ where: { id: thread.id }, include: threadInclude });
}

export async function sendMessage(threadId: string, input: MessageInput, actor: Actor, requestId: string) {
  const thread = await prisma.communicationThread.findFirst({ where: { id: threadId, archivedAt: null } });
  if (!thread) throw new AppError(404, "THREAD_NOT_FOUND", "Conversation not found.");
  const readiness = getProviderReadiness();
  if (!input.saveAsDraft && thread.channel === "EMAIL" && !readiness.email.configured) throw new AppError(503, "EMAIL_PROVIDER_NOT_CONFIGURED", "Live email delivery is not configured.");
  if (!input.saveAsDraft && thread.channel === "WHATSAPP" && !readiness.whatsapp.configured) throw new AppError(503, "WHATSAPP_PROVIDER_NOT_CONFIGURED", "Live WhatsApp delivery is not configured.");
  const status = input.saveAsDraft ? "DRAFT" : thread.channel === "PORTAL" ? "SENT" : "QUEUED";
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.communicationMessage.create({ data: { threadId, senderUserId: actor.userId, body: input.body, status, assisted: input.assisted, sentAt: status === "SENT" ? new Date() : null }, include: { sender: { select: { id: true, firstName: true, lastName: true } }, senderParticipant: true, deliveries: { include: { participant: true } } } });
    await tx.communicationThread.update({ where: { id: threadId }, data: { lastMessageAt: new Date() } });
    return created;
  });
  if (!input.saveAsDraft && thread.channel !== "PORTAL") await dispatchMessage(message.id);
  await recordAuditEvent({ actorUserId: actor.userId, action: input.saveAsDraft ? "communication.draft" : "communication.reply", entityType: "CommunicationMessage", entityId: message.id, requestId, metadata: { threadId, channel: thread.channel } });
  return prisma.communicationMessage.findUniqueOrThrow({ where: { id: message.id }, include: { sender: { select: { id: true, firstName: true, lastName: true } }, senderParticipant: true, deliveries: { include: { participant: true } } } });
}

export async function markThreadRead(threadId: string) {
  const thread = await prisma.communicationThread.findFirst({ where: { id: threadId, archivedAt: null } });
  if (!thread) throw new AppError(404, "THREAD_NOT_FOUND", "Conversation not found.");
  await prisma.communicationParticipant.updateMany({ where: { threadId }, data: { readAt: new Date() } });
  return { id: threadId, read: true };
}

export async function archiveThread(threadId: string, actor: Actor, requestId: string) {
  const existing = await prisma.communicationThread.findFirst({ where: { id: threadId, archivedAt: null } });
  if (!existing) throw new AppError(404, "THREAD_NOT_FOUND", "Conversation not found.");
  const thread = await prisma.communicationThread.update({ where: { id: threadId }, data: { archivedAt: new Date() } });
  await recordAuditEvent({ actorUserId: actor.userId, action: "communication.archive", entityType: "CommunicationThread", entityId: threadId, requestId });
  return thread;
}

export async function createAnnouncement(input: AnnouncementInput, actor: Actor, requestId: string) {
  const publishedAt = input.status === "PUBLISHED" && (!input.publishAt || new Date(input.publishAt) <= new Date()) ? new Date() : null;
  const announcement = await prisma.announcement.create({ data: { title: input.title, body: input.body, audience: input.audience, audienceLabel: input.audienceLabel, priority: input.priority, status: input.status, publishAt: input.publishAt ? new Date(input.publishAt) : null, publishedAt, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null, createdById: actor.userId, assisted: input.assisted }, include: { createdBy: { select: { firstName: true, lastName: true } } } });
  await recordAuditEvent({ actorUserId: actor.userId, action: input.status === "PUBLISHED" ? "announcement.publish" : "announcement.draft", entityType: "Announcement", entityId: announcement.id, requestId, metadata: { audience: input.audience } });
  return announcement;
}

export async function updateAnnouncement(id: string, input: AnnouncementUpdate, actor: Actor, requestId: string) {
  const existing = await prisma.announcement.findFirst({ where: { id, archivedAt: null } });
  if (!existing) throw new AppError(404, "ANNOUNCEMENT_NOT_FOUND", "Announcement not found.");
  const announcement = await prisma.announcement.update({ where: { id }, data: { ...input, publishAt: input.publishAt ? new Date(input.publishAt) : input.publishAt === "" ? null : undefined, expiresAt: input.expiresAt ? new Date(input.expiresAt) : input.expiresAt === "" ? null : undefined, publishedAt: input.status === "PUBLISHED" && !existing.publishedAt ? new Date() : undefined, audience: input.audience as Prisma.InputJsonValue | undefined }, include: { createdBy: { select: { firstName: true, lastName: true } } } });
  await recordAuditEvent({ actorUserId: actor.userId, action: "announcement.update", entityType: "Announcement", entityId: id, requestId });
  return announcement;
}

export async function archiveAnnouncement(id: string, actor: Actor, requestId: string) {
  const existing = await prisma.announcement.findFirst({ where: { id, archivedAt: null } });
  if (!existing) throw new AppError(404, "ANNOUNCEMENT_NOT_FOUND", "Announcement not found.");
  const announcement = await prisma.announcement.update({ where: { id }, data: { archivedAt: new Date() } });
  await recordAuditEvent({ actorUserId: actor.userId, action: "announcement.archive", entityType: "Announcement", entityId: id, requestId });
  return announcement;
}

export function draftWithAssistant(input: AssistantInput) {
  const context = input.context;
  const greeting = input.intent === "ANNOUNCEMENT" ? "Dear school community," : `Dear ${input.audienceLabel},`;
  const opening = input.tone === "FORMAL" ? "Please be informed" : input.tone === "SUPPORTIVE" ? "We are writing to support you with" : input.tone === "CONCISE" ? "Update:" : "We wanted to share an update about";
  const topic = context?.title || input.instruction || "an important school matter";
  const detail = context?.details ? ` ${context.details}.` : "";
  const action = input.intent === "FOLLOW_UP" ? "Please reply if you need any clarification or would like to discuss the next steps." : "Please contact the school office if you have any questions.";
  return {
    subject: context?.title || (input.intent === "ANNOUNCEMENT" ? "School announcement" : "School update"),
    body: `${greeting}\n\n${opening} ${topic}.${detail}\n\n${action}\n\nKind regards,\nAdorable British College`,
    source: "CONTEXT_ASSISTANT",
  };
}
