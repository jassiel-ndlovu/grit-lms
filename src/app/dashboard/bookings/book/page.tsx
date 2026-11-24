/**
 * /dashboard/bookings/book — pick a free time (viewer.md Draft 1.21, Plus).
 * `?course=&student=&week=YYYY-MM-DD&tutor=`. Students book for themselves,
 * parents for a child, staff for a student on a course they can see.
 * Times are in the viewer's zone.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarPlus } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { ReadOnlyNote } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { availableSlots, type SlotsResult } from "@/features/booking/bookings";
import { booksAsFamily, booksAsStaff, familyCourses, familyCredits, familyLearners, packsForSale, staffCourses, type LearnerCredits } from "@/features/events/bookings";
import { FamilyCredits } from "@/features/events/components/booking/credits";
import { LinkSelect, WeekStepper } from "@/features/events/components/booking/pickers";
import { SlotPicker, type SlotDay } from "@/features/events/components/booking/slot-picker";
import { bookingRoutes, byDay, firstFreeDay, lastBookableDay, lessonsLeft } from "@/features/events/lib/booking-ui";
import { addDays, dayKeyOf, dayLabel, parseDayKey, wallToInstant } from "@/features/events/lib/calendar-ui";
import { getUserPreferences } from "@/features/users/preferences";
import { DEFAULT_TIME_ZONE, resolveLocale } from "@/lib/datetime";
import { UserError } from "@/lib/user-error";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Book a lesson" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);
const SHORT = { day: "numeric", month: "short" } as const;
const LONG = { weekday: "long", day: "numeric", month: "long" } as const;

export default async function BookPage({ searchParams }: PageProps) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  const staff = booksAsStaff(viewer);
  if (!staff && !booksAsFamily(viewer)) notFound();
  const guardian = viewer.persona === "guardian";

  const sp = await searchParams;
  const prefs = await getUserPreferences(viewer.user.id);
  const ctx = { timeZone: prefs.timeZone ?? DEFAULT_TIME_ZONE, locale: resolveLocale(prefs.preferredLanguage) };
  const now = new Date();
  const today = dayKeyOf(now, ctx.timeZone);

  const learners = staff ? [] : await familyLearners(viewer);
  const forStaff = staff ? await staffCourses(viewer) : null;
  const courses = forStaff ? forStaff.courses : await familyCourses(viewer, learners);
  const wantedCourse = one(sp.course);
  const wantedStudent = one(sp.student);
  // A link with only a student opens a course of theirs.
  const course = wantedCourse
    ? (courses.find((c) => c.courseId === wantedCourse) ?? null)
    : (courses.find((c) => c.students.some((s) => s.learnerId === wantedStudent)) ?? courses[0] ?? null);
  const student = course ? (course.students.find((s) => s.learnerId === wantedStudent) ?? (staff && course.students.length > 1 ? null : (course.students[0] ?? null))) : null;

  const name = staff ? "Book for a student" : "Book a lesson";
  const breadcrumb = [{ label: "Bookings", href: bookingRoutes.home }, { label: name }];

  if (!course) {
    const gone = wantedCourse !== null && courses.length > 0;
    const plan = forStaff?.needPlan ?? false;
    return (
      <PageFrame type="list" breadcrumb={breadcrumb}>
        <PageTitle icon={<CalendarPlus />} title={name} />
        <Card className="p-0">
          <EmptyState
            compact
            illustration={<Scene name="calendar-empty" />}
            title={gone ? "That course can't be booked" : "Nothing to book yet"}
            description={
              gone
                ? "It has no open times, or you can't see it."
                : plan
                  ? "Session booking is part of the Plus plan."
                  : staff
                    ? "Set your hours first. Families can then book them."
                    : "When a tutor opens times for booking, you can book them here."
            }
            action={
              gone ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={bookingRoutes.book()}>See other courses</Link>
                </Button>
              ) : plan ? (
                can(viewer, "billing.view") ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/settings/billing">See plans</Link>
                  </Button>
                ) : undefined
              ) : staff ? (
                <Button asChild size="sm">
                  <Link href={bookingRoutes.hours()}>Set hours</Link>
                </Button>
              ) : undefined
            }
          />
        </Card>
      </PageFrame>
    );
  }

  const asked = parseDayKey(one(sp.week), today);
  const week = asked < today ? today : asked;
  const weekEnd = addDays(week, 7);

  // A month at a time, so "next free day" can look past the week on screen.
  let slots: SlotsResult | null = null;
  let problem: string | null = null;
  if (student) {
    try {
      const from = wallToInstant(week, "00:00", ctx.timeZone);
      const to = wallToInstant(addDays(week, 31), "00:00", ctx.timeZone);
      slots = await availableSlots(viewer, { courseId: course.courseId, learnerId: student.learnerId, from, to }, now);
    } catch (e) {
      if (!(e instanceof UserError)) throw e;
      problem = e.message;
    }
  }

  const tutors = slots?.tutors ?? [];
  const tutor = tutors.find((t) => t.membershipId === one(sp.tutor)) ?? null;
  const shown = tutor ? [tutor] : tutors;
  const at = (w: string | null, tutorId: string | null | undefined = tutor?.membershipId, learnerId = student?.learnerId) =>
    bookingRoutes.book({ course: course.courseId, student: learnerId, week: w === null || w <= today ? null : w, tutor: tutorId });

  const all = shown.flatMap((t) => t.slots.map((s) => ({ membershipId: t.membershipId, tutor: t.name, start: s.start, end: s.end })));
  const time = new Intl.DateTimeFormat(ctx.locale, { hour: "2-digit", minute: "2-digit", timeZone: ctx.timeZone });
  const inWeek = all.filter((s) => dayKeyOf(s.start, ctx.timeZone) < weekEnd);
  const days: SlotDay[] = byDay(inWeek, (s) => s.start, ctx.timeZone).map((d) => ({
    day: d.day,
    label: dayLabel(d.day, ctx.locale, LONG),
    slots: d.items.map((s) => ({
      membershipId: s.membershipId, tutor: s.tutor, start: s.start.toISOString(), time: time.format(s.start), range: `${time.format(s.start)}–${time.format(s.end)}`,
    })),
  }));
  const last = slots ? lastBookableDay(today, slots.policy.horizonDays) : today;
  const nextFree = firstFreeDay(all, weekEnd, ctx.timeZone);

  const out = slots !== null && slots.credits.needed && slots.credits.balance < 1;
  let packs: LearnerCredits[] = [];
  if (out && !staff && student) {
    packs = (await familyCredits(learners.filter((l) => l.learnerId === student.learnerId)))
      .map((l) => ({ ...l, courses: l.courses.filter((c) => c.courseId === course.courseId) }))
      .filter((l) => l.courses.length > 0);
  }

  return (
    <PageFrame
      type="list"
      breadcrumb={breadcrumb}
      secondary={
        slots ? (
          <WeekStepper
            label=""
            previous={week > today ? at(addDays(week, -7)) : null}
            today={at(null)}
            next={weekEnd <= last ? at(weekEnd) : null}
            isToday={week === today}
          />
        ) : undefined
      }
    >
      <PageTitle
        icon={<CalendarPlus />}
        title={name}
        description={
          slots && student
            ? [
                `${course.courseName}${guardian ? ` for ${student.name}` : ""}${tutors.length === 1 ? ` with ${tutors[0].name}` : ""}.`,
                slots.credits.needed ? `${lessonsLeft(Math.max(0, slots.credits.balance))} on the pack.` : null,
                ctx.timeZone === slots.timeZone ? null : `Times are in ${ctx.timeZone.replace(/_/g, " ")} time.`,
              ]
                .filter(Boolean)
                .join(" ")
            : course.courseName
        }
      />
      <ReadOnlyNote billingHref={can(viewer, "billing.view") ? "/dashboard/settings/billing" : null} />

      <div className="flex flex-wrap gap-3 empty:hidden">
        {courses.length > 1 ? (
          <LinkSelect
            label="Course"
            value={course.courseId}
            options={courses.map((c) => ({
              value: c.courseId,
              label: c.courseName,
              href: bookingRoutes.book({ course: c.courseId, student: c.students.some((s) => s.learnerId === student?.learnerId) ? student?.learnerId : null }),
            }))}
          />
        ) : null}
        {staff ? (
          course.students.length > 0 ? (
            <LinkSelect
              label="Student"
              value={student?.learnerId ?? null}
              placeholder="Choose a student"
              options={course.students.map((s) => ({ value: s.learnerId, label: s.name, href: at(week, tutor?.membershipId, s.learnerId) }))}
            />
          ) : null
        ) : course.students.length > 1 ? (
          <LinkSelect label="For" value={student?.learnerId ?? null} options={course.students.map((s) => ({ value: s.learnerId, label: s.name, href: at(week, tutor?.membershipId, s.learnerId) }))} />
        ) : null}
        {tutors.length > 1 ? (
          <LinkSelect
            label="Tutor"
            value={tutor?.membershipId ?? "any"}
            options={[{ value: "any", label: "Any tutor", href: at(week, null) }, ...tutors.map((t) => ({ value: t.membershipId, label: t.name, href: at(week, t.membershipId) }))]}
          />
        ) : null}
      </div>

      {problem ? (
        <p role="alert" className="border-border text-foreground rounded-lg border px-4 py-3 text-sm">
          {problem}
        </p>
      ) : !student ? (
        <p className="text-muted-foreground text-sm">{course.students.length === 0 ? "Nobody is on this course yet." : "Choose a student to see free times."}</p>
      ) : slots ? (
        <>
          {out ? (
            <PageSection
              id="packs"
              title="No lessons left"
              description={staff ? "They need a lesson pack first. You can add lessons on the student's page." : "You need a lesson pack before you can book."}
            >
              {packs.length > 0 ? <FamilyCredits lists={packs} withName={guardian} forSale={packsForSale()} /> : null}
            </PageSection>
          ) : null}
          <PageSection id="times" title={`${dayLabel(week, ctx.locale, SHORT)} – ${dayLabel(addDays(week, 6), ctx.locale, SHORT)}`}>
            {days.length === 0 ? (
              <Card className="p-0">
                <EmptyState
                  compact
                  illustration={<Scene name="calendar-empty" />}
                  title="No free times this week"
                  description={
                    nextFree
                      ? `The next free day is ${dayLabel(nextFree, ctx.locale, LONG)}.`
                      : week === today
                        ? "Nothing is free in the next month. Try again later."
                        : "Nothing is free after this either. Try an earlier week."
                  }
                  action={
                    nextFree ? (
                      <Button asChild size="sm">
                        <Link href={at(nextFree)} scroll={false}>
                          Go to that day
                        </Link>
                      </Button>
                    ) : undefined
                  }
                />
              </Card>
            ) : (
              <SlotPicker
                courseId={course.courseId}
                courseName={course.courseName}
                learnerId={student.learnerId}
                studentName={staff || guardian ? student.name : null}
                days={days}
                manyTutors={shown.length > 1}
                credits={slots.credits}
                cancelHours={slots.policy.cancelHours}
                staff={staff}
              />
            )}
          </PageSection>
        </>
      ) : null}
    </PageFrame>
  );
}
