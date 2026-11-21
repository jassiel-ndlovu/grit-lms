-- Which workspace's staff manage an account they made (2026-11-21). Self-made accounts stay unmanaged, so staff can't take them over after a join request.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "managedByWorkspaceId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managedByWorkspaceId_fkey" FOREIGN KEY ("managedByWorkspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill. Students made by staff, or from before tenancy (all made by
-- tutors or admins): their first workspace. Since the cutover only staff
-- have set User.password (the old createStudentUser form, or a reset), and
-- tutor-created students have a username; self sign-ups have neither.
UPDATE "User" u SET "managedByWorkspaceId" = l."workspaceId"
FROM (SELECT DISTINCT ON ("userId") "userId", "workspaceId" FROM "Learner" ORDER BY "userId", "createdAt") l
WHERE l."userId" = u."id"
  AND u."platformRole" = 'USER'
  AND u."role" = 'STUDENT'
  AND (u."username" IS NOT NULL OR u."createdAt" < '2026-11-20' OR u."password" <> '')
  AND NOT EXISTS (SELECT 1 FROM "Membership" m WHERE m."userId" = u."id");

-- Parents made by staff (a username): the workspace of a child they guard.
UPDATE "User" u SET "managedByWorkspaceId" = l."workspaceId"
FROM (
  SELECT DISTINCT ON (g."guardianUserId") g."guardianUserId", l."workspaceId"
  FROM "Guardianship" g JOIN "Learner" l ON l."userId" = g."studentUserId"
  ORDER BY g."guardianUserId", l."createdAt"
) l
WHERE l."guardianUserId" = u."id"
  AND u."platformRole" = 'USER'
  AND u."role" = 'PARENT'
  AND u."username" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Membership" m WHERE m."userId" = u."id");
