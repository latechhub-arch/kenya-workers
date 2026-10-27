CREATE TABLE "employment_position_assignments" (
  "id" UUID NOT NULL,
  "employmentId" UUID NOT NULL,
  "positionId" UUID NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "reason" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employment_position_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "employment_position_assignments_employmentId_effectiveFrom_key"
  ON "employment_position_assignments"("employmentId", "effectiveFrom");
CREATE INDEX "employment_position_assignments_positionId_effectiveTo_idx"
  ON "employment_position_assignments"("positionId", "effectiveTo");
ALTER TABLE "employment_position_assignments"
  ADD CONSTRAINT "employment_position_assignments_employmentId_fkey"
  FOREIGN KEY ("employmentId") REFERENCES "employments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employment_position_assignments"
  ADD CONSTRAINT "employment_position_assignments_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "job_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
