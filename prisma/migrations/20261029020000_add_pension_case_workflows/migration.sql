CREATE TYPE "PensionCaseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DEATH_REPORTED', 'CLOSED');
CREATE TYPE "PensionScheduleStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'SUSPENDED', 'STOPPED');
CREATE TYPE "PensionEvidenceStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

CREATE TABLE "pension_schemes" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "schemeType" VARCHAR(60) NOT NULL,
  "eligibilityPolicy" VARCHAR(3000),
  "officialSource" VARCHAR(1000),
  "requiredEvidenceTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pension_schemes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pension_schemes_organizationId_code_key" ON "pension_schemes"("organizationId", "code");
CREATE INDEX "pension_schemes_organizationId_isActive_idx" ON "pension_schemes"("organizationId", "isActive");
ALTER TABLE "pension_schemes" ADD CONSTRAINT "pension_schemes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "pension_cases" (
  "id" UUID NOT NULL,
  "employmentId" UUID NOT NULL,
  "schemeId" UUID NOT NULL,
  "status" "PensionCaseStatus" NOT NULL DEFAULT 'DRAFT',
  "caseReference" VARCHAR(100),
  "retirementDate" DATE NOT NULL,
  "qualifyingServiceYears" DECIMAL(5,2),
  "proposedMonthlyAmount" DECIMAL(12,2),
  "approvedMonthlyAmount" DECIMAL(12,2),
  "currency" VARCHAR(3) NOT NULL DEFAULT 'KES',
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" UUID,
  "reviewNotes" VARCHAR(2000),
  "approvedAt" TIMESTAMP(3),
  "approvedByUserId" UUID,
  "deathReportedAt" TIMESTAMP(3),
  "deathEffectiveDate" DATE,
  "deathCertificateRef" VARCHAR(255),
  "deathReviewedAt" TIMESTAMP(3),
  "deathReviewedByUserId" UUID,
  "deathReviewNotes" VARCHAR(2000),
  "survivorClaimStatus" VARCHAR(40) NOT NULL DEFAULT 'NOT_ASSESSED',
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pension_cases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pension_cases_caseReference_key" ON "pension_cases"("caseReference");
CREATE INDEX "pension_cases_employmentId_status_idx" ON "pension_cases"("employmentId", "status");
CREATE INDEX "pension_cases_schemeId_status_idx" ON "pension_cases"("schemeId", "status");
ALTER TABLE "pension_cases" ADD CONSTRAINT "pension_cases_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "employments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pension_cases" ADD CONSTRAINT "pension_cases_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "pension_schemes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pension_cases" ADD CONSTRAINT "pension_cases_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pension_cases" ADD CONSTRAINT "pension_cases_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pension_cases" ADD CONSTRAINT "pension_cases_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pension_cases" ADD CONSTRAINT "pension_cases_deathReviewedByUserId_fkey" FOREIGN KEY ("deathReviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "pension_evidence" (
  "id" UUID NOT NULL,
  "pensionCaseId" UUID NOT NULL,
  "evidenceType" VARCHAR(60) NOT NULL,
  "documentReference" VARCHAR(255) NOT NULL,
  "status" "PensionEvidenceStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNotes" VARCHAR(1000),
  "verifiedByUserId" UUID,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pension_evidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pension_evidence_pensionCaseId_evidenceType_status_idx" ON "pension_evidence"("pensionCaseId", "evidenceType", "status");
ALTER TABLE "pension_evidence" ADD CONSTRAINT "pension_evidence_pensionCaseId_fkey" FOREIGN KEY ("pensionCaseId") REFERENCES "pension_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pension_evidence" ADD CONSTRAINT "pension_evidence_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "pension_payment_schedules" (
  "id" UUID NOT NULL,
  "pensionCaseId" UUID NOT NULL,
  "status" "PensionScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
  "monthlyAmount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'KES',
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "activatedAt" TIMESTAMP(3),
  "stoppedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pension_payment_schedules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pension_payment_schedules_pensionCaseId_key" ON "pension_payment_schedules"("pensionCaseId");
CREATE INDEX "pension_payment_schedules_status_effectiveFrom_idx" ON "pension_payment_schedules"("status", "effectiveFrom");
ALTER TABLE "pension_payment_schedules" ADD CONSTRAINT "pension_payment_schedules_pensionCaseId_fkey" FOREIGN KEY ("pensionCaseId") REFERENCES "pension_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "pension_case_events" (
  "id" UUID NOT NULL,
  "pensionCaseId" UUID NOT NULL,
  "actorUserId" UUID,
  "action" VARCHAR(60) NOT NULL,
  "fromStatus" VARCHAR(40),
  "toStatus" VARCHAR(40),
  "effectiveDate" DATE,
  "note" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pension_case_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pension_case_events_pensionCaseId_createdAt_idx" ON "pension_case_events"("pensionCaseId", "createdAt");
ALTER TABLE "pension_case_events" ADD CONSTRAINT "pension_case_events_pensionCaseId_fkey" FOREIGN KEY ("pensionCaseId") REFERENCES "pension_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pension_case_events" ADD CONSTRAINT "pension_case_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "pension_cases_employmentId_schemeId_key" ON "pension_cases"("employmentId", "schemeId");
