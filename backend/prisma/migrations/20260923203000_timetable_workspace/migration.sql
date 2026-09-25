DROP INDEX IF EXISTS "TimetableSlot_termId_yearGroupId_weekday_startsAt_key";
ALTER TABLE "TimetableSlot" ADD COLUMN "formGroupId" UUID;
CREATE INDEX "TimetableSlot_formGroupId_idx" ON "TimetableSlot"("formGroupId");
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_formGroupId_fkey" FOREIGN KEY ("formGroupId") REFERENCES "FormGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "CoverStatus" AS ENUM ('PENDING', 'CONFIRMED');
CREATE TABLE "CoverArrangement" (
  "id" UUID NOT NULL,
  "timetableSlotId" UUID NOT NULL,
  "absentStaffId" UUID NOT NULL,
  "coverStaffId" UUID,
  "date" DATE NOT NULL,
  "status" "CoverStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CoverArrangement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CoverArrangement_timetableSlotId_date_key" ON "CoverArrangement"("timetableSlotId", "date");
CREATE INDEX "CoverArrangement_date_status_idx" ON "CoverArrangement"("date", "status");
CREATE INDEX "CoverArrangement_absentStaffId_idx" ON "CoverArrangement"("absentStaffId");
CREATE INDEX "CoverArrangement_coverStaffId_idx" ON "CoverArrangement"("coverStaffId");
ALTER TABLE "CoverArrangement" ADD CONSTRAINT "CoverArrangement_timetableSlotId_fkey" FOREIGN KEY ("timetableSlotId") REFERENCES "TimetableSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoverArrangement" ADD CONSTRAINT "CoverArrangement_absentStaffId_fkey" FOREIGN KEY ("absentStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CoverArrangement" ADD CONSTRAINT "CoverArrangement_coverStaffId_fkey" FOREIGN KEY ("coverStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
