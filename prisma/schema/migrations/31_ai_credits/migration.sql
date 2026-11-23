-- AI credits: ledger, allowances, personal-credit switch (#216, phase 1). Additive only.

-- CreateEnum
CREATE TYPE "AiCreditPool" AS ENUM ('INCLUDED', 'BOUGHT', 'PERSONAL');

-- CreateEnum
CREATE TYPE "AiCreditKind" AS ENUM ('GRANT', 'PURCHASE', 'SPEND', 'ADJUST');

-- CreateEnum
CREATE TYPE "AiAllowanceTarget" AS ENUM ('WORKSPACE_DEFAULT', 'BRANCH', 'TEAM', 'MEMBERSHIP');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "aiPersonalCredits" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AiCreditEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pool" "AiCreditPool" NOT NULL,
    "kind" "AiCreditKind" NOT NULL,
    "credits" INTEGER NOT NULL,
    "userId" TEXT,
    "periodKey" TEXT,
    "feature" TEXT,
    "ref" TEXT,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3),
    "key" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCreditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCreditAllowance" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "targetType" "AiAllowanceTarget" NOT NULL,
    "targetId" TEXT NOT NULL DEFAULT '',
    "monthlyCredits" INTEGER NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiCreditAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiCreditEntry_key_key" ON "AiCreditEntry"("key");

-- CreateIndex
CREATE INDEX "AiCreditEntry_workspaceId_pool_createdAt_idx" ON "AiCreditEntry"("workspaceId", "pool", "createdAt");

-- CreateIndex
CREATE INDEX "AiCreditEntry_workspaceId_userId_createdAt_idx" ON "AiCreditEntry"("workspaceId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiCreditEntry_workspaceId_periodKey_idx" ON "AiCreditEntry"("workspaceId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "AiCreditAllowance_workspaceId_targetType_targetId_key" ON "AiCreditAllowance"("workspaceId", "targetType", "targetId");

-- AddForeignKey
ALTER TABLE "AiCreditEntry" ADD CONSTRAINT "AiCreditEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCreditAllowance" ADD CONSTRAINT "AiCreditAllowance_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

