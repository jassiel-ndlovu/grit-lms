/**
 * /dashboard/bookings — booked lessons (viewer.md Draft 1.21, Plus).
 *
 * Students and parents: upcoming or past (`?view=past`), with the lessons
 * left on their packs. Staff: one week (`?week=YYYY-MM-DD`) of their own
 * bookings, one course's (`?course=`) or, with `cover.manage`, another
 * tutor's (`?tutor=`). A's emails and notices link here.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarCheck, CalendarPlus } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { RibbonNav } from "@/components/shell/ribbon";
import { ReadOnlyNote } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { listBookings } from "@/features/booking/bookings";
import { booksAsFamily, booksAsStaff, familyBookings, familyCourses, familyCredits, familyLearners, packsForSale, staffFilters } from "@/features/events/bookings";
import { FamilyCredits } from "@/features/events/components/booking/credits";
import { LinkSelect, WeekStepper } from "@/features/events/components/booking/pickers";
import { BookingDays } from "@/features/events/components/booking/views";
import { bookingRoutes, parseBookingView } from "@/features/events/lib/booking-ui";
import { addDays, dayKeyOf, parseDayKey, rangeLabel, startOfWeek, wallToInstant } from "@/features/events/lib/calendar-ui";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { can, getViewer, type Viewer } from "@/lib/viewer";

export const metadata = { title: "Bookings" };

type Params = Record<string, string | string[] | undefined>;
interface PageProps {
  searchParams: Promise<Params>;
}

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);

export default async function BookingsPage({ searchParams }: PageProps) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  const sp = await searchParams;
  const prefs = await getUserPreferences(viewer.user.id);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  if (booksAsFamily(viewer)) return <FamilyPage viewer={viewer} sp={sp} ctx={ctx} />;
  if (booksAsStaff(viewer)) return <StaffPage viewer={viewer} sp={sp} ctx={ctx} />;
  notFound();
}

type Ctx = { timeZone: string; locale: string };

async function FamilyPage({ viewer, sp, ctx }: { viewer: Viewer; sp: Params; ctx: Ctx }) {
  const view = parseBookingView(sp.view);
  const now = new Date();
  const learners = await familyLearners(viewer);
  const [rows, courses, credits] = await Promise.all([familyBookings(viewer, view, now), familyCourses(viewer, learners), familyCredits(learners)]);
  const guardian = viewer.persona === "guardian";
  const open = courses.length > 0;
  const book = open ? (
    <Button asChild size="sm">
      <Link href={bookingRoutes.book()}>
        <CalendarPlus aria-hidden className="size-4" />
        Book a lesson
      </Link>
    </Button>
  ) : null;

  return (
    <PageFrame
      type="list"
      breadcrumb={[{ label: "Bookings" }]}
      actions={book}
      secondary={
        <RibbonNav
          label="Bookings"
          links={[
            { label: "Upcoming", href: bookingRoutes.list("upcoming") },
            { label: "Past and cancelled", href: bookingRoutes.list("past") },
          ]}
          current={bookingRoutes.list(view)}
        />
      }
    >
      <PageTitle icon={<CalendarCheck />} title="Bookings" description={guardian ? "Extra lessons booked for your children." : "Extra lessons you've booked with your tutors."} />
      <PageSection id="lessons">
        {rows.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              compact
              illustration={<Scene name="calendar-empty" />}
              title={view === "past" ? "No past or cancelled lessons" : "No lessons booked"}
              description={
                view === "past"
                  ? "Lessons from the last 90 days show here."
                  : open
                    ? "Pick a time that suits you."
                    : "When a tutor opens times for booking, you can book them here."
              }
              action={view === "upcoming" ? book : undefined}
            />
          </Card>
        ) : (
          <BookingDays rows={rows} ctx={ctx} now={now} staff={false} showStudent={guardian} showTutor newestFirst={view === "past"} />
        )}
      </PageSection>
      {view === "upcoming" && credits.length > 0 ? (
        <PageSection id="packs" title="Lesson packs">
          <FamilyCredits lists={credits} withName={guardian} forSale={packsForSale()} />
        </PageSection>
      ) : null}
    </PageFrame>
  );
}

async function StaffPage({ viewer, sp, ctx }: { viewer: Viewer; sp: Params; ctx: Ctx }) {
  const now = new Date();
  const thisWeek = startOfWeek(dayKeyOf(now, ctx.timeZone));
  const week = startOfWeek(parseDayKey(one(sp.week), thisWeek));
  const weekParam = week === thisWeek ? null : week;
  const { courses, tutors } = await staffFilters(viewer);
  // Ids that aren't in their lists are ignored.
  const others = tutors.filter((t) => t.id !== viewer.membership?.id);
  const course = courses.find((c) => c.id === one(sp.course)) ?? null;
  const tutor = course ? null : (others.find((t) => t.id === one(sp.tutor)) ?? null);
  const rows = await listBookings(
    viewer,
    { from: wallToInstant(week, "00:00", ctx.timeZone), to: wallToInstant(addDays(week, 7), "00:00", ctx.timeZone), courseId: course?.id, membershipId: tutor?.id },
    now,
  );
  const at = (w: string | null) => bookingRoutes.week({ week: w === thisWeek ? null : w, course: course?.id, tutor: tutor?.id });
  const label = rangeLabel("week", week, ctx.locale);
  const book = (
    <Button asChild size="sm">
      <Link href={bookingRoutes.book({ course: course?.id })}>
        <CalendarPlus aria-hidden className="size-4" />
        Book for a student
      </Link>
    </Button>
  );

  return (
    <PageFrame
      type="list"
      breadcrumb={[{ label: "Bookings" }]}
      actions={book}
      secondary={
        <>
          <RibbonNav
            label="Bookings"
            links={[
              { label: "Lessons", href: bookingRoutes.home },
              { label: "Hours", href: bookingRoutes.hours(tutor?.id) },
            ]}
            current={bookingRoutes.home}
            className="flex-initial"
          />
          <WeekStepper label={label} previous={at(addDays(week, -7))} today={at(null)} next={at(addDays(week, 7))} isToday={weekParam === null} todayLabel="This week" />
        </>
      }
    >
      <PageTitle
        icon={<CalendarCheck />}
        title="Bookings"
        description={`${label}. ${course ? `${course.name}.` : tutor ? `${tutor.name}'s lessons.` : "Lessons booked with you."}`}
      />
      <ReadOnlyNote billingHref={can(viewer, "billing.view") ? "/dashboard/settings/billing" : null} />
      {courses.length > 0 || others.length > 0 ? (
        <LinkSelect
          label="Show"
          value={course ? `c:${course.id}` : tutor ? `t:${tutor.id}` : "mine"}
          options={[
            { value: "mine", label: "My lessons", href: bookingRoutes.week({ week: weekParam }) },
            ...others.map((t) => ({ value: `t:${t.id}`, label: t.name, href: bookingRoutes.week({ week: weekParam, tutor: t.id }) })),
            ...courses.map((c) => ({ value: `c:${c.id}`, label: `Course: ${c.name}`, href: bookingRoutes.week({ week: weekParam, course: c.id }) })),
          ]}
        />
      ) : null}
      <PageSection id="lessons">
        {rows.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              compact
              illustration={<Scene name="calendar-empty" />}
              title="No lessons booked this week"
              description="Families book from the hours you set. You can also book for a student."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href={bookingRoutes.hours(tutor?.id)}>Set hours</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <BookingDays rows={rows} ctx={ctx} now={now} staff showStudent showTutor={course !== null} />
        )}
      </PageSection>
    </PageFrame>
  );
}
