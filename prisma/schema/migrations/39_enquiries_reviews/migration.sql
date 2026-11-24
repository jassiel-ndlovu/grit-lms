-- CreateEnum
CREATE TYPE "EnquiryStage" AS ENUM ('NEW', 'CONTACTED', 'TRIAL', 'ENROLLED', 'LOST');

-- CreateEnum
CREATE TYPE "StaffReviewStatus" AS ENUM ('DRAFT', 'SHARED', 'ACKNOWLEDGED');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "enquiryFormOn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "WorkspaceEnquiry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254),
    "phone" VARCHAR(40),
    "studentName" VARCHAR(120),
    "gradeLevel" INTEGER,
    "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "message" VARCHAR(4000),
    "source" VARCHAR(16) NOT NULL,
    "stage" "EnquiryStage" NOT NULL DEFAULT 'NEW',
    "branchId" TEXT,
    "assignedMembershipId" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "followUpRemindedAt" TIMESTAMP(3),
    "lostReason" VARCHAR(300),
    "learnerId" TEXT,
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryNote" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "kind" VARCHAR(8) NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffReview" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "outcomes" JSONB NOT NULL,
    "strengths" VARCHAR(4000),
    "improvements" VARCHAR(4000),
    "goals" VARCHAR(4000),
    "rating" INTEGER,
    "status" "StaffReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "sharedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "response" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkspaceEnquiry_workspaceId_stage_createdAt_idx" ON "WorkspaceEnquiry"("workspaceId", "stage", "createdAt");

-- CreateIndex
CREATE INDEX "WorkspaceEnquiry_assignedMembershipId_nextFollowUpAt_idx" ON "WorkspaceEnquiry"("assignedMembershipId", "nextFollowUpAt");

-- CreateIndex
CREATE INDEX "WorkspaceEnquiry_ipHash_createdAt_idx" ON "WorkspaceEnquiry"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "EnquiryNote_enquiryId_createdAt_idx" ON "EnquiryNote"("enquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffReview_workspaceId_membershipId_periodEnd_idx" ON "StaffReview"("workspaceId", "membershipId", "periodEnd");

-- AddForeignKey
ALTER TABLE "WorkspaceEnquiry" ADD CONSTRAINT "WorkspaceEnquiry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryNote" ADD CONSTRAINT "EnquiryNote_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "WorkspaceEnquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffReview" ADD CONSTRAINT "StaffReview_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffReview" ADD CONSTRAINT "StaffReview_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

