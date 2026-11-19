-- CreateEnum
CREATE TYPE "OutboundEmailPriority" AS ENUM ('AUTH', 'BILLING', 'NORMAL', 'DIGEST');

-- CreateEnum
CREATE TYPE "OutboundEmailStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED', 'SUPPRESSED');

-- CreateTable
CREATE TABLE "OutboundEmail" (
    "id" TEXT NOT NULL,
    "idempotencyKey" VARCHAR(256) NOT NULL,
    "userId" TEXT,
    "toEmail" TEXT NOT NULL,
    "workspaceId" TEXT,
    "template" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" "OutboundEmailPriority" NOT NULL DEFAULT 'NORMAL',
    "data" JSONB NOT NULL,
    "status" "OutboundEmailStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutboundEmail_idempotencyKey_key" ON "OutboundEmail"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OutboundEmail_status_priority_nextAttemptAt_idx" ON "OutboundEmail"("status", "priority", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "OutboundEmail_workspaceId_createdAt_idx" ON "OutboundEmail"("workspaceId", "createdAt");

