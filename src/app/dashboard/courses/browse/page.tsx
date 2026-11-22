/**
 * /dashboard/courses/browse — Find courses (#206; viewer.md Draft 1.12).
 * Listed courses from every open workspace, searchable by course, school or
 * tutor (`?q=`), 24 a page (`?cursor=`). A student asks to join for
 * themself, a parent for a linked child; staff approve in
 * /dashboard/join-requests. Their own requests show below, with Cancel
 * while they wait. Anyone signed in may look; only students and parents
 * get the button (A refuses the rest anyway).
 *
 * A's emails link here. New screen, so it uses the page frame (#205).
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListedCourseGrid, MyRequestsList, NoListedCourses } from "@/features/courses/components/join-views";
import { askTargets, joinRoutes } from "@/features/courses/lib/join-ui";
import { getUserPreferences } from "@/features/users/preferences";
import { listListedCourses, listMyJoinRequests } from "@/features/workspaces/join-requests";
import { auth } from "@/lib/auth";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Find courses" };

interface PageProps {
  searchParams: Promise<{ q?: string; cursor?: string }>;
}

export default async function BrowseCoursesPage({ searchParams }: PageProps) {
  const [session, viewer, sp] = await Promise.all([auth(), getViewer(), searchParams]);
  if (!session?.user || !viewer) redirect("/auth");

  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const cursor = typeof sp.cursor === "string" && sp.cursor.length <= 64 ? sp.cursor : undefined;
  const [{ courses, nextCursor }, mine, prefs] = await Promise.all([
    listListedCourses({ q: q || undefined, cursor, take: 24 }),
    listMyJoinRequests(viewer.user.id),
    getUserPreferences(viewer.user.id),
  ]);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  const targets = askTargets(
    { userId: viewer.user.id, name: viewer.user.name, isStudent: session.user.role === "STUDENT" },
    viewer.children,
  );
  const more = nextCursor ? `${joinRoutes.browse}?${new URLSearchParams({ ...(q ? { q } : {}), cursor: nextCursor })}` : null;

  return (
    <PageFrame type="list" breadcrumb={[{ label: "Courses", href: "/dashboard/courses" }, { label: "Find courses" }]}>
      <PageTitle
        icon={<Search />}
        title="Find courses"
        description={
          targets.length > 0
            ? `Courses tutors have opened to new students. Ask to join${viewer.children.length > 0 ? " for yourself or your child" : ""}; the tutor decides.`
            : "Courses tutors have opened to new students. Students and parents can ask to join."
        }
      />

      <form action={joinRoutes.browse} role="search" className="flex max-w-xl gap-2">
        <label htmlFor="course-search" className="sr-only">
          Search courses
        </label>
        <Input id="course-search" name="q" defaultValue={q} placeholder="Course, school or tutor" maxLength={80} />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <PageSection id="listed" title={q ? `Results for “${q}”` : undefined}>
        {courses.length === 0 ? <NoListedCourses searched={q.length > 0} /> : <ListedCourseGrid courses={courses} targets={targets} mine={mine} />}
        {more ? (
          <div>
            <Button asChild variant="outline">
              <Link href={more}>More courses</Link>
            </Button>
          </div>
        ) : null}
      </PageSection>

      {mine.length > 0 ? (
        <PageSection id="mine" title="Your requests" description="You hear back by email too.">
          <MyRequestsList rows={mine} ctx={ctx} meId={viewer.user.id} />
        </PageSection>
      ) : null}
    </PageFrame>
  );
}
