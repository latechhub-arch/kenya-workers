-- CreateEnum
CREATE TYPE "JobFrameworkType" AS ENUM ('MILITARY_RANK', 'POLICE_RANK', 'CIVIL_SERVICE_GRADE', 'OTHER');

-- CreateTable
CREATE TABLE "job_frameworks" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "JobFrameworkType" NOT NULL,
    "description" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_frameworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_levels" (
    "id" UUID NOT NULL,
    "frameworkId" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "levelOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_positions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID,
    "frameworkId" UUID NOT NULL,
    "levelId" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "authorizedSlots" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_frameworks_organizationId_type_idx" ON "job_frameworks"("organizationId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "job_frameworks_organizationId_code_key" ON "job_frameworks"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "job_levels_frameworkId_code_key" ON "job_levels"("frameworkId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "job_levels_frameworkId_levelOrder_key" ON "job_levels"("frameworkId", "levelOrder");

-- CreateIndex
CREATE INDEX "job_positions_departmentId_idx" ON "job_positions"("departmentId");

-- CreateIndex
CREATE INDEX "job_positions_frameworkId_levelId_idx" ON "job_positions"("frameworkId", "levelId");

-- CreateIndex
CREATE UNIQUE INDEX "job_positions_organizationId_code_key" ON "job_positions"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "job_frameworks" ADD CONSTRAINT "job_frameworks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_levels" ADD CONSTRAINT "job_levels_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "job_frameworks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_positions" ADD CONSTRAINT "job_positions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_positions" ADD CONSTRAINT "job_positions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_positions" ADD CONSTRAINT "job_positions_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "job_frameworks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_positions" ADD CONSTRAINT "job_positions_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "job_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
