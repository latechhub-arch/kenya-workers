ALTER TABLE "pension_cases"
  ADD COLUMN "calculationMethod" VARCHAR(100),
  ADD COLUMN "calculationInputs" JSONB,
  ADD COLUMN "calculationResult" JSONB,
  ADD COLUMN "calculationSource" VARCHAR(1000);
