CREATE TABLE "attendance_records" (
  "id" UUID NOT NULL,
  "employmentId" UUID NOT NULL,
  "stationId" UUID NOT NULL,
  "workDate" DATE NOT NULL,
  "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locationCapturedAt" TIMESTAMP(3) NOT NULL,
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "accuracyMeters" DECIMAL(8,2) NOT NULL,
  "distanceMeters" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_records_employmentId_workDate_key"
  ON "attendance_records"("employmentId", "workDate");
CREATE INDEX "attendance_records_stationId_workDate_idx"
  ON "attendance_records"("stationId", "workDate");

ALTER TABLE "attendance_records"
  ADD CONSTRAINT "attendance_records_employmentId_fkey"
  FOREIGN KEY ("employmentId") REFERENCES "employments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_records"
  ADD CONSTRAINT "attendance_records_stationId_fkey"
  FOREIGN KEY ("stationId") REFERENCES "stations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
