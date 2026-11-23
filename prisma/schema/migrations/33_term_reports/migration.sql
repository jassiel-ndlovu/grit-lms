-- Term reports (#216): terms, and the comments on them. Additive.
-- CreateTable
CREATE TABLE "ReportTerm" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCourseComment" (
    "termId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCourseComment_pkey" PRIMARY KEY ("termId","learnerId","courseId")
);

-- CreateTable
CREATE TABLE "ReportOverallComment" (
    "termId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportOverallComment_pkey" PRIMARY KEY ("termId","learnerId")
);

-- CreateIndex
CREATE INDEX "ReportTerm_workspaceId_startsOn_idx" ON "ReportTerm"("workspaceId", "startsOn");

-- CreateIndex
CREATE INDEX "ReportCourseComment_learnerId_idx" ON "ReportCourseComment"("learnerId");

-- CreateIndex
CREATE INDEX "ReportCourseComment_courseId_idx" ON "ReportCourseComment"("courseId");

-- CreateIndex
CREATE INDEX "ReportOverallComment_learnerId_idx" ON "ReportOverallComment"("learnerId");

-- AddForeignKey
ALTER TABLE "ReportTerm" ADD CONSTRAINT "ReportTerm_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCourseComment" ADD CONSTRAINT "ReportCourseComment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "ReportTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCourseComment" ADD CONSTRAINT "ReportCourseComment_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCourseComment" ADD CONSTRAINT "ReportCourseComment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportOverallComment" ADD CONSTRAINT "ReportOverallComment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "ReportTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportOverallComment" ADD CONSTRAINT "ReportOverallComment_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

