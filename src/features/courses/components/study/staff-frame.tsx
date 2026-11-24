/**
 * The frame of a course's study chats. Staff who edit the course get its
 * tabs; staff who may only see it (`content.view`) get the page alone.
 * Nexa admins too: the course's other pages aren't theirs.
 */

import { PageFrame } from "@/components/shell/page-frame";
import { canIn, type Viewer } from "@/lib/viewer";

import { studyRoutes } from "../../lib/study-ui";
import { CourseFrame } from "../course-frame";

/** Whether the course's own pages open for this viewer. */
export async function editsCourse(viewer: Viewer, courseId: string): Promise<boolean> {
  return viewer.persona === "staff" && (await canIn(viewer, "courses.edit", { courseId }));
}

export function StudyChatsFrame({
  course,
  chat,
  editor,
  children,
}: {
  course: { id: string; name: string };
  /** The last crumb, on one chat. */
  chat?: string;
  editor: boolean;
  children: React.ReactNode;
}) {
  const list = studyRoutes.chats(course.id);
  if (editor) {
    return (
      <CourseFrame
        course={course}
        page={chat ?? "Study chats"}
        parent={chat ? { label: "Study chats", href: list } : undefined}
        current={list}
      >
        {children}
      </CourseFrame>
    );
  }
  return (
    <PageFrame
      type="record"
      breadcrumb={
        chat
          ? [{ label: course.name }, { label: "Study chats", href: list }, { label: chat }]
          : [{ label: course.name }, { label: "Study chats" }]
      }
    >
      {children}
    </PageFrame>
  );
}
