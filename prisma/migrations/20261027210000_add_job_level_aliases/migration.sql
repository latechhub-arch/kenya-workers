CREATE TABLE "job_level_aliases" (
  "id" UUID NOT NULL,
  "frameworkId" UUID NOT NULL,
  "jobLevelId" UUID NOT NULL,
  "scheme" VARCHAR(50) NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "title" VARCHAR(255),
  "source" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "job_level_aliases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_level_aliases_frameworkId_scheme_code_key"
  ON "job_level_aliases"("frameworkId", "scheme", "code");
CREATE INDEX "job_level_aliases_jobLevelId_idx"
  ON "job_level_aliases"("jobLevelId");

ALTER TABLE "job_level_aliases"
  ADD CONSTRAINT "job_level_aliases_frameworkId_fkey"
  FOREIGN KEY ("frameworkId") REFERENCES "job_frameworks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_level_aliases"
  ADD CONSTRAINT "job_level_aliases_jobLevelId_fkey"
  FOREIGN KEY ("jobLevelId") REFERENCES "job_levels"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
