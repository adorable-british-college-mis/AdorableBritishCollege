CREATE TYPE "CommunicationThreadType" AS ENUM ('DIRECT', 'GROUP');
CREATE TYPE "CommunicationChannel" AS ENUM ('PORTAL', 'EMAIL');
CREATE TYPE "CommunicationMessageStatus" AS ENUM ('DRAFT', 'SENT', 'QUEUED', 'FAILED');
CREATE TYPE "CommunicationParticipantType" AS ENUM ('STUDENT', 'GUARDIAN', 'STAFF', 'USER');
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "CommunicationThread" (
  "id" UUID NOT NULL,
  "subject" TEXT NOT NULL,
  "type" "CommunicationThreadType" NOT NULL DEFAULT 'DIRECT',
  "channel" "CommunicationChannel" NOT NULL DEFAULT 'PORTAL',
  "createdById" UUID NOT NULL,
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "CommunicationThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationParticipant" (
  "id" UUID NOT NULL,
  "threadId" UUID NOT NULL,
  "type" "CommunicationParticipantType" NOT NULL,
  "entityId" UUID NOT NULL,
  "displayName" TEXT NOT NULL,
  "roleLabel" TEXT NOT NULL,
  "email" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunicationParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationMessage" (
  "id" UUID NOT NULL,
  "threadId" UUID NOT NULL,
  "senderUserId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "status" "CommunicationMessageStatus" NOT NULL DEFAULT 'SENT',
  "assisted" BOOLEAN NOT NULL DEFAULT false,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "CommunicationMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Announcement" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "audience" JSONB NOT NULL,
  "audienceLabel" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
  "publishAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdById" UUID NOT NULL,
  "assisted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunicationThread_lastMessageAt_archivedAt_idx" ON "CommunicationThread"("lastMessageAt", "archivedAt");
CREATE INDEX "CommunicationThread_createdById_createdAt_idx" ON "CommunicationThread"("createdById", "createdAt");
CREATE UNIQUE INDEX "CommunicationParticipant_threadId_type_entityId_key" ON "CommunicationParticipant"("threadId", "type", "entityId");
CREATE INDEX "CommunicationParticipant_type_entityId_idx" ON "CommunicationParticipant"("type", "entityId");
CREATE INDEX "CommunicationMessage_threadId_createdAt_idx" ON "CommunicationMessage"("threadId", "createdAt");
CREATE INDEX "CommunicationMessage_status_createdAt_idx" ON "CommunicationMessage"("status", "createdAt");
CREATE INDEX "CommunicationMessage_senderUserId_createdAt_idx" ON "CommunicationMessage"("senderUserId", "createdAt");
CREATE INDEX "Announcement_status_publishedAt_archivedAt_idx" ON "Announcement"("status", "publishedAt", "archivedAt");
CREATE INDEX "Announcement_createdById_createdAt_idx" ON "Announcement"("createdById", "createdAt");

ALTER TABLE "CommunicationThread" ADD CONSTRAINT "CommunicationThread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationParticipant" ADD CONSTRAINT "CommunicationParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CommunicationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CommunicationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
