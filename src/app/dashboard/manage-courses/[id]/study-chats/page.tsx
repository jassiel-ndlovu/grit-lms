/**
 * /dashboard/manage-courses/[id]/study-chats — the course's study assistant
 * chats, flagged first (viewer.md "Study assistant"). For anyone on staff
 * who may see the course (`content.view`); A's query checks it.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Power, UserRoundCog } from "lucide-react";

import { PageTitle } from "@/components/shell/page-frame";
import { Button } from "@/components/ui/button";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { isBillingEnabled } from "@/features/billing/errors";
import { courseRoutes } from "@/features/courses/components/course-frame";
import { editsCourse, StudyChatsFrame } from "@/features/courses/components/study/staff-frame";
import { StudyChatList } from "@/features/courses/components/study/tutor-views";
import { hasStudyAssistant, orNotFound, studyCourse } from "@/features/courses/study";
import { studyRoutes } from "@/features/courses/lib/study-ui";
import { courseStudyChats } from "@/features/study/study";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { canIn, getViewer } from "@/lib/viewer";

export const metadata = { title: "Study chats" };

const LIMIT = 300;

export default async function StudyChatsPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  const { id } = await params;
  const course = await studyCourse(id);
  if (!course) notFound();
  const rows = await orNotFound(() => courseStudyChats(viewer, { courseId: id, limit: LIMIT }));
  // The tab is hidden without the service; earlier chats stay readable.
  const on = await hasStudyAssistant(id);
  if (rows.length === 0 && !on) notFound();
  const [prefs, editor, services] = await Promise.all([
    getUserPreferences(viewer.user.id),
    editsCourse(viewer, id),
    canIn(viewer, "courses.services", { courseId: id }),
  ]);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  const flagged = rows.filter((r) => r.flaggedAt).length;

  return (
    <StudyChatsFrame course={course} editor={editor}>
      <PageTitle
        title="Study chats"
        actions={
          editor && isBillingEnabled() ? (
            <>
              {on ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={studyRoutes.students(id)}>
                    <UserRoundCog aria-hidden className="size-4" />
                    Students
                  </Link>
                </Button>
              ) : null}
              {services ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={courseRoutes.services(id)}>
                    <Power aria-hidden className="size-4" />
                    Turn on or off
                  </Link>
                </Button>
              ) : null}
            </>
          ) : undefined
        }
        description={`What students ask the study assistant. They're told that you and their parents can read these, and chats are kept for a year.${
          flagged ? ` ${flagged} ${flagged === 1 ? "chat needs" : "chats need"} a look.` : ""
        }`}
      />
      {rows.length === 0 ? (
        <EmptyState
          compact
          illustration={<Scene name="inbox-empty" />}
          title="No chats yet"
          description="When a student asks the assistant about this course, the chat shows here."
        />
      ) : (
        <StudyChatList courseId={course.id} rows={rows} ctx={ctx} />
      )}
      {rows.length === LIMIT ? (
        <p className="text-muted-foreground text-xs">The {LIMIT} newest chats show here.</p>
      ) : null}
    </StudyChatsFrame>
  );
}
