-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PERMANENT', 'PENSIONABLE', 'CONTRACT', 'TEMPORARY', 'CASUAL', 'INTERNSHIP', 'ATTACHMENT', 'SECONDMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ON_LEAVE', 'ENDED', 'RETIRED', 'TERMINATED', 'RESIGNED', 'DISMISSED', 'DECEASED');

-- CreateTable
CREATE TABLE "employments" (
    "id" UUID NOT NULL,
    "employmentNumber" VARCHAR(50) NOT NULL,
    "personId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "appointmentDate" DATE,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employments_employmentNumber_key" ON "employments"("employmentNumber");

-- CreateIndex
CREATE INDEX "employments_personId_idx" ON "employments"("personId");

-- CreateIndex
CREATE INDEX "employments_organizationId_idx" ON "employments"("organizationId");

-- CreateIndex
CREATE INDEX "employments_status_idx" ON "employments"("status");

-- CreateIndex
CREATE INDEX "employments_employmentType_idx" ON "employments"("employmentType");

-- CreateIndex
CREATE INDEX "employments_startDate_idx" ON "employments"("startDate");

-- AddForeignKey
ALTER TABLE "employments" ADD CONSTRAINT "employments_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employments" ADD CONSTRAINT "employments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
