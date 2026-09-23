ALTER TABLE "Student"
ADD COLUMN "title" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "addressLine1" TEXT,
ADD COLUMN "addressLine2" TEXT,
ADD COLUMN "townCity" TEXT,
ADD COLUMN "postcode" TEXT;

CREATE TABLE "FormGroup" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "yearGroupId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FormGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "House" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "House_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Enrollment" ADD COLUMN "formGroupId" UUID;
ALTER TABLE "Enrollment" ADD COLUMN "houseId" UUID;

CREATE UNIQUE INDEX "FormGroup_code_key" ON "FormGroup"("code");
CREATE INDEX "FormGroup_yearGroupId_isActive_idx" ON "FormGroup"("yearGroupId", "isActive");
CREATE UNIQUE INDEX "House_code_key" ON "House"("code");
CREATE UNIQUE INDEX "House_name_key" ON "House"("name");
CREATE INDEX "Enrollment_formGroupId_idx" ON "Enrollment"("formGroupId");
CREATE INDEX "Enrollment_houseId_idx" ON "Enrollment"("houseId");

ALTER TABLE "FormGroup" ADD CONSTRAINT "FormGroup_yearGroupId_fkey" FOREIGN KEY ("yearGroupId") REFERENCES "YearGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_formGroupId_fkey" FOREIGN KEY ("formGroupId") REFERENCES "FormGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
