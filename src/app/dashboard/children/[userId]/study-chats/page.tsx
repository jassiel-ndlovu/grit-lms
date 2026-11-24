/**
 * /dashboard/children/[userId]/study-chats — a child's chats with the study
 * assistant, for their parent to read (owner, 24 Nov). Read-only; the flags
 * tutors see aren't shown here.
 */

import { redirect } from "next/navigation";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { TonePanel } from "@/components/ui/nexus";
import { childRoutes } from "@/features/activity/lib/child-overview";
import { FamilyChatList } from "@/features/courses/components/study/tutor-views";
import { childAssistantOff, childForStudy, childStudyChats } from "@/features/courses/study";
import { nameList } from "@/features/courses/lib/study-ui";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Study chats" };

export default async function ChildStudyChatsPage({ params }: { params: Promise<{ userId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  const { userId } = await params;
  const child = await childForStudy(viewer, userId);
  const [rows, off, prefs] = await Promise.all([
    childStudyChats(viewer, userId),
    childAssistantOff(viewer, userId),
    getUserPreferences(viewer.user.id),
  ]);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  const first = child.name.split(" ")[0];

  return (
    <PageFrame
      type="record"
      breadcrumb={[{ label: "Your learners", href: childRoutes.home }, { label: child.name, href: childRoutes.child(userId) }, { label: "Study chats" }]}
    >
      <PageTitle title="Study chats" description={`What ${first} asks the study assistant. ${first} is told that you can read these, and chats are kept for a year.`} />
      {off.length ? (
        <TonePanel role="note" className="p-4 text-sm">
          A tutor switched the study assistant off for {first} in {nameList(off)}.
        </TonePanel>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState
          compact
          illustration={<Scene name="inbox-empty" />}
          title="No chats yet"
          description={`When ${first} asks the study assistant something, the chat shows here.`}
        />
      ) : (
        <FamilyChatList childUserId={userId} rows={rows} ctx={ctx} />
      )}
    </PageFrame>
  );
}
