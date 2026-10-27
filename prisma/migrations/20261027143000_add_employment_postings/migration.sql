CREATE TABLE "employment_postings" (
    "id" UUID NOT NULL,
    "employmentId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "departmentId" UUID,
    "stationId" UUID,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employment_postings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employment_postings_employmentId_effectiveFrom_key"
  ON "employment_postings"("employmentId", "effectiveFrom");
CREATE INDEX "employment_postings_organizationId_idx"
  ON "employment_postings"("organizationId");
CREATE INDEX "employment_postings_departmentId_idx"
  ON "employment_postings"("departmentId");
CREATE INDEX "employment_postings_stationId_idx"
  ON "employment_postings"("stationId");

ALTER TABLE "employment_postings"
  ADD CONSTRAINT "employment_postings_employmentId_fkey"
  FOREIGN KEY ("employmentId") REFERENCES "employments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employment_postings"
  ADD CONSTRAINT "employment_postings_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employment_postings"
  ADD CONSTRAINT "employment_postings_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employment_postings"
  ADD CONSTRAINT "employment_postings_stationId_fkey"
  FOREIGN KEY ("stationId") REFERENCES "stations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing records have no earlier posting timeline. Preserve their known
-- current assignment as a baseline and label that limitation in the reason.
INSERT INTO "employment_postings" (
  "id", "employmentId", "organizationId", "departmentId", "stationId",
  "effectiveFrom", "effectiveTo", "reason", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(), "id", "organizationId", "departmentId", "stationId",
  "startDate", "endDate",
  'Baseline copied from employment record; earlier posting history unavailable',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "employments";
