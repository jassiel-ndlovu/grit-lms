-- CreateEnum
CREATE TYPE "InviteKind" AS ENUM ('STAFF', 'LEARNER', 'GUARDIAN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailIsPlaceholder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "initialCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "InviteKind" NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" "MembershipRole",
    "courseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isMinor" BOOLEAN NOT NULL DEFAULT false,
    "learnerInviteId" TEXT,
    "learnerId" TEXT,
    "displayName" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE INDEX "Invite_workspaceId_kind_idx" ON "Invite"("workspaceId", "kind");

-- CreateIndex
CREATE INDEX "Invite_email_idx" ON "Invite"("email");

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One pending invite per (workspace, email, kind) (design 02, section 5).
CREATE UNIQUE INDEX "Invite_pending_key" ON "Invite"("workspaceId", "email", "kind") WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;
