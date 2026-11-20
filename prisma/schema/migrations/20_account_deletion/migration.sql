-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletionCancelTokenHash" TEXT,
ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_deletionCancelTokenHash_key" ON "User"("deletionCancelTokenHash");

