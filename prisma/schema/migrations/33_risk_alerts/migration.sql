-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('WATCH', 'AT_RISK');

-- CreateEnum
CREATE TYPE "RiskAlertStatus" AS ENUM ('OPEN', 'SHARED', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "RiskAlert" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "status" "RiskAlertStatus" NOT NULL DEFAULT 'OPEN',
    "reasons" JSONB NOT NULL,
    "summary" VARCHAR(2000) NOT NULL,
    "openKey" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sharedAt" TIMESTAMP(3),
    "sharedByUserId" TEXT,
    "sharedWith" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shareNote" VARCHAR(1000),
    "sharedSummary" VARCHAR(2000),
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "quietUntil" TIMESTAMP(3),

    CONSTRAINT "RiskAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RiskAlert_openKey_key" ON "RiskAlert"("openKey");

-- CreateIndex
CREATE INDEX "RiskAlert_workspaceId_status_idx" ON "RiskAlert"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "RiskAlert_courseId_status_idx" ON "RiskAlert"("courseId", "status");

-- CreateIndex
CREATE INDEX "RiskAlert_studentUserId_status_idx" ON "RiskAlert"("studentUserId", "status");

-- AddForeignKey
ALTER TABLE "RiskAlert" ADD CONSTRAINT "RiskAlert_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAlert" ADD CONSTRAINT "RiskAlert_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The Pro service "at-risk-alerts" (contracts/services.md). seed-billing.ts
-- upserts it too; inserting here keeps the backfill below valid.
INSERT INTO "Service" ("key", "name", "kind", "tier", "status")
VALUES ('at-risk-alerts', 'At-risk alerts shared with parents and students', 'PREMIUM', 'PRO', 'ACTIVE')
ON CONFLICT ("key") DO NOTHING;

-- Courses already on Pro keep everything Pro: switch the new service on
-- wherever AI marking is on (new courses start with every v1 Pro service).
INSERT INTO "CourseService" ("id", "workspaceId", "courseId", "serviceKey", "enabled", "changedAt", "changedByUserId")
SELECT 'cs_risk_' || md5(cs."courseId"), cs."workspaceId", cs."courseId", 'at-risk-alerts', true, CURRENT_TIMESTAMP, cs."changedByUserId"
FROM "CourseService" cs
WHERE cs."serviceKey" = 'ai-marking' AND cs."enabled" = true
ON CONFLICT ("courseId", "serviceKey") DO NOTHING;
