-- B's requests of 22 Nov (#217 themes, #216 accessibility, #211 meeting provider). Additive only: new enum values and defaulted columns.

-- CreateEnum
CREATE TYPE "TextSize" AS ENUM ('DEFAULT', 'LARGE', 'LARGER');

-- CreateEnum
CREATE TYPE "ReadingFont" AS ENUM ('DEFAULT', 'DYSLEXIA');

-- CreateEnum
CREATE TYPE "MeetingProvider" AS ENUM ('GOOGLE_MEET', 'ZOOM', 'TEAMS', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UiTheme" ADD VALUE 'OCEAN';
ALTER TYPE "UiTheme" ADD VALUE 'SUNSET';
ALTER TYPE "UiTheme" ADD VALUE 'CONTRAST';

-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN     "readingFont" "ReadingFont" NOT NULL DEFAULT 'DEFAULT',
ADD COLUMN     "textSize" "TextSize" NOT NULL DEFAULT 'DEFAULT';

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "meetingProvider" "MeetingProvider" NOT NULL DEFAULT 'GOOGLE_MEET';

