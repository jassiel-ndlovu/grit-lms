/**
 * /dashboard/courses/[id]/assistant — a student's study assistant on a
 * course (viewer.md "Study assistant", Pro). `?chat=` opens one of their
 * chats; without it a new one starts. Students only: a parent buys the
 * credits (/dashboard/credits), and tutors read the chats on their own page.
 */

import { notFound, redirect } from "next/navigation";

import { AssistantTop } from "@/features/courses/components/study/assistant-scene";
import { StudyChat } from "@/features/courses/components/study/chat";
import { StudentCourseFrame } from "@/features/courses/components/student-course-frame";
import { messageView, reasonOf, studyRoutes } from "@/features/courses/lib/study-ui";
import { orNotFound, studyCourse } from "@/features/courses/study";
import { getStudyChat, myStudyChats, studyStatus } from "@/features/study/study";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Study assistant" };
/** Answers come from a model, and can take a while. */
export const maxDuration = 60;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chat?: string | string[] }>;
}

export default async function StudyAssistantPage({ params, searchParams }: PageProps) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  const { id: courseId } = await params;
  if (viewer.persona !== "learner") notFound();
  const wanted = (await searchParams).chat;
  const course = await studyCourse(courseId);
  if (!course) notFound();

  const [status, chats] = await orNotFound(() =>
    Promise.all([studyStatus(viewer, { courseId }), myStudyChats(viewer, { courseId })]),
  );
  // The tab is hidden without the service, so the page only stays for earlier chats.
  if (status.reason === "NOT_ON_PLAN" && chats.length === 0) notFound();
  const mine = chats.find((c) => c.id === wanted) ?? null;
  if (wanted && !mine) redirect(studyRoutes.assistant(courseId));
  const chat = mine ? await orNotFound(() => getStudyChat(viewer, { chatId: mine.id })) : null;

  const here = course.workspaceId === viewer.workspace?.id;
  const buy = !here
    ? { note: `Switch to ${course.workspace?.name ?? "this course's organisation"} to buy them.` }
    : viewer.learner?.paymentVisible
      ? { href: studyRoutes.credits }
      : { note: "Ask your parent to buy them. They can do it from their own Nexa account." };

  return (
    <StudentCourseFrame course={course} page="Assistant" type="editor">
      <StudyChat
        courseId={courseId}
        chatId={chat?.id ?? null}
        messages={chat?.messages.map(messageView) ?? []}
        status={{ reason: reasonOf(status.reason), credits: status.credits, perDay: status.perDay, leftToday: status.leftToday }}
        buy={buy}
        creditsHref={here && status.reason !== "COMING_SOON" && status.reason !== "NOT_ON_PLAN" ? studyRoutes.credits : null}
        top={
          <AssistantTop
            chats={chats.map((c) => ({ id: c.id, title: c.title, href: studyRoutes.assistant(courseId, c.id) }))}
            current={mine?.id ?? null}
            newHref={studyRoutes.assistant(courseId)}
          />
        }
      />
    </StudentCourseFrame>
  );
}
