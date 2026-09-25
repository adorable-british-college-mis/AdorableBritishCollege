/*
  Warnings:

  - Added the required column `updatedAt` to the `BehaviourEvent` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "BehaviourEventStatus" AS ENUM ('OPEN', 'RESOLVED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "BehaviourRewardStatus" AS ENUM ('AWARDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "BehaviourSanctionType" AS ENUM ('DETENTION', 'INTERNAL_EXCLUSION', 'SUSPENSION', 'COMMUNITY_SERVICE', 'REPORT_CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "BehaviourSanctionStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- DropIndex
DROP INDEX "AttendanceRegister_termId_yearGroupId_date_periodLabel_key";

-- DropIndex
DROP INDEX "BehaviourEvent_type_resolvedAt_idx";

-- AlterTable
ALTER TABLE "AttendanceRegister" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BehaviourEvent" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "categoryId" UUID,
ADD COLUMN     "details" TEXT,
ADD COLUMN     "formGroupId" UUID,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "staffId" UUID,
ADD COLUMN     "status" "BehaviourEventStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "BehaviourCategory" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BehaviourEventType" NOT NULL,
    "defaultPoints" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BehaviourCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviourReward" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "termId" UUID NOT NULL,
    "staffId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "status" "BehaviourRewardStatus" NOT NULL DEFAULT 'AWARDED',
    "awardedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BehaviourReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BehaviourSanction" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "termId" UUID NOT NULL,
    "staffId" UUID,
    "behaviourEventId" UUID,
    "type" "BehaviourSanctionType" NOT NULL,
    "status" "BehaviourSanctionStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BehaviourSanction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BehaviourCategory_code_key" ON "BehaviourCategory"("code");

-- CreateIndex
CREATE INDEX "BehaviourCategory_type_isActive_idx" ON "BehaviourCategory"("type", "isActive");

-- CreateIndex
CREATE INDEX "BehaviourReward_termId_awardedAt_idx" ON "BehaviourReward"("termId", "awardedAt");

-- CreateIndex
CREATE INDEX "BehaviourReward_studentId_archivedAt_idx" ON "BehaviourReward"("studentId", "archivedAt");

-- CreateIndex
CREATE INDEX "BehaviourSanction_termId_status_scheduledFor_idx" ON "BehaviourSanction"("termId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "BehaviourSanction_studentId_archivedAt_idx" ON "BehaviourSanction"("studentId", "archivedAt");

-- CreateIndex
CREATE INDEX "BehaviourSanction_behaviourEventId_idx" ON "BehaviourSanction"("behaviourEventId");

-- CreateIndex
CREATE INDEX "BehaviourEvent_type_status_archivedAt_idx" ON "BehaviourEvent"("type", "status", "archivedAt");

-- CreateIndex
CREATE INDEX "BehaviourEvent_studentId_occurredAt_idx" ON "BehaviourEvent"("studentId", "occurredAt");

-- CreateIndex
CREATE INDEX "BehaviourEvent_categoryId_idx" ON "BehaviourEvent"("categoryId");

-- CreateIndex
CREATE INDEX "BehaviourEvent_staffId_idx" ON "BehaviourEvent"("staffId");

-- AddForeignKey
ALTER TABLE "BehaviourEvent" ADD CONSTRAINT "BehaviourEvent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BehaviourCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviourEvent" ADD CONSTRAINT "BehaviourEvent_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviourEvent" ADD CONSTRAINT "BehaviourEvent_formGroupId_fkey" FOREIGN KEY ("formGroupId") REFERENCES "FormGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviourReward" ADD CONSTRAINT "BehaviourReward_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviourReward" ADD CONSTRAINT "BehaviourReward_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviourReward" ADD CONSTRAINT "BehaviourReward_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviourSanction" ADD CONSTRAINT "BehaviourSanction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviourSanction" ADD CONSTRAINT "BehaviourSanction_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviourSanction" ADD CONSTRAINT "BehaviourSanction_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BehaviourSanction" ADD CONSTRAINT "BehaviourSanction_behaviourEventId_fkey" FOREIGN KEY ("behaviourEventId") REFERENCES "BehaviourEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AttendanceRegister_termId_yearGroupId_formGroupId_date_periodLa" RENAME TO "AttendanceRegister_termId_yearGroupId_formGroupId_date_peri_key";
