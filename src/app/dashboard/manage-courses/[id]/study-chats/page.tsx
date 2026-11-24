/**
 * /dashboard/manage-courses/[id]/study-chats — the course's study assistant
 * chats, flagged first (viewer.md "Study assistant"). For anyone on staff
 * who may see the course (`content.view`); A's query checks it.
 */

import { notFound, redirect } from "next/navigation";

import { PageTitle } from "@/components/shell/page-frame";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { editsCourse, StudyChatsFrame } from "@/features/courses/components/study/staff-frame";
import { StudyChatList } from "@/features/courses/components/study/tutor-views";
import { hasStudyAssistant, orNotFound, studyCourse } from "@/features/courses/study";
import { courseStudyChats } from "@/features/study/study";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { getViewer } from "@/lib/viewer";

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
  if (rows.length === 0 && !(await hasStudyAssistant(id))) notFound();
  const [prefs, editor] = await Promise.all([getUserPreferences(viewer.user.id), editsCourse(viewer, id)]);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  const flagged = rows.filter((r) => r.flaggedAt).length;

  return (
    <StudyChatsFrame course={course} editor={editor}>
      <PageTitle
        title="Study chats"
        description={`What students ask the study assistant. They're told that you can read these, and chats are kept for a year.${
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
