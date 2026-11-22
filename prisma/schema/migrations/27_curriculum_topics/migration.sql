-- Curriculum tagging (#216, contracts/curriculum.md). Additive only.

-- CreateEnum
CREATE TYPE "Curriculum" AS ENUM ('CAPS', 'IEB', 'OTHER');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "curriculum" "Curriculum",
ADD COLUMN "subject" TEXT,
ADD COLUMN "gradeLevel" INTEGER;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "topics" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "TestQuestion" ADD COLUMN "topics" TEXT[] DEFAULT ARRAY[]::TEXT[];
