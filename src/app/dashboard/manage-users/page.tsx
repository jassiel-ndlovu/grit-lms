/**
 * /dashboard/manage-users — tutor-only user provisioning surface.
 *
 * Replaces the legacy /api/seed-users route. Tutors can:
 *   - Create a Student user + Student profile in one submit.
 *   - Reset any user's password (dialog on the row).
 *
 * The page is intentionally simple — one hero card with the create form,
 * then the roster below. Illustration provides visual anchor.
 */

import Image from "next/image";
import { redirect } from "next/navigation";
import { UserPlus, Users } from "lucide-react";

import { auth } from "@/lib/auth";
import { Card } from "@/components/ui/card";

import { listAllUsers } from "@/features/users/queries";
import { CreateUserForm } from "@/features/users/components/create-user-form";
import { UserList } from "@/features/users/components/user-list";

export const metadata = { title: "Manage users" };

export default async function ManageUsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

  const users = await listAllUsers();
  const studentCount = users.filter((u) => u.role === "STUDENT").length;
  const tutorCount = users.filter((u) => u.role === "TUTOR").length;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <section className="border-b-2 border-brand-terracotta bg-primary text-primary-foreground overflow-hidden rounded-lg">
        <div className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-primary-foreground/70 text-sm">Administration</p>
            <h1 className="font-display mt-1 text-4xl leading-tight tracking-tight">
              Manage users
            </h1>
            <p className="text-primary-foreground/70 mt-3 text-sm">
              Provision student accounts and reset passwords when someone
              forgets. This replaces the old seed route.
            </p>
            <div className="mt-4 flex gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Users className="size-4" />
                <span className="text-primary-foreground/90">
                  <span className="font-semibold">{studentCount}</span>{" "}
                  {studentCount === 1 ? "student" : "students"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <UserPlus className="size-4" />
                <span className="text-primary-foreground/90">
                  <span className="font-semibold">{tutorCount}</span>{" "}
                  {tutorCount === 1 ? "tutor" : "tutors"}
                </span>
              </div>
            </div>
          </div>
          <div className="relative hidden h-40 w-56 shrink-0 md:block">
            <Image
              src="/illustrations/teamwork.svg"
              alt=""
              fill
              priority
              className="object-contain"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-2">
          <div className="mb-4">
            <h2 className="font-display text-xl leading-tight">
              Add a student
            </h2>
            <p className="text-muted-foreground text-sm">
              Creates the sign-in account and the linked student profile.
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
    </div>
  );
}
