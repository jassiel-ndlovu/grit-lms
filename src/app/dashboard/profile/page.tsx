/**
 * /dashboard/profile — role-aware self-service profile page.
 *
 * Replaces the legacy /dashboard/account. Any signed-in user can:
 *   - Edit their display name and avatar.
 *   - Tutors: edit their bio (shown on course pages).
 *   - Change their password (requires the current one).
 *
 * Server Component. Role is read from the session, profile row from the
 * matching Student/Tutor table. All writes flow through features/users
 * server actions.
 */

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { ProfileForm } from "@/features/users/components/profile-form";
import { PasswordForm } from "@/features/users/components/password-form";
import HeaderProfile from "@/components/illustrations/generated/header-profile";
import { PageFrame, PageTitle } from "@/components/shell/page-frame";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const email = session.user.email.toLowerCase();

  let fullName = session.user.name ?? "";
  let bio: string | null = null;
  let imageUrl: string | null = null;

  if (session.user.role === "STUDENT") {
    const s = await prisma.student.findUnique({
      where: { email },
      select: { fullName: true, imageUrl: true },
    });
    if (s) {
      fullName = s.fullName;
      imageUrl = s.imageUrl ?? null;
    }
  } else if (session.user.role === "TUTOR") {
    const t = await prisma.tutor.findUnique({
      where: { email },
      select: { fullName: true, bio: true, profileImageUrl: true },
    });
    if (t) {
      fullName = t.fullName;
      bio = t.bio ?? null;
      imageUrl = t.profileImageUrl ?? null;
    }
  }

  const initial = (fullName || "?").trim().charAt(0).toUpperCase();
  const memberSince = await prisma.user.findUnique({
    where: { email },
    select: { createdAt: true },
  });

  return (
    <PageFrame type="settings" breadcrumb={[{ label: "Profile" }]}>
      <PageTitle
        icon={
          imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="size-8 rounded-full object-cover" />
          ) : (
            <span className="bg-brand-terracotta text-brand-terracotta-foreground flex size-8 items-center justify-center rounded-full text-base font-semibold">
              {initial}
            </span>
          )
        }
        eyebrow="Your profile"
        title={fullName || "Unnamed"}
        illustration={<HeaderProfile />}
        properties={
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">{email}</span>
            <Badge variant="secondary">{session.user.role}</Badge>
            {memberSince?.createdAt ? (
              <span className="text-muted-foreground text-xs">
                Member since{" "}
                {new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(memberSince.createdAt)}
              </span>
            ) : null}
          </div>
        }
      />

      <section className="grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <div className="mb-4">
            <h2 className="font-display text-xl leading-tight">
              Personal info
            </h2>
            <p className="text-muted-foreground text-sm">
              How you appear to others on {`Nexa LMS`}.
            </p>
          </div>
          <ProfileForm
            role={session.user.role}
            defaults={{ fullName, bio, imageUrl }}
          />
        </Card>

        <Card className="p-6 lg:col-span-2">
          <div className="mb-4">
            <h2 className="font-display text-xl leading-tight">Security</h2>
            <p className="text-muted-foreground text-sm">
              Change your sign-in password.
            </p>
          </div>
          <PasswordForm />
          <Separator className="my-6" />
          <div className="text-muted-foreground space-y-2 text-xs">
            <p className="font-medium text-foreground">Tips</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Use at least 8 characters — a passphrase is easiest.</li>
              <li>Never share your password. Tutors will never ask for it.</li>
              <li>
                Forgot it? Ask your tutor for a new sign-in code.
              </li>
            </ul>
          </div>
        </Card>
      </section>
    </PageFrame>
  );
}
