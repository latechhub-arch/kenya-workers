-- Add optional department and station assignments to employment records.
ALTER TABLE "employments"
ADD COLUMN "departmentId" UUID,
ADD COLUMN "stationId" UUID;

CREATE INDEX "employments_departmentId_idx" ON "employments"("departmentId");
CREATE INDEX "employments_stationId_idx" ON "employments"("stationId");

ALTER TABLE "employments"
ADD CONSTRAINT "employments_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employments"
ADD CONSTRAINT "employments_stationId_fkey"
FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
