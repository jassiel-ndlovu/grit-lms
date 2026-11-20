-- AlterTable
ALTER TABLE "TestSubmission" ADD COLUMN     "extraTimePercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "noTimeLimit" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TimeAccommodation" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "extraTimePercent" INTEGER NOT NULL DEFAULT 0,
    "noTimeLimit" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "TimeAccommodation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeAccommodation_studentId_idx" ON "TimeAccommodation"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "TimeAccommodation_courseId_studentId_key" ON "TimeAccommodation"("courseId", "studentId");

-- AddForeignKey
ALTER TABLE "TimeAccommodation" ADD CONSTRAINT "TimeAccommodation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

