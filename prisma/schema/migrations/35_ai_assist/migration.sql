-- CreateEnum
CREATE TYPE "AiAssistFeature" AS ENUM ('QUESTIONS', 'OUTLINE', 'TIDY');

-- CreateEnum
CREATE TYPE "AiAssistStatus" AS ENUM ('OK', 'FAILED', 'REFUSED');

-- CreateTable
CREATE TABLE "AiAssistRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT,
    "userId" TEXT NOT NULL,
    "feature" "AiAssistFeature" NOT NULL,
    "status" "AiAssistStatus" NOT NULL,
    "tier" VARCHAR(8) NOT NULL,
    "model" VARCHAR(64) NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAssistRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAssistRun_workspaceId_feature_createdAt_idx" ON "AiAssistRun"("workspaceId", "feature", "createdAt");

-- CreateIndex
CREATE INDEX "AiAssistRun_userId_createdAt_idx" ON "AiAssistRun"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiAssistRun" ADD CONSTRAINT "AiAssistRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The Plus service "ai-assist" (contracts/services.md). seed-billing.ts
-- upserts it too; inserting here keeps the backfill below valid.
INSERT INTO "Service" ("key", "name", "kind", "tier", "status")
VALUES ('ai-assist', 'AI help for tutors: question batches, course outlines and text tidying', 'PREMIUM', 'PLUS', 'ACTIVE')
ON CONFLICT ("key") DO NOTHING;

-- Courses already on Plus or Pro get it, so no course changes tier.
INSERT INTO "CourseService" ("id", "workspaceId", "courseId", "serviceKey", "enabled", "changedAt", "changedByUserId")
SELECT DISTINCT ON (cs."courseId") 'cs_assist_' || md5(cs."courseId"), cs."workspaceId", cs."courseId", 'ai-assist', true, CURRENT_TIMESTAMP, cs."changedByUserId"
FROM "CourseService" cs
JOIN "Service" s ON s."key" = cs."serviceKey"
WHERE cs."enabled" = true AND s."kind" = 'PREMIUM' AND s."tier" IN ('PLUS', 'PRO') AND cs."serviceKey" <> 'ai-assist'
ORDER BY cs."courseId", cs."changedAt" DESC
ON CONFLICT ("courseId", "serviceKey") DO NOTHING;
