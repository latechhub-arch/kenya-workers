-- A person may have historical employment records, but only one current
-- employment identity at a time. Suspended and on-leave records remain active.
CREATE UNIQUE INDEX "employments_one_active_per_person_idx"
ON "employments"("personId")
WHERE "status" IN ('ACTIVE', 'SUSPENDED', 'ON_LEAVE');
