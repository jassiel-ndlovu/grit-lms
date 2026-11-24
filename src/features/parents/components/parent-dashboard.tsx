/**
 * ParentDashboard — landing page for PARENT users.
 *
 * Lists the children linked to this account (viewer.children: ACTIVE
 * guardianships, each with the workspaces the child learns in), each card
 * with lesson progress and the latest released mark, linking to the
 * child's view (/dashboard/children/[userId]). Server Component.
 */

import Link from "next/link";
import { Bell, ChevronRight, GraduationCap, MessageSquare, Receipt, Users } from "lucide-react";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ChildSummary } from "@/features/activity/child-overview";
import { childRoutes } from "@/features/activity/lib/child-overview";
import type { Viewer } from "@/lib/viewer-core";

const COMING_SOON = [
  { icon: MessageSquare, title: "Tutor messages", body: "Questions and updates between you and your learners' tutors." },
];

type Learner = Viewer["children"][number] & { summary: ChildSummary };

export function ParentDashboard({ firstName, learners, notes }: { firstName: string; learners: Learner[]; /** Notes from tutors (at-risk alerts shared with parents). */ notes?: React.ReactNode }) {
  return (
    <PageFrame type="home" breadcrumb={[{ label: "Home" }]}>
      <PageTitle
        eyebrow={`Welcome, ${firstName}`}
        title="Follow your learners' progress"
        description="Marks, deadlines and course updates for the students you look after, in one place."
      />

      <section className="space-y-4">
        <h2 className="text-foreground text-base font-semibold">
          Your learners
        </h2>
        {learners.length === 0 ? (
          <Card className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-14 items-center justify-center rounded-full">
              <Users className="size-6" />
            </div>
            <div>
              <h3 className="font-display text-xl leading-tight text-foreground">
                No learners linked yet
              </h3>
              <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
                Once your account is linked to your child&apos;s, their courses and results
                will show here. Ask your school to link your accounts.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/help/new?kind=QUESTION&topic=ACCOUNT">
                Ask for help
              </Link>
            </Button>
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {learners.map((child) => (
              <li key={child.userId}>
                <Link href={childRoutes.child(child.userId)} className="group block h-full">
                  <Card className="flex h-full items-start gap-4 p-5 transition-shadow group-hover:shadow-md">
                    <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-10 shrink-0 items-center justify-center rounded-full font-medium">
                      {child.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="space-y-1">
                        <p className="text-foreground font-medium">{child.name}</p>
                        <p className="text-muted-foreground text-sm">
                          {child.workspaces.length ? child.workspaces.map((w) => w.name).join(" · ") : "Not learning anywhere yet"}
                        </p>
                      </div>
                      <ChildSummaryLine summary={child.summary} />
                    </div>
                    <ChevronRight className="text-muted-foreground size-4 shrink-0 self-center transition-transform group-hover:translate-x-0.5" />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {notes}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-4">
          <h2 className="text-foreground text-base font-semibold">
            Coming soon
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {COMING_SOON.map(({ icon: Icon, title, body }) => (
              <Card key={title} className="space-y-2 p-5">
                <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-9 items-center justify-center rounded-md">
                  <Icon className="size-4" />
                </div>
                <p className="text-sm font-medium text-foreground">{title}</p>
                <p className="text-muted-foreground text-sm">{body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-foreground text-base font-semibold">
            Shortcuts
          </h2>
          <Card className="divide-border divide-y p-0">
            {learners.length ? (
              <Link href="/dashboard/fees" className="hover:bg-muted/40 flex items-center gap-3 px-5 py-3 text-sm transition-colors">
                <Receipt className="text-brand-terracotta size-4" />
                Fees
              </Link>
            ) : null}
            <Link href="/dashboard/notifications" className="hover:bg-muted/40 flex items-center gap-3 px-5 py-3 text-sm transition-colors">
              <Bell className="text-brand-terracotta size-4" />
              Notifications
            </Link>
            <Link href="/dashboard/settings" className="hover:bg-muted/40 flex items-center gap-3 px-5 py-3 text-sm transition-colors">
              <GraduationCap className="text-brand-terracotta size-4" />
              Email &amp; display settings
            </Link>
          </Card>
        </section>
      </div>
    </PageFrame>
  );
}

function ChildSummaryLine({ summary }: { summary: ChildSummary }) {
  const { progress, latestMark, dueSoon } = summary;
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">Lessons</span>
          <span className="font-medium tabular-nums">
            {progress.total > 0 ? `${progress.done}/${progress.total} · ${progress.percent}%` : "None yet"}
          </span>
        </div>
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div className="bg-brand-terracotta h-full" style={{ width: `${progress.percent}%` }} />
        </div>
      </div>
      <p className="text-muted-foreground truncate text-xs">
        {latestMark ? (
          <>
            Latest mark <span className="text-foreground font-medium tabular-nums">{latestMark.percent}%</span> in {latestMark.title}
          </>
        ) : (
          "No marks released yet"
        )}
        {dueSoon > 0 ? ` · ${dueSoon} due soon` : ""}
      </p>
    </div>
  );
}
