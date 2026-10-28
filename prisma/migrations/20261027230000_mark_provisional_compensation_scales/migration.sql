ALTER TABLE "compensation_scales"
  ADD COLUMN "isProvisional" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "source" VARCHAR(1000);
