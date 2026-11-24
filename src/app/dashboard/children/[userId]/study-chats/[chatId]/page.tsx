/** /dashboard/children/[userId]/study-chats/[chatId] — one of a child's study chats, read by their parent. */

import { notFound, redirect } from "next/navigation";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { childRoutes } from "@/features/activity/lib/child-overview";
import { StudyTranscript } from "@/features/courses/components/study/tutor-views";
import { messageView, studyRoutes } from "@/features/courses/lib/study-ui";
import { childForStudy, orNotFound, studyCourse } from "@/features/courses/study";
import { getStudyChat } from "@/features/study/study";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, formatDate, resolveLocale } from "@/lib/datetime";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Study chat" };

export default async function ChildStudyChatPage({ params }: { params: Promise<{ userId: string; chatId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  const { userId, chatId } = await params;
  const child = await childForStudy(viewer, userId);
  const chat = await orNotFound(() => getStudyChat(viewer, { chatId }));
  if (chat.studentUserId !== userId) notFound();
  const [prefs, course] = await Promise.all([getUserPreferences(viewer.user.id), studyCourse(chat.courseId)]);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };

  return (
    <PageFrame
      type="record"
      breadcrumb={[
        { label: child.name, href: childRoutes.child(userId) },
        { label: "Study chats", href: studyRoutes.childChats(userId) },
        { label: "Chat" },
      ]}
    >
      <PageTitle eyebrow={`${course?.name ?? "Study chat"}, started ${formatDate(chat.createdAt, ctx)}`} title={chat.title} />
      {/* The lessons are the student's pages, so the citations aren't links here. */}
      <StudyTranscript messages={chat.messages.map(messageView)} studentName={child.name} lessonHref={null} />
    </PageFrame>
  );
}
