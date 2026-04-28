/*
  Warnings:

  - You are about to drop the column `value` on the `Grade` table. All the data in the column will be lost.
  - You are about to drop the column `attachmentUrls` on the `Lesson` table. All the data in the column will be lost.
  - The `videoUrl` column on the `Lesson` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `grade` on the `SubmissionEntry` table. All the data in the column will be lost.
  - The `fileUrl` column on the `SubmissionEntry` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `_CourseEnrollments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[submissionEntryId]` on the table `Grade` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[testSubmissionId]` on the table `Grade` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[submissionId,studentId]` on the table `SubmissionEntry` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_CourseEnrollments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `description` to the `CourseEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `CourseEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `score` to the `Grade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Grade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdAt` to the `Submission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `Submission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `attemptNumber` to the `SubmissionEntry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `feedback` to the `SubmissionEntry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `SubmissionEntry` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `Test` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalPoints` to the `Test` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('COURSE_UPDATE', 'LESSON_CREATED', 'TEST_CREATED', 'TEST_DELETED', 'TEST_UPDATED', 'QUIZ_CREATED', 'SUBMISSION_CREATED', 'SUBMISSION_DUE', 'SUBMISSION_UPDATED', 'SUBMISSION_DELETED', 'SUBMISSION_GRADED', 'TEST_DUE', 'TEST_GRADED', 'MESSAGE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('LESSON_COMPLETED', 'TEST_COMPLETED', 'ASSIGNMENT_SUBMITTED', 'GRADE_RECEIVED', 'MESSAGE_SENT', 'MESSAGE_RECEIVED', 'LOGIN', 'LOGOUT');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY', 'FILE_UPLOAD', 'MULTI_SELECT', 'CODE', 'MATCHING', 'REORDER', 'FILL_IN_THE_BLANK', 'NUMERIC');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'GRADED', 'LATE', 'IN_PROGRESS', 'NOT_SUBMITTED', 'NOT_STARTED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('LECTURE', 'TEST', 'REMINDER', 'SUBMISSION', 'LIVE', 'EXAM', 'MEETING', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('PDF', 'DOCX', 'ZIP', 'JPEG', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationFrequency" AS ENUM ('IMMEDIATE', 'DAILY', 'WEEKLY', 'NONE');

-- CreateEnum
CREATE TYPE "PreferredView" AS ENUM ('LIST', 'GRID', 'TIMELINE');

-- CreateEnum
CREATE TYPE "DashboardTab" AS ENUM ('COURSES', 'NOTIFICATIONS', 'CALENDAR', 'GRADES');

-- DropForeignKey
ALTER TABLE "AssessmentCompletion" DROP CONSTRAINT "AssessmentCompletion_testId_fkey";

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "CourseEvent" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "type" "EventType" NOT NULL,
ALTER COLUMN "link" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Grade" DROP COLUMN "value",
ADD COLUMN     "finalComments" TEXT,
ADD COLUMN     "score" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "submissionEntryId" TEXT,
ADD COLUMN     "testSubmissionId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Lesson" DROP COLUMN "attachmentUrls",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "duration" INTEGER,
DROP COLUMN "videoUrl",
ADD COLUMN     "videoUrl" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "type" "NotificationType" NOT NULL;

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "maxAttempts" INTEGER;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "descriptionFiles" TEXT[],
ADD COLUMN     "isActive" BOOLEAN DEFAULT true,
ADD COLUMN     "lastDueDate" TIMESTAMP(3),
ADD COLUMN     "maxAttempts" INTEGER,
ADD COLUMN     "totalPoints" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "SubmissionEntry" DROP COLUMN "grade",
ADD COLUMN     "attemptNumber" INTEGER NOT NULL,
ADD COLUMN     "feedback" TEXT NOT NULL,
ADD COLUMN     "status" "SubmissionStatus" NOT NULL,
DROP COLUMN "fileUrl",
ADD COLUMN     "fileUrl" TEXT[];

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "preTestInstructions" TEXT,
ADD COLUMN     "timeLimit" INTEGER,
ADD COLUMN     "totalPoints" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "_CourseEnrollments" DROP CONSTRAINT "_CourseEnrollments_AB_pkey";

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "notificationFrequency" "NotificationFrequency" NOT NULL DEFAULT 'IMMEDIATE',
    "notifyOnCourseUpdate" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnNewLesson" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnNewTest" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnDueDateReminder" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnGrades" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnMessages" BOOLEAN NOT NULL DEFAULT true,
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'EN',
    "timeZone" TEXT,
    "preferredView" "PreferredView" NOT NULL DEFAULT 'LIST',
    "studyReminders" BOOLEAN NOT NULL DEFAULT false,
    "defaultDashboardTab" "DashboardTab" NOT NULL DEFAULT 'COURSES',

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestQuestion" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "parentId" TEXT,
    "order" INTEGER,
    "question" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "options" TEXT[],
    "answer" JSONB,
    "language" TEXT,
    "matchPairs" JSONB,
    "reorderItems" TEXT[],
    "blankCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSubmission" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "answers" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "feedback" TEXT,
    "status" "SubmissionStatus" NOT NULL,

    CONSTRAINT "TestSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" "FileType" NOT NULL,
    "questionId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionGrade" (
    "id" TEXT NOT NULL,
    "questionId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "outOf" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT,
    "testSubmissionId" TEXT,
    "submissionEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "ActivityType" NOT NULL,
    "targetId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_submissionEntryId_key" ON "Grade"("submissionEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_testSubmissionId_key" ON "Grade"("testSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionEntry_submissionId_studentId_key" ON "SubmissionEntry"("submissionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "_CourseEnrollments_AB_unique" ON "_CourseEnrollments"("A", "B");

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestQuestion" ADD CONSTRAINT "TestQuestion_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestQuestion" ADD CONSTRAINT "TestQuestion_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TestQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSubmission" ADD CONSTRAINT "TestSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSubmission" ADD CONSTRAINT "TestSubmission_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "TestQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "TestSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentCompletion" ADD CONSTRAINT "AssessmentCompletion_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGrade" ADD CONSTRAINT "QuestionGrade_submissionEntryId_fkey" FOREIGN KEY ("submissionEntryId") REFERENCES "SubmissionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionGrade" ADD CONSTRAINT "QuestionGrade_testSubmissionId_fkey" FOREIGN KEY ("testSubmissionId") REFERENCES "TestSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_submissionEntryId_fkey" FOREIGN KEY ("submissionEntryId") REFERENCES "SubmissionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_testSubmissionId_fkey" FOREIGN KEY ("testSubmissionId") REFERENCES "TestSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
