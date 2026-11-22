-- The import and export engine (#216, phase 1). Additive only.

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PREVIEW', 'APPLYING', 'DONE', 'FAILED', 'UNDOING', 'UNDONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PREVIEW',
    "fileName" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "rows" JSONB NOT NULL,
    "options" JSONB,
    "summary" JSONB,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMP(3),
    "secretsSealed" TEXT,
    "secretsExpireAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "undoUntil" TIMESTAMP(3),
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportJob_workspaceId_createdAt_idx" ON "ImportJob"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_status_leaseUntil_idx" ON "ImportJob"("status", "leaseUntil");

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

