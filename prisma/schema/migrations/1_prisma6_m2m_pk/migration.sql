-- AlterTable
ALTER TABLE "_CourseEnrollments" ADD CONSTRAINT "_CourseEnrollments_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_CourseEnrollments_AB_unique";

