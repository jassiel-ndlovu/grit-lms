/**
 * ParentDashboard — landing page for PARENT users.
 *
 * Placeholder: parents can't be linked to students yet, so this explains
 * what's coming and points at the pages parents already have. Server
 * Component.
 */

import Link from "next/link";
import { Bell, CalendarDays, GraduationCap, MessageSquare, TrendingUp, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { APP_CONTACT } from "@/lib/branding";

const COMING_SOON = [
  { icon: TrendingUp, title: "Progress", body: "Lesson completion and marks for each of your learners." },
  { icon: CalendarDays, title: "Upcoming work", body: "Tests and assignments due in the next two weeks." },
  { icon: MessageSquare, title: "Tutor messages", body: "Questions and updates between you and your learners' tutors." },
];

export function ParentDashboard({ firstName }: { firstName: string }) {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <section className="border-b-2 border-brand-terracotta bg-primary text-primary-foreground overflow-hidden rounded-lg">
        <div className="p-8">
          <p className="text-primary-foreground/70 text-sm">Welcome, {firstName}.</p>
          <h1 className="font-display mt-1 text-4xl leading-tight tracking-tight">
            Follow your learners&apos; progress.
          </h1>
          <p className="text-primary-foreground/70 mt-3 max-w-xl text-sm">
            Marks, deadlines and course updates for the students you look after, in one place.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl leading-tight tracking-tight text-foreground">
          Your learners
        </h2>
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
            <a href={`mailto:${APP_CONTACT.email}?subject=Link%20my%20parent%20account`}>
              Contact the school
            </a>
          </Button>
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-4">
          <h2 className="font-display text-xl leading-tight tracking-tight text-foreground">
            Coming soon
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
          <h2 className="font-display text-xl leading-tight tracking-tight text-foreground">
            Shortcuts
          </h2>
          <Card className="divide-border divide-y p-0">
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
    </div>
  );
}
