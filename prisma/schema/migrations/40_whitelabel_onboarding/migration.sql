-- CreateEnum
CREATE TYPE "BranchRollout" AS ENUM ('PLANNED', 'PILOT', 'LIVE');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "hideNexaBranding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "senderName" VARCHAR(60),
ADD COLUMN     "supportEmail" VARCHAR(254),
ADD COLUMN     "welcomeText" VARCHAR(300);

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "teamIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "rollout" "BranchRollout" NOT NULL DEFAULT 'PLANNED',
ADD COLUMN     "rolloutAt" TIMESTAMP(3);

