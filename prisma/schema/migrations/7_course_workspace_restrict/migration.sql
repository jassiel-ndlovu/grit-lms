-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_workspaceId_fkey";

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

