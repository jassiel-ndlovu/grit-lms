/**
 * /dashboard/tutor-tests - tutor's listing of their tests across courses.
 *
 * Server Component. Replaces the legacy heavy-client list. The full
 * tutor-side authoring/grading UI lives in a future chapter; this surface
 * gives tutors a per-test entry point to the manage course view.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Target } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { listTestsByTutorId } from "@/features/assessments/queries";

export const metadata = { title: "Tests & Grading" };

const dateFmt = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function TutorTestsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "TUTOR") redirect("/dashboard");

  const tutor = await prisma.tutor.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!tutor) {
    return (
      <div className="text-muted-foreground p-8 text-sm">
        No tutor profile found for this account.
      </div>
    );
  }

  const tests = await listTestsByTutorId(tutor.id);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <header>
        <h1 className="font-display text-3xl leading-tight tracking-tight text-foreground">
          Tests &amp; grading
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Every test you have authored, newest due-date first. Authoring and
          per-student grading are migrating to the new feature module - for
          now this page links into the manage-course view.
        </p>
      </header>

      {tests.length === 0 ? (
        <Card className="flex min-h-70 flex-col items-center justify-center gap-4 p-12 text-center">
          <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-14 items-center justify-center rounded-full">
            <Target className="size-6" />
          </div>
          <div>
            <h3 className="font-display text-xl leading-tight text-foreground">
              No tests yet
            </h3>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">
              Tests you create from a course&apos;s manage page will show up here.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tests.map((t) => (
            <Card key={t.id} className="group flex flex-col gap-3 p-5 transition-shadow hover:shadow-md">
              <Link href={`/dashboard/manage-courses/${t.courseId}`} className="flex flex-1 flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-muted-foreground text-xs">{t.course.name}</p>
                    <h3 className="font-display line-clamp-2 text-lg leading-tight tracking-tight text-foreground">
                      {t.title}
                    </h3>
                  </div>
                  <Badge variant={t.isActive ? "soft" : "secondary"} className="shrink-0">
                    {t.isActive ? "Published" : "Draft"}
                  </Badge>
                </div>
                {t.description && (
                  <p className="text-muted-foreground line-clamp-2 text-sm">{t.description}</p>
                )}
                <div className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span>Due {dateFmt.format(t.dueDate)}</span>
                  <span>{t._count.questions} questions</span>
                  <span>{t._count.submissions} submissions</span>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
