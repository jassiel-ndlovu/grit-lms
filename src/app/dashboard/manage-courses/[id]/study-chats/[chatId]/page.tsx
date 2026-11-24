/**
 * /dashboard/manage-courses/[id]/study-chats/[chatId] — one study chat, read
 * by the course's staff. A wellbeing or safety flag shows first, with the
 * button to clear it once someone has followed up.
 */

import { notFound, redirect } from "next/navigation";

import { PageTitle } from "@/components/shell/page-frame";
import { courseRoutes } from "@/features/courses/components/course-frame";
import { editsCourse, StudyChatsFrame } from "@/features/courses/components/study/staff-frame";
import { StudentSwitchButton } from "@/features/courses/components/study/student-switches";
import { FlaggedNote, FORMER_STUDENT, StudyTranscript } from "@/features/courses/components/study/tutor-views";
import { messageView } from "@/features/courses/lib/study-ui";
import { hasStudyAssistant, orNotFound, studyCourse } from "@/features/courses/study";
import { studentSwitch } from "@/features/courses/study-switch";
import { getStudyChat } from "@/features/study/study";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, formatDate, resolveLocale } from "@/lib/datetime";
import { prisma } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Study chat" };

export default async function StudyChatPage({ params }: { params: Promise<{ id: string; chatId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  const { id, chatId } = await params;
  // A student's or parent's own chat is on their pages, not here.
  if (viewer.persona !== "staff" && viewer.persona !== "admin") notFound();
  const course = await studyCourse(id);
  if (!course) notFound();
  const chat = await orNotFound(() => getStudyChat(viewer, { chatId }));
  if (chat.courseId !== id) notFound();
  const [prefs, editor, student, on, assistant] = await Promise.all([
    getUserPreferences(viewer.user.id),
    editsCourse(viewer, id),
    prisma.user.findUnique({ where: { id: chat.studentUserId }, select: { name: true } }),
    studentSwitch(viewer, id, chat.studentUserId),
    hasStudyAssistant(id),
  ]);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  const name = student?.name || FORMER_STUDENT;

  return (
    <StudyChatsFrame course={course} chat={name} editor={editor}>
      <PageTitle
        eyebrow={`Study chat, started ${formatDate(chat.createdAt, ctx)}`} title={name}
        actions={
          assistant && on !== null ? (
            <StudentSwitchButton courseId={id} student={{ studentUserId: chat.studentUserId, name }} on={on} />
          ) : undefined
        }
      />
      {chat.flaggedAt ? <FlaggedNote chatId={chat.id} flaggedAt={chat.flaggedAt} ctx={ctx} /> : null}
      <StudyTranscript
        messages={chat.messages.map(messageView)}
        studentName={name}
        lessonHref={editor ? (l) => courseRoutes.lessons(id, l) : null}
      />
    </StudyChatsFrame>
  );
}
