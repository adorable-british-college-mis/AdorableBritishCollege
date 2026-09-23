CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'AUTHORISED_ABSENCE', 'UNAUTHORISED_ABSENCE');
CREATE TYPE "RegisterStatus" AS ENUM ('OPEN', 'SUBMITTED');
CREATE TYPE "AssessmentResultStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "BehaviourEventType" AS ENUM ('POSITIVE', 'INCIDENT');

ALTER TABLE "AdmissionApplication" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'School Website';

CREATE TABLE "AdmissionEnquiry" ("id" UUID NOT NULL, "academicYearId" UUID NOT NULL, "firstName" TEXT NOT NULL, "lastName" TEXT NOT NULL, "email" TEXT, "source" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AdmissionEnquiry_pkey" PRIMARY KEY ("id"));
CREATE TABLE "AttendanceRegister" ("id" UUID NOT NULL, "termId" UUID NOT NULL, "yearGroupId" UUID NOT NULL, "date" DATE NOT NULL, "periodLabel" TEXT NOT NULL, "status" "RegisterStatus" NOT NULL DEFAULT 'OPEN', "submittedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AttendanceRegister_pkey" PRIMARY KEY ("id"));
CREATE TABLE "AttendanceRecord" ("id" UUID NOT NULL, "registerId" UUID NOT NULL, "studentId" UUID NOT NULL, "status" "AttendanceStatus" NOT NULL, "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Assessment" ("id" UUID NOT NULL, "termId" UUID NOT NULL, "yearGroupId" UUID NOT NULL, "title" TEXT NOT NULL, "dueAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id"));
CREATE TABLE "AssessmentResult" ("id" UUID NOT NULL, "assessmentId" UUID NOT NULL, "studentId" UUID NOT NULL, "status" "AssessmentResultStatus" NOT NULL DEFAULT 'NOT_STARTED', "attainmentPct" DOUBLE PRECISION, "progressPct" DOUBLE PRECISION, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AssessmentResult_pkey" PRIMARY KEY ("id"));
CREATE TABLE "BehaviourEvent" ("id" UUID NOT NULL, "studentId" UUID NOT NULL, "termId" UUID NOT NULL, "type" "BehaviourEventType" NOT NULL, "summary" TEXT NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL, "resolvedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "BehaviourEvent_pkey" PRIMARY KEY ("id"));
CREATE TABLE "TimetableSlot" ("id" UUID NOT NULL, "termId" UUID NOT NULL, "yearGroupId" UUID NOT NULL, "subjectId" UUID NOT NULL, "staffId" UUID, "weekday" INTEGER NOT NULL, "startsAt" TEXT NOT NULL, "endsAt" TEXT NOT NULL, "periodLabel" TEXT NOT NULL, "room" TEXT, CONSTRAINT "TimetableSlot_pkey" PRIMARY KEY ("id"));

CREATE UNIQUE INDEX "AttendanceRegister_termId_yearGroupId_date_periodLabel_key" ON "AttendanceRegister"("termId", "yearGroupId", "date", "periodLabel");
CREATE INDEX "AttendanceRegister_date_status_idx" ON "AttendanceRegister"("date", "status");
CREATE UNIQUE INDEX "AttendanceRecord_registerId_studentId_key" ON "AttendanceRecord"("registerId", "studentId");
CREATE INDEX "AttendanceRecord_studentId_recordedAt_idx" ON "AttendanceRecord"("studentId", "recordedAt");
CREATE INDEX "AttendanceRecord_status_recordedAt_idx" ON "AttendanceRecord"("status", "recordedAt");
CREATE INDEX "AdmissionEnquiry_academicYearId_createdAt_idx" ON "AdmissionEnquiry"("academicYearId", "createdAt");
CREATE INDEX "AdmissionEnquiry_source_createdAt_idx" ON "AdmissionEnquiry"("source", "createdAt");
CREATE INDEX "Assessment_termId_dueAt_idx" ON "Assessment"("termId", "dueAt");
CREATE INDEX "Assessment_yearGroupId_dueAt_idx" ON "Assessment"("yearGroupId", "dueAt");
CREATE UNIQUE INDEX "AssessmentResult_assessmentId_studentId_key" ON "AssessmentResult"("assessmentId", "studentId");
CREATE INDEX "AssessmentResult_studentId_status_idx" ON "AssessmentResult"("studentId", "status");
CREATE INDEX "BehaviourEvent_termId_occurredAt_idx" ON "BehaviourEvent"("termId", "occurredAt");
CREATE INDEX "BehaviourEvent_type_resolvedAt_idx" ON "BehaviourEvent"("type", "resolvedAt");
CREATE UNIQUE INDEX "TimetableSlot_termId_yearGroupId_weekday_startsAt_key" ON "TimetableSlot"("termId", "yearGroupId", "weekday", "startsAt");
CREATE INDEX "TimetableSlot_termId_weekday_startsAt_idx" ON "TimetableSlot"("termId", "weekday", "startsAt");

ALTER TABLE "AdmissionEnquiry" ADD CONSTRAINT "AdmissionEnquiry_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRegister" ADD CONSTRAINT "AttendanceRegister_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRegister" ADD CONSTRAINT "AttendanceRegister_yearGroupId_fkey" FOREIGN KEY ("yearGroupId") REFERENCES "YearGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "AttendanceRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_yearGroupId_fkey" FOREIGN KEY ("yearGroupId") REFERENCES "YearGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentResult" ADD CONSTRAINT "AssessmentResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BehaviourEvent" ADD CONSTRAINT "BehaviourEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BehaviourEvent" ADD CONSTRAINT "BehaviourEvent_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_yearGroupId_fkey" FOREIGN KEY ("yearGroupId") REFERENCES "YearGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimetableSlot" ADD CONSTRAINT "TimetableSlot_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
