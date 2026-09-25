CREATE TABLE "Department" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Curriculum" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "academicYearId" UUID NOT NULL,
  "yearGroupId" UUID,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Curriculum_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeachingAssignment" (
  "id" UUID NOT NULL,
  "academicYearId" UUID NOT NULL,
  "formGroupId" UUID NOT NULL,
  "subjectId" UUID NOT NULL,
  "staffId" UUID NOT NULL,
  "departmentId" UUID,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Staff" ADD COLUMN "departmentId" UUID;
ALTER TABLE "FormGroup" ADD COLUMN "curriculumId" UUID;
ALTER TABLE "FormGroup" ADD COLUMN "departmentId" UUID;
ALTER TABLE "FormGroup" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Subject" ADD COLUMN "departmentId" UUID;
ALTER TABLE "Subject" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "CurriculumSubject" ADD COLUMN "curriculumId" UUID;
ALTER TABLE "CurriculumSubject" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CurriculumSubject" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "CurriculumSubject" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Assessment" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Assessment" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Assessment" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");
CREATE UNIQUE INDEX "Curriculum_academicYearId_code_key" ON "Curriculum"("academicYearId", "code");
CREATE INDEX "Curriculum_academicYearId_isActive_idx" ON "Curriculum"("academicYearId", "isActive");
CREATE INDEX "Curriculum_yearGroupId_idx" ON "Curriculum"("yearGroupId");
CREATE UNIQUE INDEX "TeachingAssignment_academicYearId_formGroupId_subjectId_key" ON "TeachingAssignment"("academicYearId", "formGroupId", "subjectId");
CREATE INDEX "TeachingAssignment_staffId_isActive_idx" ON "TeachingAssignment"("staffId", "isActive");
CREATE INDEX "TeachingAssignment_departmentId_idx" ON "TeachingAssignment"("departmentId");
CREATE INDEX "Staff_departmentId_idx" ON "Staff"("departmentId");
CREATE INDEX "FormGroup_curriculumId_idx" ON "FormGroup"("curriculumId");
CREATE INDEX "FormGroup_departmentId_idx" ON "FormGroup"("departmentId");
CREATE INDEX "Subject_departmentId_idx" ON "Subject"("departmentId");
CREATE INDEX "CurriculumSubject_curriculumId_idx" ON "CurriculumSubject"("curriculumId");

ALTER TABLE "Staff" ADD CONSTRAINT "Staff_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FormGroup" ADD CONSTRAINT "FormGroup_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FormGroup" ADD CONSTRAINT "FormGroup_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CurriculumSubject" ADD CONSTRAINT "CurriculumSubject_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "Curriculum"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Curriculum" ADD CONSTRAINT "Curriculum_yearGroupId_fkey" FOREIGN KEY ("yearGroupId") REFERENCES "YearGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_formGroupId_fkey" FOREIGN KEY ("formGroupId") REFERENCES "FormGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
