-- CreateTable
CREATE TABLE "StudyChat" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "flaggedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" VARCHAR(10) NOT NULL,
    "content" VARCHAR(8000) NOT NULL,
    "citations" JSONB,
    "outOfScope" BOOLEAN NOT NULL DEFAULT false,
    "concern" VARCHAR(12) NOT NULL DEFAULT 'none',
    "credits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyChat_courseId_updatedAt_idx" ON "StudyChat"("courseId", "updatedAt");

-- CreateIndex
CREATE INDEX "StudyChat_studentUserId_updatedAt_idx" ON "StudyChat"("studentUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "StudyMessage_chatId_createdAt_idx" ON "StudyMessage"("chatId", "createdAt");

-- AddForeignKey
ALTER TABLE "StudyChat" ADD CONSTRAINT "StudyChat_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyChat" ADD CONSTRAINT "StudyChat_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyMessage" ADD CONSTRAINT "StudyMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "StudyChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The Pro service "study-assistant" (contracts/services.md). seed-billing.ts
-- upserts it too; inserting here keeps the backfill below valid.
INSERT INTO "Service" ("key", "name", "kind", "tier", "status")
VALUES ('study-assistant', 'Course study assistant for students', 'PREMIUM', 'PRO', 'ACTIVE')
ON CONFLICT ("key") DO NOTHING;

-- Courses already on Pro (AI marking on) get it, so none changes tier.
INSERT INTO "CourseService" ("id", "workspaceId", "courseId", "serviceKey", "enabled", "changedAt", "changedByUserId")
SELECT 'cs_study_' || md5(cs."courseId"), cs."workspaceId", cs."courseId", 'study-assistant', true, CURRENT_TIMESTAMP, cs."changedByUserId"
FROM "CourseService" cs
WHERE cs."serviceKey" = 'ai-marking' AND cs."enabled" = true
ON CONFLICT ("courseId", "serviceKey") DO NOTHING;
