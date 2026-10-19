/**
 * AdminDashboard — landing page for ADMIN users.
 *
 * A first cut: platform-wide counts, the newest accounts, and placeholders
 * for the admin tools still to come. Server Component.
 */

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  FileBarChart,
  GraduationCap,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db";

const COMING_SOON = [
  { icon: FileBarChart, title: "Reports", body: "Enrolment, engagement and results across every course." },
  { icon: ShieldCheck, title: "Audit log", body: "Who changed what, and when." },
  { icon: ClipboardList, title: "Course oversight", body: "Review and reassign courses between tutors." },
];

export async function AdminDashboard({ firstName }: { firstName: string }) {
  const [byRole, courseCount, activeTests, activeAssignments, newest] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.course.count(),
    prisma.test.count({ where: { isActive: true } }),
    prisma.submission.count({ where: { isActive: true } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, role: true, emailVerified: true },
    }),
  ]);
  const count = (role: string) => byRole.find((r) => r.role === role)?._count._all ?? 0;

  const stats = [
    { icon: GraduationCap, label: "Students", value: count("STUDENT") },
    { icon: UserCog, label: "Tutors", value: count("TUTOR") },
    { icon: Users, label: "Parents", value: count("PARENT") },
    { icon: BookOpen, label: "Courses", value: courseCount },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8 px-4 sm:px-6 py-6 sm:py-10">
      <section className="border-b-2 border-brand-terracotta bg-primary text-primary-foreground overflow-hidden rounded-lg">
        <div className="flex flex-col gap-6 p-5 sm:p-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-primary-foreground/70 text-sm">Welcome, {firstName}.</p>
            <h1 className="font-display mt-1 text-3xl sm:text-4xl leading-tight tracking-tight">
              Platform overview
            </h1>
            <p className="text-primary-foreground/70 mt-3 max-w-xl text-sm">
              {activeTests} active {activeTests === 1 ? "test" : "tests"} and{" "}
              {activeAssignments} active {activeAssignments === 1 ? "assignment" : "assignments"} across{" "}
              {courseCount} {courseCount === 1 ? "course" : "courses"}.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <Card key={label} className="p-5">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Icon className="size-4 text-brand-terracotta" />
              {label}
            </div>
            <p className="font-display mt-2 text-3xl tabular-nums text-foreground">{value}</p>
          </Card>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-xl leading-tight tracking-tight text-foreground">
              Newest accounts
            </h2>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Link href="/dashboard/manage-users">
                All users
                <ArrowRight className="size-3" />
              </Link>
            </Button>
          </div>
          <Card className="overflow-hidden p-0">
            <ul className="divide-border divide-y">
              {newest.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="bg-secondary text-secondary-foreground flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-medium">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
                    <p className="text-muted-foreground truncate text-xs">{u.email}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {u.role.toLowerCase()}
                  </Badge>
                  {!u.emailVerified && (
                    <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
                      unverified
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-xl leading-tight tracking-tight text-foreground">
            Coming soon
          </h2>
          <div className="space-y-3">
            {COMING_SOON.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="flex items-start gap-3 p-5">
                <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-9 shrink-0 items-center justify-center rounded-md">
                  <Icon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-muted-foreground text-sm">{body}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
