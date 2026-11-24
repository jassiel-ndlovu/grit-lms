/**
 * /dashboard/bookings/hours — when a tutor can be booked: weekly hours,
 * time off, and (owners and admins) the workspace's booking rules.
 * `?tutor=<membershipId>` is another tutor's, with `cover.manage`.
 */

import { notFound, redirect } from "next/navigation";
import { Clock } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { RibbonNav } from "@/components/shell/ribbon";
import { ReadOnlyNote } from "@/components/shell/workspace-access";
import { getAvailability } from "@/features/booking/bookings";
import { booksAsStaff, managedTutors, taughtCourses } from "@/features/events/bookings";
import { HoursForm, PolicyForm, TimeOff } from "@/features/events/components/booking/hours-form";
import { LinkSelect } from "@/features/events/components/booking/pickers";
import { bookingRoutes, timeOffLabel } from "@/features/events/lib/booking-ui";
import { dayKeyOf } from "@/features/events/lib/calendar-ui";
import { getUserPreferences } from "@/features/users/preferences";
import { resolveLocale } from "@/lib/datetime";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Booking hours" };

interface PageProps {
  searchParams: Promise<{ tutor?: string | string[] }>;
}

export default async function BookingHoursPage({ searchParams }: PageProps) {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  if (!booksAsStaff(viewer) || !viewer.membership) notFound();
  const own = viewer.membership.id;

  const { tutor: raw } = await searchParams;
  const others = (await managedTutors(viewer)).filter((t) => t.id !== own);
  const other = others.find((t) => t.id === raw) ?? null;
  if (raw && raw !== own && !other) redirect(bookingRoutes.hours());
  const membershipId = other?.id ?? own;

  const [hours, courses, prefs] = await Promise.all([getAvailability(viewer, { membershipId }), taughtCourses(membershipId), getUserPreferences(viewer.user.id)]);
  const locale = resolveLocale(prefs.preferredLanguage);

  return (
    <PageFrame
      type="list"
      breadcrumb={[{ label: "Bookings", href: bookingRoutes.home }, { label: "Hours" }]}
      secondary={
        <RibbonNav
          label="Bookings"
          links={[
            { label: "Lessons", href: bookingRoutes.week({ tutor: other?.id }) },
            { label: "Hours", href: bookingRoutes.hours(other?.id) },
          ]}
          current={bookingRoutes.hours(other?.id)}
        />
      }
    >
      <PageTitle
        icon={<Clock />}
        title={other ? `${other.name}'s hours` : "Your hours"}
        description={`When families can book ${other ? other.name : "you"}. Class times are left out for you. Times are in ${hours.timeZone.replace(/_/g, " ")} time.`}
      />
      <ReadOnlyNote billingHref={can(viewer, "billing.view") ? "/dashboard/settings/billing" : null} />
      {others.length > 0 ? (
        <LinkSelect
          label="Tutor"
          value={membershipId}
          options={[{ value: own, label: "You", href: bookingRoutes.hours() }, ...others.map((t) => ({ value: t.id, label: t.name, href: bookingRoutes.hours(t.id) }))]}
        />
      ) : null}
      {courses.length === 0 ? (
        <p role="status" className="border-border text-foreground rounded-lg border px-4 py-3 text-sm">
          {other ? `${other.name} isn't` : "You aren't"} teaching a course, so families have nothing to book yet.
        </p>
      ) : null}
      <PageSection id="weekly" title="Every week">
        <HoursForm key={membershipId} membershipId={membershipId} rules={hours.rules} courses={courses} />
      </PageSection>
      <PageSection id="time-off" title="Time off">
        <TimeOff
          key={membershipId}
          membershipId={membershipId}
          timeZone={hours.timeZone}
          today={dayKeyOf(new Date(), hours.timeZone)}
          rows={hours.timeOff.map((t) => ({ id: t.id, note: t.note, label: timeOffLabel(t, hours.timeZone, locale) }))}
        />
      </PageSection>
      {can(viewer, "workspace.settings") ? (
        <PageSection id="rules" title="Booking rules" description={`For everyone in ${viewer.workspace?.name ?? "your workspace"}.`}>
          <PolicyForm policy={hours.policy} />
        </PageSection>
      ) : null}
    </PageFrame>
  );
}
