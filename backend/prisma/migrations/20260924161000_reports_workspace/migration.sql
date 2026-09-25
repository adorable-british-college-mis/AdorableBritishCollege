CREATE TYPE "ReportType" AS ENUM ('ACADEMIC', 'ATTENDANCE', 'BEHAVIOUR', 'STUDENT', 'EXAM', 'OTHER');
CREATE TYPE "ReportStatus" AS ENUM ('COMPLETED', 'FAILED');

CREATE TABLE "GeneratedReport" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" "ReportType" NOT NULL,
  "status" "ReportStatus" NOT NULL DEFAULT 'COMPLETED',
  "academicYearId" UUID NOT NULL,
  "termId" UUID,
  "generatedById" UUID NOT NULL,
  "filters" JSONB,
  "snapshot" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "GeneratedReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GeneratedReport_academicYearId_type_generatedAt_idx" ON "GeneratedReport"("academicYearId", "type", "generatedAt");
CREATE INDEX "GeneratedReport_generatedById_generatedAt_idx" ON "GeneratedReport"("generatedById", "generatedAt");
CREATE INDEX "GeneratedReport_archivedAt_idx" ON "GeneratedReport"("archivedAt");

ALTER TABLE "GeneratedReport" ADD CONSTRAINT "GeneratedReport_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratedReport" ADD CONSTRAINT "GeneratedReport_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GeneratedReport" ADD CONSTRAINT "GeneratedReport_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
