CREATE TABLE "audit_events" (
  "id" UUID NOT NULL,
  "actorUserId" UUID,
  "organizationId" UUID,
  "action" VARCHAR(150) NOT NULL,
  "entityType" VARCHAR(100) NOT NULL,
  "entityId" VARCHAR(100),
  "metadata" JSONB,
  "ipAddress" VARCHAR(64),
  "userAgent" VARCHAR(500),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_events_occurredAt_idx"
  ON "audit_events"("occurredAt");
CREATE INDEX "audit_events_actorUserId_occurredAt_idx"
  ON "audit_events"("actorUserId", "occurredAt");
CREATE INDEX "audit_events_organizationId_occurredAt_idx"
  ON "audit_events"("organizationId", "occurredAt");
CREATE INDEX "audit_events_entityType_entityId_idx"
  ON "audit_events"("entityType", "entityId");

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
