CREATE TYPE "PayComponentType" AS ENUM ('EARNING', 'DEDUCTION');
CREATE TYPE "PayComponentFrequency" AS ENUM ('MONTHLY', 'ONE_OFF');
CREATE TYPE "PayslipStatus" AS ENUM ('ISSUED', 'SUPERSEDED');

CREATE TABLE "employment_pay_components" (
  "id" UUID NOT NULL,
  "employmentId" UUID NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "type" "PayComponentType" NOT NULL,
  "frequency" "PayComponentFrequency" NOT NULL DEFAULT 'MONTHLY',
  "currency" VARCHAR(3) NOT NULL DEFAULT 'KES',
  "amount" DECIMAL(12,2) NOT NULL,
  "balance" DECIMAL(12,2),
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "note" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employment_pay_components_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "employment_pay_components_employmentId_code_effectiveFrom_key" ON "employment_pay_components"("employmentId", "code", "effectiveFrom");
CREATE INDEX "employment_pay_components_employmentId_effectiveFrom_effect_idx" ON "employment_pay_components"("employmentId", "effectiveFrom", "effectiveTo");
ALTER TABLE "employment_pay_components" ADD CONSTRAINT "employment_pay_components_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "employments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payslips" (
  "id" UUID NOT NULL,
  "employmentId" UUID NOT NULL,
  "periodYear" INTEGER NOT NULL,
  "periodMonth" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'KES',
  "status" "PayslipStatus" NOT NULL DEFAULT 'ISSUED',
  "isProvisional" BOOLEAN NOT NULL DEFAULT false,
  "earningsTotal" DECIMAL(12,2) NOT NULL,
  "deductionsTotal" DECIMAL(12,2) NOT NULL,
  "netPay" DECIMAL(12,2) NOT NULL,
  "correctionReason" VARCHAR(500),
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payslips_employmentId_periodYear_periodMonth_version_key" ON "payslips"("employmentId", "periodYear", "periodMonth", "version");
CREATE INDEX "payslips_employmentId_periodYear_periodMonth_status_idx" ON "payslips"("employmentId", "periodYear", "periodMonth", "status");
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employmentId_fkey" FOREIGN KEY ("employmentId") REFERENCES "employments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payslip_lines" (
  "id" UUID NOT NULL,
  "payslipId" UUID NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "type" "PayComponentType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "balance" DECIMAL(12,2),
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payslip_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "payslip_lines_payslipId_displayOrder_idx" ON "payslip_lines"("payslipId", "displayOrder");
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
