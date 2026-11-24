-- CreateTable
CREATE TABLE "StudyAssistantBlock" (
    "courseId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "blockedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyAssistantBlock_pkey" PRIMARY KEY ("courseId","studentUserId")
);

-- CreateIndex
CREATE INDEX "StudyAssistantBlock_studentUserId_idx" ON "StudyAssistantBlock"("studentUserId");

-- AddForeignKey
ALTER TABLE "StudyAssistantBlock" ADD CONSTRAINT "StudyAssistantBlock_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
