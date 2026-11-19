-- Issue #93, step 5 (owner-approved): drop the legacy course links.
-- Teaching is CourseStaff and enrolment is Enrollment (6_tenancy_courses).
-- Before this ran, scripts/check-tenancy-parity.ts showed the new tables
-- matched these columns on production and Preview, and a Neon backup branch
-- of each was taken (backup-legacy-course-links-20261119).
-- Generated with `prisma migrate diff` against both databases; same SQL.

-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_tutorId_fkey";

-- DropForeignKey
ALTER TABLE "_CourseEnrollments" DROP CONSTRAINT "_CourseEnrollments_A_fkey";

-- DropForeignKey
ALTER TABLE "_CourseEnrollments" DROP CONSTRAINT "_CourseEnrollments_B_fkey";

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "tutorId";

-- DropTable
DROP TABLE "_CourseEnrollments";
