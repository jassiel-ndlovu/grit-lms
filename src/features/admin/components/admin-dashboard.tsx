/**
 * AdminDashboard: the home page for Nexa admins, in B's PageFrame (#215).
 * Platform-wide counts, the newest accounts, and links to the admin tools.
 * Server Component.
 */

import Link from "next/link";
import { ArrowRight, BadgePercent, BookOpen, Building2, GraduationCap, HandCoins, Trash2, UserCog, Users } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { prisma } from "@/lib/db";

const TOOLS = [
  { icon: Building2, title: "Workspaces and billing", body: "Every workspace's plan, invoices, comps and trials.", href: "/dashboard/admin/billing" },
  { icon: HandCoins, title: "Refund recoveries", body: "Deductions from tutors' payouts after a refund.", href: "/dashboard/admin/billing/recoveries" },
  { icon: BadgePercent, title: "Discount codes", body: "Codes for Nexa's own plans.", href: "/dashboard/admin/billing/discount-codes" },
  { icon: Trash2, title: "Retention", body: "Workspaces due for deletion after cancelling.", href: "/dashboard/admin/billing/retention" },
  { icon: Users, title: "Users", body: "Find any account and reset a password.", href: "/dashboard/manage-users" },
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
    <PageFrame type="home" breadcrumb={[{ label: "Home" }]}>
      <PageTitle
        eyebrow={`Welcome, ${firstName}`}
        title="Platform overview"
        description={`${activeTests} active ${activeTests === 1 ? "test" : "tests"} and ${activeAssignments} active ${activeAssignments === 1 ? "assignment" : "assignments"} across ${courseCount} ${courseCount === 1 ? "course" : "courses"}.`}
      />

      <StatTiles>
        {stats.map(({ icon: Icon, label, value }) => (
          <StatTile key={label} icon={<Icon aria-hidden className="size-4" />} label={label} value={value} />
        ))}
      </StatTiles>

      <PageSection
        title="Newest accounts"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/manage-users">
              All users
              <ArrowRight aria-hidden className="size-3" />
            </Link>
          </Button>
        }
      >
        <Card className="overflow-hidden p-0">
          <ul className="divide-border divide-y">
            {newest.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                <div className="bg-secondary text-secondary-foreground flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-medium">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">{u.name}</p>
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
      </PageSection>

      <PageSection title="Admin tools">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TOOLS.map(({ icon: Icon, title, body, href }) => (
            <Link key={href} href={href} className="group">
              <Card className="group-hover:border-foreground/20 flex h-full items-start gap-3 p-5 transition-colors">
                <Icon aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="text-foreground text-sm font-medium">{title}</p>
                  <p className="text-muted-foreground text-sm">{body}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </PageSection>
    </PageFrame>
  );
}
