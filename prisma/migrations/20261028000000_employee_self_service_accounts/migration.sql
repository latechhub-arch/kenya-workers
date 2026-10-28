ALTER TABLE "users"
  ADD COLUMN "personId" UUID;

CREATE UNIQUE INDEX "users_personId_key" ON "users"("personId");

ALTER TABLE "users"
  ADD CONSTRAINT "users_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "persons"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "employee_account_invites" (
  "id" UUID NOT NULL,
  "personId" UUID NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_account_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_account_invites_tokenHash_key"
  ON "employee_account_invites"("tokenHash");
CREATE INDEX "employee_account_invites_personId_expiresAt_idx"
  ON "employee_account_invites"("personId", "expiresAt");

ALTER TABLE "employee_account_invites"
  ADD CONSTRAINT "employee_account_invites_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "persons"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_account_invites"
  ADD CONSTRAINT "employee_account_invites_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
