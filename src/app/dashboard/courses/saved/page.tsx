/**
 * /dashboard/courses/saved — the lessons a student saved on this device
 * (viewer.md Draft 1.18). The list lives in the browser.
 */

import { redirect } from "next/navigation";
import { CloudDownload } from "lucide-react";

import { SavedLessons } from "@/components/offline/saved-lessons";
import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { Scene } from "@/components/ui/empty-state";
import { studentCourseRoutes } from "@/features/courses/components/student-course-frame";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Saved lessons" };

export default async function SavedLessonsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  if (!viewer.learner) redirect("/dashboard");
  const prefs = await getUserPreferences(viewer.user.id);
  return (
    <PageFrame type="settings" breadcrumb={[{ label: "My courses", href: studentCourseRoutes.list }, { label: "Saved lessons" }]}>
      <PageTitle icon={<CloudDownload />} title="Saved lessons" description="These open on this device without a connection. Videos and some images still need one." />
      <SavedLessons
        ctx={{ timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) }}
        illustration={<Scene name="empty-lessons" />}
      />
    </PageFrame>
  );
}
