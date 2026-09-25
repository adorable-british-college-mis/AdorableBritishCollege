ALTER TYPE "CommunicationChannel" ADD VALUE 'WHATSAPP';
ALTER TYPE "CommunicationMessageStatus" ADD VALUE 'DELIVERED';

CREATE TYPE "CommunicationDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

ALTER TABLE "CommunicationParticipant" ADD COLUMN "phone" TEXT;

CREATE TABLE "CommunicationDelivery" (
  "id" UUID NOT NULL,
  "messageId" UUID NOT NULL,
  "participantId" UUID NOT NULL,
  "channel" "CommunicationChannel" NOT NULL,
  "destination" TEXT NOT NULL,
  "status" "CommunicationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "provider" TEXT NOT NULL,
  "providerId" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationDelivery_messageId_participantId_key" ON "CommunicationDelivery"("messageId", "participantId");
CREATE INDEX "CommunicationDelivery_provider_providerId_idx" ON "CommunicationDelivery"("provider", "providerId");
CREATE INDEX "CommunicationDelivery_status_createdAt_idx" ON "CommunicationDelivery"("status", "createdAt");

ALTER TABLE "CommunicationDelivery" ADD CONSTRAINT "CommunicationDelivery_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CommunicationMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunicationDelivery" ADD CONSTRAINT "CommunicationDelivery_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CommunicationParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
