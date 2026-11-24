/**
 * /dashboard/manage-users — Nexa admins only (2026-11-21). It lists every
 * account on the platform, so tutors and workspace owners are sent to
 * /dashboard/students, which shows only their own students and handles
 * sign-in codes. resetUserPassword checks on the server too.
 *
 * Original note — tutor-only user provisioning surface.
 *
 * Replaces the legacy /api/seed-users route. Tutors can:
 *   - Create a Student user + Student profile in one submit.
 *   - Reset any user's password (dialog on the row).
 *
 * The page is intentionally simple — one hero card with the create form,
 * then the roster below. Illustration provides visual anchor.
 */

import { redirect } from "next/navigation";
import { UserPlus, Users } from "lucide-react";

import { auth } from "@/lib/auth";
import { Card } from "@/components/ui/card";

import { listAllUsers } from "@/features/users/queries";
import { CreateUserForm } from "@/features/users/components/create-user-form";
import { UserList } from "@/features/users/components/user-list";
import HeaderPeople from "@/components/illustrations/generated/header-people";
import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";

export const metadata = { title: "Manage users" };

export default async function ManageUsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");
  if (session.user.role === "TUTOR") redirect("/dashboard/students");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const users = await listAllUsers();
  const studentCount = users.filter((u) => u.role === "STUDENT").length;
  const tutorCount = users.filter((u) => u.role === "TUTOR").length;

  return (
    <PageFrame type="list" breadcrumb={[{ label: "Manage users" }]}>
      <PageTitle
        eyebrow="Administration"
        title="Manage users"
        description="Create student accounts, and reset the password of anyone who's locked out."
        illustration={<HeaderPeople />}
        properties={
          <StatTiles>
            <StatTile icon={<Users />} label={studentCount === 1 ? "Student" : "Students"} value={studentCount} />
            <StatTile icon={<UserPlus />} label={tutorCount === 1 ? "Tutor" : "Tutors"} value={tutorCount} />
          </StatTiles>
        }
      />

      <section className="grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-2">
          <div className="mb-4">
            <h2 className="font-display text-xl leading-tight">
              Add a student
            </h2>
            <p className="text-muted-foreground text-sm">
              Makes an account they can sign in with.
            </p>
          </div>
          <CreateUserForm />
        </Card>

        <Card className="p-6 lg:col-span-3">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <h2 className="font-display text-xl leading-tight">
                All users
              </h2>
              <p className="text-muted-foreground text-sm">
                Newest first. Use &ldquo;Reset password&rdquo; to help
                someone who&apos;s locked out.
              </p>
            </div>
            <span className="text-muted-foreground text-xs">
              {users.length} total
            </span>
          </div>
          <UserList users={users} />
        </Card>
      </section>
    </PageFrame>
  );
}
