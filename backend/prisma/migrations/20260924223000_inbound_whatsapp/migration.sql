ALTER TABLE "CommunicationMessage" ALTER COLUMN "senderUserId" DROP NOT NULL;
ALTER TABLE "CommunicationMessage" ADD COLUMN "senderParticipantId" UUID;

CREATE INDEX "CommunicationMessage_senderParticipantId_createdAt_idx" ON "CommunicationMessage"("senderParticipantId", "createdAt");

ALTER TABLE "CommunicationMessage" ADD CONSTRAINT "CommunicationMessage_senderParticipantId_fkey" FOREIGN KEY ("senderParticipantId") REFERENCES "CommunicationParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
