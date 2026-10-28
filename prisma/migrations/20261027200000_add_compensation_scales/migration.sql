CREATE TABLE "compensation_scales" (
  "id" UUID NOT NULL,
  "frameworkId" UUID NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'KES',
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "compensation_scales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compensation_steps" (
  "id" UUID NOT NULL,
  "compensationScaleId" UUID NOT NULL,
  "jobLevelId" UUID NOT NULL,
  "stepNumber" INTEGER NOT NULL,
  "basicSalary" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "compensation_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "compensation_scales_frameworkId_code_key"
  ON "compensation_scales"("frameworkId", "code");
CREATE INDEX "compensation_scales_frameworkId_effectiveFrom_idx"
  ON "compensation_scales"("frameworkId", "effectiveFrom");
CREATE UNIQUE INDEX "compensation_steps_scale_level_step_key"
  ON "compensation_steps"("compensationScaleId", "jobLevelId", "stepNumber");
CREATE INDEX "compensation_steps_jobLevelId_idx"
  ON "compensation_steps"("jobLevelId");

ALTER TABLE "compensation_scales"
  ADD CONSTRAINT "compensation_scales_frameworkId_fkey"
  FOREIGN KEY ("frameworkId") REFERENCES "job_frameworks"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compensation_steps"
  ADD CONSTRAINT "compensation_steps_compensationScaleId_fkey"
  FOREIGN KEY ("compensationScaleId") REFERENCES "compensation_scales"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compensation_steps"
  ADD CONSTRAINT "compensation_steps_jobLevelId_fkey"
  FOREIGN KEY ("jobLevelId") REFERENCES "job_levels"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
