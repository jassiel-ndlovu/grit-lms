-- CreateEnum
CREATE TYPE "LessonCreditKind" AS ENUM ('PURCHASE', 'BOOKING', 'CANCEL_RETURN', 'REFUND_REVERSAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('BOOKED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "bookingCancelHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "bookingHorizonDays" INTEGER NOT NULL DEFAULT 28,
ADD COLUMN     "bookingLeadHours" INTEGER NOT NULL DEFAULT 12;

-- CreateTable
CREATE TABLE "LessonCredit" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "kind" "LessonCreditKind" NOT NULL,
    "lessons" INTEGER NOT NULL,
    "invoiceLineId" TEXT,
    "reversesLineId" TEXT,
    "bookingId" TEXT,
    "byUserId" TEXT,
    "note" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingAvailability" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "courseId" TEXT,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "slotMinutes" INTEGER NOT NULL DEFAULT 60,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingTimeOff" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "note" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingTimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'BOOKED',
    "slotKey" TEXT,
    "bookedByUserId" TEXT NOT NULL,
    "note" VARCHAR(500),
    "meetingLink" VARCHAR(500),
    "usedCredit" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancelReason" VARCHAR(300),
    "creditReturned" BOOLEAN NOT NULL DEFAULT false,
    "remindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonCredit_invoiceLineId_key" ON "LessonCredit"("invoiceLineId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonCredit_reversesLineId_key" ON "LessonCredit"("reversesLineId");

-- CreateIndex
CREATE INDEX "LessonCredit_learnerId_courseId_idx" ON "LessonCredit"("learnerId", "courseId");

-- CreateIndex
CREATE INDEX "LessonCredit_workspaceId_createdAt_idx" ON "LessonCredit"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LessonCredit_bookingId_kind_key" ON "LessonCredit"("bookingId", "kind");

-- CreateIndex
CREATE INDEX "BookingAvailability_membershipId_idx" ON "BookingAvailability"("membershipId");

-- CreateIndex
CREATE INDEX "BookingAvailability_workspaceId_idx" ON "BookingAvailability"("workspaceId");

-- CreateIndex
CREATE INDEX "BookingTimeOff_membershipId_startsAt_idx" ON "BookingTimeOff"("membershipId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_slotKey_key" ON "Booking"("slotKey");

-- CreateIndex
CREATE INDEX "Booking_learnerId_startsAt_idx" ON "Booking"("learnerId", "startsAt");

-- CreateIndex
CREATE INDEX "Booking_membershipId_startsAt_idx" ON "Booking"("membershipId", "startsAt");

-- CreateIndex
CREATE INDEX "Booking_courseId_startsAt_idx" ON "Booking"("courseId", "startsAt");

-- CreateIndex
CREATE INDEX "Booking_status_startsAt_idx" ON "Booking"("status", "startsAt");

-- AddForeignKey
ALTER TABLE "LessonCredit" ADD CONSTRAINT "LessonCredit_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonCredit" ADD CONSTRAINT "LessonCredit_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAvailability" ADD CONSTRAINT "BookingAvailability_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAvailability" ADD CONSTRAINT "BookingAvailability_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingTimeOff" ADD CONSTRAINT "BookingTimeOff_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingTimeOff" ADD CONSTRAINT "BookingTimeOff_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The Plus service "session-booking" (contracts/services.md). seed-billing.ts
-- upserts it too; inserting here keeps the backfill below valid.
INSERT INTO "Service" ("key", "name", "kind", "tier", "status")
VALUES ('session-booking', 'Session booking with prepaid lesson packs', 'PREMIUM', 'PLUS', 'ACTIVE')
ON CONFLICT ("key") DO NOTHING;

-- Courses already on Plus or Pro get it, so no course changes tier (new
-- courses start with every v1 premium service).
INSERT INTO "CourseService" ("id", "workspaceId", "courseId", "serviceKey", "enabled", "changedAt", "changedByUserId")
SELECT DISTINCT ON (cs."courseId") 'cs_book_' || md5(cs."courseId"), cs."workspaceId", cs."courseId", 'session-booking', true, CURRENT_TIMESTAMP, cs."changedByUserId"
FROM "CourseService" cs
JOIN "Service" s ON s."key" = cs."serviceKey"
WHERE cs."enabled" = true AND s."kind" = 'PREMIUM' AND s."tier" IN ('PLUS', 'PRO') AND cs."serviceKey" <> 'session-booking'
ORDER BY cs."courseId", cs."changedAt" DESC
ON CONFLICT ("courseId", "serviceKey") DO NOTHING;
