-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TimesheetEntryKind" AS ENUM ('SESSION', 'COVER', 'BOOKING', 'MANUAL');

-- CreateEnum
CREATE TYPE "CoverStatus" AS ENUM ('OPEN', 'ASSIGNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decisionNote" VARCHAR(500),
    "hourlyCents" INTEGER,
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,
    "amountCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetEntry" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "kind" "TimesheetEntryKind" NOT NULL,
    "key" VARCHAR(120),
    "courseId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "note" VARCHAR(300),
    "eventId" TEXT,
    "occurrenceStart" TIMESTAMP(3),
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimesheetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayRate" (
    "membershipId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "hourlyCents" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT NOT NULL,

    CONSTRAINT "PayRate_pkey" PRIMARY KEY ("membershipId")
);

-- CreateTable
CREATE TABLE "CoverRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "occurrenceStart" TIMESTAMP(3) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "absentMembershipId" TEXT NOT NULL,
    "coverMembershipId" TEXT,
    "status" "CoverStatus" NOT NULL DEFAULT 'OPEN',
    "liveKey" TEXT,
    "reason" VARCHAR(300),
    "createdById" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3),
    "addedCourseStaff" BOOLEAN NOT NULL DEFAULT false,
    "accessEndedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoverRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Timesheet_workspaceId_month_status_idx" ON "Timesheet"("workspaceId", "month", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_membershipId_month_key" ON "Timesheet"("membershipId", "month");

-- CreateIndex
CREATE INDEX "TimesheetEntry_timesheetId_startsAt_idx" ON "TimesheetEntry"("timesheetId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetEntry_timesheetId_key_key" ON "TimesheetEntry"("timesheetId", "key");

-- CreateIndex
CREATE INDEX "PayRate_workspaceId_idx" ON "PayRate"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CoverRequest_liveKey_key" ON "CoverRequest"("liveKey");

-- CreateIndex
CREATE INDEX "CoverRequest_workspaceId_startsAt_idx" ON "CoverRequest"("workspaceId", "startsAt");

-- CreateIndex
CREATE INDEX "CoverRequest_coverMembershipId_startsAt_idx" ON "CoverRequest"("coverMembershipId", "startsAt");

-- CreateIndex
CREATE INDEX "CoverRequest_absentMembershipId_startsAt_idx" ON "CoverRequest"("absentMembershipId", "startsAt");

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRate" ADD CONSTRAINT "PayRate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRate" ADD CONSTRAINT "PayRate_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverRequest" ADD CONSTRAINT "CoverRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

