ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'LATE';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'ABSENT';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'MEDICAL';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'OTHER';

ALTER TABLE "AttendanceRegister"
  ADD COLUMN "formGroupId" UUID,
  ADD COLUMN "timetableSlotId" UUID,
  ADD COLUMN "teacherId" UUID,
  ADD COLUMN "registerType" TEXT NOT NULL DEFAULT 'LESSON',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "AttendanceRecord"
  ADD COLUMN "note" TEXT,
  ADD COLUMN "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "AttendanceRegister" DROP CONSTRAINT IF EXISTS "AttendanceRegister_termId_yearGroupId_date_periodLabel_key";
CREATE UNIQUE INDEX "AttendanceRegister_termId_yearGroupId_formGroupId_date_periodLabel_key"
  ON "AttendanceRegister"("termId", "yearGroupId", "formGroupId", "date", "periodLabel");
CREATE INDEX "AttendanceRegister_timetableSlotId_date_idx" ON "AttendanceRegister"("timetableSlotId", "date");
CREATE INDEX "AttendanceRegister_teacherId_date_idx" ON "AttendanceRegister"("teacherId", "date");

ALTER TABLE "AttendanceRegister" ADD CONSTRAINT "AttendanceRegister_formGroupId_fkey"
  FOREIGN KEY ("formGroupId") REFERENCES "FormGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceRegister" ADD CONSTRAINT "AttendanceRegister_timetableSlotId_fkey"
  FOREIGN KEY ("timetableSlotId") REFERENCES "TimetableSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceRegister" ADD CONSTRAINT "AttendanceRegister_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
