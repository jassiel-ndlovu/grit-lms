-- CreateEnum
CREATE TYPE "AiMarkStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AiConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "AiTutorAction" AS ENUM ('ACCEPTED', 'EDITED', 'REJECTED');

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "aiMarking" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TestQuestion" ADD COLUMN     "rubric" JSONB;

-- CreateTable
CREATE TABLE "AiMarkSuggestion" (
    "id" TEXT NOT NULL,
    "testSubmissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "requestId" TEXT NOT NULL,
    "status" "AiMarkStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "promptVersion" TEXT,
    "criteria" JSONB,
    "totalAwarded" DOUBLE PRECISION,
    "outOf" DOUBLE PRECISION NOT NULL,
    "confidence" "AiConfidence",
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "feedbackToStudent" TEXT,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "tutorAction" "AiTutorAction",
    "tutorScore" DOUBLE PRECISION,
    "actedByUserId" TEXT,
    "actedAt" TIMESTAMP(3),
    "requestedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMarkSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiMarkSuggestion_requestId_key" ON "AiMarkSuggestion"("requestId");

-- CreateIndex
CREATE INDEX "AiMarkSuggestion_status_createdAt_idx" ON "AiMarkSuggestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AiMarkSuggestion_questionId_idx" ON "AiMarkSuggestion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "AiMarkSuggestion_testSubmissionId_questionId_key" ON "AiMarkSuggestion"("testSubmissionId", "questionId");

-- AddForeignKey
ALTER TABLE "AiMarkSuggestion" ADD CONSTRAINT "AiMarkSuggestion_testSubmissionId_fkey" FOREIGN KEY ("testSubmissionId") REFERENCES "TestSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

