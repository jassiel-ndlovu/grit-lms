/**
 * /dashboard/courses/[id]/study-chats/[chatId] — where A's study chat
 * notifications link (viewer.md "Study assistant"). The chat itself is on
 * the tutor's course pages, which check who may read it.
 */

import { redirect } from "next/navigation";

import { studyRoutes } from "@/features/courses/lib/study-ui";

export default async function StudyChatLinkPage({ params }: { params: Promise<{ id: string; chatId: string }> }) {
  const { id, chatId } = await params;
  redirect(studyRoutes.chats(id, chatId));
}
