CREATE TABLE "employee_budget_profiles" (
    "userId" UUID NOT NULL,
    "monthlyTakeHome" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_budget_profiles_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "employee_budget_items" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "monthlyAmount" DECIMAL(12,2) NOT NULL,
    "outstandingBalance" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_budget_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_budget_items_userId_category_idx" ON "employee_budget_items"("userId", "category");

ALTER TABLE "employee_budget_profiles" ADD CONSTRAINT "employee_budget_profiles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_budget_items" ADD CONSTRAINT "employee_budget_items_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "employee_budget_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
