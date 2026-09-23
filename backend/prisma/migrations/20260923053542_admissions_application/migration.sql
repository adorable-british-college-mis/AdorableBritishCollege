-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ASSESSMENT', 'INTERVIEW', 'OFFERED', 'WAITLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'ENROLLED');

-- CreateTable
CREATE TABLE "AdmissionApplication" (
    "id" UUID NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "entryYearGroup" TEXT,
    "entryAcademicYear" TEXT NOT NULL DEFAULT '2026/2027',
    "formVersion" INTEGER NOT NULL DEFAULT 1,
    "formData" JSONB NOT NULL,
    "studentId" UUID,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionDocument" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionApplication_applicationNumber_key" ON "AdmissionApplication"("applicationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionApplication_studentId_key" ON "AdmissionApplication"("studentId");

-- CreateIndex
CREATE INDEX "AdmissionApplication_email_dateOfBirth_idx" ON "AdmissionApplication"("email", "dateOfBirth");

-- CreateIndex
CREATE INDEX "AdmissionApplication_status_createdAt_idx" ON "AdmissionApplication"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AdmissionApplication_entryAcademicYear_entryYearGroup_idx" ON "AdmissionApplication"("entryAcademicYear", "entryYearGroup");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionDocument_storedName_key" ON "AdmissionDocument"("storedName");

-- CreateIndex
CREATE INDEX "AdmissionDocument_applicationId_category_idx" ON "AdmissionDocument"("applicationId", "category");

-- AddForeignKey
ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionDocument" ADD CONSTRAINT "AdmissionDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
