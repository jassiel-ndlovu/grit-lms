-- CreateEnum
CREATE TYPE "MathMode" AS ENUM ('EQUIVALENT', 'FORM', 'MARGIN');

-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'MATH_EXPRESSION';

-- AlterTable
ALTER TABLE "TestQuestion" ADD COLUMN     "mathMode" "MathMode";

