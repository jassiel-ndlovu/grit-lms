-- CreateEnum
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED', 'SPAM');

-- CreateTable
CREATE TABLE "PlatformEnquiry" (
    "id" TEXT NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(40),
    "organisation" VARCHAR(160),
    "students" INTEGER,
    "message" VARCHAR(4000) NOT NULL,
    "source" VARCHAR(120),
    "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
    "note" VARCHAR(2000),
    "ipHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),

    CONSTRAINT "PlatformEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformEnquiry_ipHash_createdAt_idx" ON "PlatformEnquiry"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformEnquiry_email_createdAt_idx" ON "PlatformEnquiry"("email", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformEnquiry_status_createdAt_idx" ON "PlatformEnquiry"("status", "createdAt");

