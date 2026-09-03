-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('NATIONAL_GOVERNMENT', 'COUNTY_GOVERNMENT', 'MINISTRY', 'DEPARTMENT', 'AGENCY', 'STATE_CORPORATION', 'OTHER');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DECEASED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "parentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "geofenceRadius" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" UUID NOT NULL,
    "personNumber" VARCHAR(50) NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "middleName" VARCHAR(100),
    "lastName" VARCHAR(100) NOT NULL,
    "dateOfBirth" DATE,
    "nationalIdHash" VARCHAR(128),
    "kraPinHash" VARCHAR(128),
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE INDEX "organizations_parentId_idx" ON "organizations"("parentId");

-- CreateIndex
CREATE INDEX "organizations_type_idx" ON "organizations"("type");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "organizations"("status");

-- CreateIndex
CREATE INDEX "departments_organizationId_idx" ON "departments"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_organizationId_code_key" ON "departments"("organizationId", "code");

-- CreateIndex
CREATE INDEX "stations_organizationId_idx" ON "stations"("organizationId");

-- CreateIndex
CREATE INDEX "stations_departmentId_idx" ON "stations"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "stations_organizationId_code_key" ON "stations"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "persons_personNumber_key" ON "persons"("personNumber");

-- CreateIndex
CREATE UNIQUE INDEX "persons_nationalIdHash_key" ON "persons"("nationalIdHash");

-- CreateIndex
CREATE UNIQUE INDEX "persons_kraPinHash_key" ON "persons"("kraPinHash");

-- CreateIndex
CREATE INDEX "persons_lastName_firstName_idx" ON "persons"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "persons_status_idx" ON "persons"("status");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stations" ADD CONSTRAINT "stations_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
