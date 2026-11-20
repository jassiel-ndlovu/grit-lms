-- CreateEnum
CREATE TYPE "PayoutRecoveryStatus" AS ENUM ('AWAITING_REFUND', 'ACTIVE', 'RECOVERED', 'CANCELLED', 'WAIVED');

-- AlterEnum
ALTER TYPE "PaymentPurpose" ADD VALUE 'PAYOUT_RECOVERY';

-- CreateTable
CREATE TABLE "PayoutRecovery" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "payoutAccountId" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "PayoutRecoveryStatus" NOT NULL DEFAULT 'AWAITING_REFUND',
    "noticeSentAt" TIMESTAMP(3),
    "deductFrom" TIMESTAMP(3),
    "invoiceOfferedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRecoveryDeduction" (
    "id" TEXT NOT NULL,
    "recoveryId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutRecoveryDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRecovery_refundId_key" ON "PayoutRecovery"("refundId");

-- CreateIndex
CREATE INDEX "PayoutRecovery_payoutAccountId_status_idx" ON "PayoutRecovery"("payoutAccountId", "status");

-- CreateIndex
CREATE INDEX "PayoutRecovery_status_deductFrom_idx" ON "PayoutRecovery"("status", "deductFrom");

-- CreateIndex
CREATE INDEX "PayoutRecoveryDeduction_paymentId_idx" ON "PayoutRecoveryDeduction"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRecoveryDeduction_recoveryId_paymentId_key" ON "PayoutRecoveryDeduction"("recoveryId", "paymentId");

-- AddForeignKey
ALTER TABLE "PayoutRecovery" ADD CONSTRAINT "PayoutRecovery_payoutAccountId_fkey" FOREIGN KEY ("payoutAccountId") REFERENCES "PayoutAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRecovery" ADD CONSTRAINT "PayoutRecovery_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRecoveryDeduction" ADD CONSTRAINT "PayoutRecoveryDeduction_recoveryId_fkey" FOREIGN KEY ("recoveryId") REFERENCES "PayoutRecovery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRecoveryDeduction" ADD CONSTRAINT "PayoutRecoveryDeduction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

