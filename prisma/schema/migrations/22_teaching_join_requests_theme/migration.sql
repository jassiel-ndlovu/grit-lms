-- #206 (owner decisions 2026-11-21): organisations can switch teaching off; students and parents ask to join listed courses; a colour theme per user. Additive only.

-- CreateEnum
CREATE TYPE "UiTheme" AS ENUM ('CALM', 'BRIGHT');

-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');

-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN     "theme" "UiTheme" NOT NULL DEFAULT 'CALM';

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "teachingOffAt" TIMESTAMP(3),
ADD COLUMN     "teachingOffById" TEXT;

-- CreateTable
CREATE TABLE "CourseListing" (
    "courseId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "listedById" TEXT NOT NULL,
    "listedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseListing_pkey" PRIMARY KEY ("courseId")
);

-- CreateTable
CREATE TABLE "JoinRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "message" TEXT,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseListing_workspaceId_idx" ON "CourseListing"("workspaceId");

-- CreateIndex
CREATE INDEX "JoinRequest_workspaceId_status_idx" ON "JoinRequest"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "JoinRequest_courseId_status_idx" ON "JoinRequest"("courseId", "status");

-- CreateIndex
CREATE INDEX "JoinRequest_requesterUserId_createdAt_idx" ON "JoinRequest"("requesterUserId", "createdAt");

-- CreateIndex
CREATE INDEX "JoinRequest_studentUserId_idx" ON "JoinRequest"("studentUserId");

-- AddForeignKey
ALTER TABLE "CourseListing" ADD CONSTRAINT "CourseListing_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseListing" ADD CONSTRAINT "CourseListing_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One open request per course and student.
CREATE UNIQUE INDEX "JoinRequest_one_pending" ON "JoinRequest"("courseId", "studentUserId") WHERE "status" = 'PENDING';
