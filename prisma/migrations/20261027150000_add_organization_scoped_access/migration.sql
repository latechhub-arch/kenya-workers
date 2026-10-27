-- Allow the same user and role to be assigned in separate organizations.
ALTER TABLE "user_roles" ADD COLUMN "id" UUID;
UPDATE "user_roles" SET "id" = gen_random_uuid() WHERE "id" IS NULL;
ALTER TABLE "user_roles" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "user_roles" ADD COLUMN "organizationId" UUID;
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_pkey";
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "user_roles_userId_roleId_organizationId_key"
  ON "user_roles"("userId", "roleId", "organizationId");
CREATE INDEX "user_roles_organizationId_idx" ON "user_roles"("organizationId");
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Scope person records to every organization in their employment and posting history.
CREATE TABLE "person_organization_scopes" (
  "personId" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  CONSTRAINT "person_organization_scopes_pkey" PRIMARY KEY ("personId", "organizationId")
);
INSERT INTO "person_organization_scopes" ("personId", "organizationId")
SELECT DISTINCT "personId", "organizationId" FROM "employments"
UNION
SELECT DISTINCT e."personId", p."organizationId"
FROM "employment_postings" p
JOIN "employments" e ON e."id" = p."employmentId";
ALTER TABLE "person_organization_scopes" ADD CONSTRAINT "person_organization_scopes_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "person_organization_scopes" ADD CONSTRAINT "person_organization_scopes_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
