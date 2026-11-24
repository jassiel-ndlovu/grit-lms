-- CreateEnum
CREATE TYPE "SupportKind" AS ENUM ('QUESTION', 'PROBLEM', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "SupportTopic" AS ENUM ('ACCOUNT', 'CLASSES', 'TESTS', 'PAYMENTS', 'SUBSCRIPTION', 'APP', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportRoute" AS ENUM ('NEXA', 'WORKSPACE');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- CreateTable
CREATE TABLE "SupportQuery" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "kind" "SupportKind" NOT NULL,
    "topic" "SupportTopic" NOT NULL,
    "route" "SupportRoute" NOT NULL,
    "workspaceId" TEXT,
    "courseId" TEXT,
    "requesterUserId" TEXT,
    "requesterName" VARCHAR(120) NOT NULL,
    "requesterEmail" VARCHAR(254) NOT NULL,
    "requesterPersona" VARCHAR(16) NOT NULL,
    "subject" VARCHAR(140) NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "pagePath" VARCHAR(300),
    "userAgent" VARCHAR(300),
    "helpful" BOOLEAN,
    "ipHash" VARCHAR(64),
    "accessToken" VARCHAR(64),
    "requesterReadAt" TIMESTAMP(3),
    "staffReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SupportQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorName" VARCHAR(120) NOT NULL,
    "fromStaff" BOOLEAN NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "body" VARCHAR(5000) NOT NULL,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportQuery_number_key" ON "SupportQuery"("number");

-- CreateIndex
CREATE UNIQUE INDEX "SupportQuery_accessToken_key" ON "SupportQuery"("accessToken");

-- CreateIndex
CREATE INDEX "SupportQuery_requesterUserId_lastActivityAt_idx" ON "SupportQuery"("requesterUserId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "SupportQuery_route_status_lastActivityAt_idx" ON "SupportQuery"("route", "status", "lastActivityAt");

-- CreateIndex
CREATE INDEX "SupportQuery_workspaceId_status_lastActivityAt_idx" ON "SupportQuery"("workspaceId", "status", "lastActivityAt");

-- CreateIndex
CREATE INDEX "SupportQuery_courseId_idx" ON "SupportQuery"("courseId");

-- CreateIndex
CREATE INDEX "SupportQuery_ipHash_createdAt_idx" ON "SupportQuery"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "SupportQuery_requesterEmail_createdAt_idx" ON "SupportQuery"("requesterEmail", "createdAt");

-- CreateIndex
CREATE INDEX "SupportMessage_queryId_createdAt_idx" ON "SupportMessage"("queryId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportQuery" ADD CONSTRAINT "SupportQuery_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportQuery" ADD CONSTRAINT "SupportQuery_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "SupportQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- References start at Q-1001.
ALTER SEQUENCE "SupportQuery_number_seq" RESTART WITH 1001;
