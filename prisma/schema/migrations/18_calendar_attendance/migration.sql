-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('TUTOR', 'CHECK_IN_CODE');

-- AlterTable
ALTER TABLE "CourseEvent" ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'Africa/Johannesburg';

-- CreateTable
CREATE TABLE "CourseEventException" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "occurrenceStart" TIMESTAMP(3) NOT NULL,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "description" TEXT,
    "start" TIMESTAMP(3),
    "duration" INTEGER,
    "location" TEXT,
    "link" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseEventException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionAttendance" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "occurrenceStart" TIMESTAMP(3) NOT NULL,
    "learnerId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "method" "AttendanceMethod" NOT NULL DEFAULT 'TUTOR',
    "note" TEXT,
    "markedByUserId" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guardianNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "SessionAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCode" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "occurrenceStart" TIMESTAMP(3) NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarFeedToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "CalendarFeedToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseEventException_eventId_occurrenceStart_key" ON "CourseEventException"("eventId", "occurrenceStart");

-- CreateIndex
CREATE INDEX "SessionAttendance_learnerId_occurrenceStart_idx" ON "SessionAttendance"("learnerId", "occurrenceStart");

-- CreateIndex
CREATE UNIQUE INDEX "SessionAttendance_eventId_occurrenceStart_learnerId_key" ON "SessionAttendance"("eventId", "occurrenceStart", "learnerId");

-- CreateIndex
CREATE INDEX "AttendanceCode_codeHash_idx" ON "AttendanceCode"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceCode_eventId_occurrenceStart_key" ON "AttendanceCode"("eventId", "occurrenceStart");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarFeedToken_userId_key" ON "CalendarFeedToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarFeedToken_tokenHash_key" ON "CalendarFeedToken"("tokenHash");

-- AddForeignKey
ALTER TABLE "CourseEventException" ADD CONSTRAINT "CourseEventException_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CourseEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAttendance" ADD CONSTRAINT "SessionAttendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CourseEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionAttendance" ADD CONSTRAINT "SessionAttendance_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCode" ADD CONSTRAINT "AttendanceCode_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CourseEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarFeedToken" ADD CONSTRAINT "CalendarFeedToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

