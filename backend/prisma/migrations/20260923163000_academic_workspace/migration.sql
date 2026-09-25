ALTER TABLE "FormGroup" ADD COLUMN "tutorStaffId" UUID;
ALTER TABLE "Assessment" ADD COLUMN "subjectId" UUID;

CREATE TABLE "CurriculumSubject" (
  "id" UUID NOT NULL,
  "academicYearId" UUID NOT NULL,
  "yearGroupId" UUID NOT NULL,
  "subjectId" UUID NOT NULL,
  "weeklyPeriods" INTEGER NOT NULL DEFAULT 4,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CurriculumSubject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CurriculumSubject_academicYearId_yearGroupId_subjectId_key" ON "CurriculumSubject"("academicYearId", "yearGroupId", "subjectId");
CREATE INDEX "CurriculumSubject_yearGroupId_subjectId_idx" ON "CurriculumSubject"("yearGroupId", "subjectId");
CREATE INDEX "FormGroup_tutorStaffId_idx" ON "FormGroup"("tutorStaffId");
CREATE INDEX "Assessment_subjectId_idx" ON "Assessment"("subjectId");

ALTER TABLE "FormGroup" ADD CONSTRAINT "FormGroup_tutorStaffId_fkey" FOREIGN KEY ("tutorStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CurriculumSubject" ADD CONSTRAINT "CurriculumSubject_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumSubject" ADD CONSTRAINT "CurriculumSubject_yearGroupId_fkey" FOREIGN KEY ("yearGroupId") REFERENCES "YearGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumSubject" ADD CONSTRAINT "CurriculumSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
