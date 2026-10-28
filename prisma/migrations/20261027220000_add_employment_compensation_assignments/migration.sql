CREATE TABLE "employment_compensation_assignments" (
  "id" UUID NOT NULL,
  "employmentId" UUID NOT NULL,
  "compensationStepId" UUID NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "reason" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employment_compensation_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employment_compensation_assignments_employmentId_effectiveFrom_key"
  ON "employment_compensation_assignments"("employmentId", "effectiveFrom");
CREATE INDEX "employment_compensation_assignments_compensationStepId_effectiveTo_idx"
  ON "employment_compensation_assignments"("compensationStepId", "effectiveTo");

ALTER TABLE "employment_compensation_assignments"
  ADD CONSTRAINT "employment_compensation_assignments_employmentId_fkey"
  FOREIGN KEY ("employmentId") REFERENCES "employments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employment_compensation_assignments"
  ADD CONSTRAINT "employment_compensation_assignments_compensationStepId_fkey"
  FOREIGN KEY ("compensationStepId") REFERENCES "compensation_steps"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
