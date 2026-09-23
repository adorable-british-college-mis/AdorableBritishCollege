-- CreateTable
CREATE TABLE "AdmissionWorkflowEvent" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "actorUserId" UUID,
    "fromStatus" "AdmissionStatus",
    "toStatus" "AdmissionStatus" NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionWorkflowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdmissionWorkflowEvent_applicationId_createdAt_idx" ON "AdmissionWorkflowEvent"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "AdmissionWorkflowEvent_actorUserId_createdAt_idx" ON "AdmissionWorkflowEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdmissionWorkflowEvent_toStatus_createdAt_idx" ON "AdmissionWorkflowEvent"("toStatus", "createdAt");

-- AddForeignKey
ALTER TABLE "AdmissionWorkflowEvent" ADD CONSTRAINT "AdmissionWorkflowEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionWorkflowEvent" ADD CONSTRAINT "AdmissionWorkflowEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
