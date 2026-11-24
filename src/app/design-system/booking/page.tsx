/**
 * /design-system/booking — session booking screens with sample data and no
 * session, so saving here shows an error. Same gate as /design-system.
 */

import { notFound } from "next/navigation";
import { CalendarCheck, CalendarPlus, Clock } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import type { BookingRow } from "@/features/booking/bookings";
import { FamilyCredits, StaffCredits } from "@/features/events/components/booking/credits";
import { HoursForm, PolicyForm, TimeOff } from "@/features/events/components/booking/hours-form";
import { LinkSelect, WeekStepper } from "@/features/events/components/booking/pickers";
import { SlotPicker } from "@/features/events/components/booking/slot-picker";
import { BookingDays } from "@/features/events/components/booking/views";
import { timeOffLabel } from "@/features/events/lib/booking-ui";
import { canPreviewDesignSystem } from "@/lib/ui-flags";

export const metadata = { title: "Booking · Design system", robots: { index: false } };

const CTX = { timeZone: "Africa/Johannesburg", locale: "en-ZA" };
const NOW = new Date("2026-11-24T13:20:00Z");
const HERE = "/design-system/booking";
const MATHS = { id: "maths", name: "Mathematics Grade 10" };

function row(id: string, student: string, startsAt: string, more: Partial<BookingRow> = {}): BookingRow {
  const start = new Date(startsAt);
  return {
    id, course: MATHS, tutor: { membershipId: "m1", name: "Ayanda Zulu" }, student: { learnerId: id, userId: id, name: student },
    startsAt: start, endsAt: new Date(start.getTime() + 60 * 60_000), status: "BOOKED", note: null, meetingLink: null, usedCredit: false,
    cancelledAt: null, cancelReason: null, creditReturned: false, canCancel: true, cancelReturnsCredit: false, ...more,
  };
}

const ROWS = [
  row("b1", "Thandi Mokoena", "2026-11-24T08:00:00Z", { note: "Trig graphs, please.\nThe ones from Test 2." }),
  row("b2", "Lwazi Dube", "2026-11-24T13:00:00Z", { meetingLink: "https://meet.google.com/abc-defg-hij", usedCredit: true, cancelReturnsCredit: true }),
  row("b3", "Nkosinathi Johannes van der Westhuizen-Mokoena", "2026-11-25T14:00:00Z", { meetingLink: "https://us02web.zoom.us/j/1234567890" }),
  row("b4", "Zanele Mthembu", "2026-11-25T15:00:00Z", { status: "CANCELLED", canCancel: false, cancelReason: "Netball match moved.", usedCredit: true, creditReturned: true }),
  row("b5", "Amahle Ngcobo", "2026-11-23T14:00:00Z", { status: "COMPLETED", canCancel: false }),
  row("b6", "Luyanda Ngcobo", "2026-11-23T15:00:00Z", { status: "NO_SHOW", canCancel: false }),
];
const FAMILY = [ROWS[1], ROWS[2]].map((r) => ({ ...r, cancelReturnsCredit: r.usedCredit }));

const slot = (start: string, time: string, range: string, tutor = "Ayanda Zulu") => ({ membershipId: tutor, tutor, start, time, range });
const DAYS = [
  { day: "2026-11-25", label: "Wednesday 25 November", slots: [slot("2026-11-25T12:00:00Z", "14:00", "14:00–15:00"), slot("2026-11-25T13:15:00Z", "15:15", "15:15–16:15"), slot("2026-11-25T13:15:00Z", "15:15", "15:15–16:15", "Bongani Nkosi")] },
  { day: "2026-11-26", label: "Thursday 26 November", slots: [slot("2026-11-26T12:00:00Z", "14:00", "14:00–15:00")] },
];
const PACKS = [
  { id: "p5", description: "5 lessons", amountCents: 125000, lessons: 5 },
  { id: "p10", description: "10 lessons", amountCents: 230000, lessons: 10 },
];
const credit = (courseId: string, courseName: string, balance: number, packs = PACKS) => ({ courseId, courseName, balance, needsCredits: packs.length > 0, packs });
const RULES = [
  { id: "r1", weekday: 1, startMinute: 840, endMinute: 1020, slotMinutes: 60, bufferMinutes: 0, courseId: null },
  { id: "r2", weekday: 3, startMinute: 840, endMinute: 1020, slotMinutes: 45, bufferMinutes: 15, courseId: "maths" },
  { id: "r3", weekday: 3, startMinute: 1080, endMinute: 1200, slotMinutes: 60, bufferMinutes: 0, courseId: null },
];
const OFF = [
  { id: "t1", startsAt: new Date("2026-12-08T22:00:00Z"), endsAt: new Date("2027-01-10T22:00:00Z"), note: "School holidays" },
  { id: "t2", startsAt: new Date("2026-11-27T06:00:00Z"), endsAt: new Date("2026-11-27T10:00:00Z"), note: null },
];

export default function BookingPreviewPage() {
  if (!canPreviewDesignSystem()) notFound();
  return (
    <div data-ui="revamp" data-shell="focus" className="bg-background text-foreground min-h-screen font-sans">
      <PageFrame
        type="list"
        breadcrumb={[{ label: "Design system", href: "/design-system" }, { label: "Bookings (staff)" }]}
        secondary={<WeekStepper label="23 – 29 Nov 2026" previous={HERE} today={HERE} next={HERE} isToday todayLabel="This week" />}
      >
        <PageTitle icon={<CalendarCheck />} title="Bookings" description="23 – 29 Nov 2026. Lessons booked with you." />
        <LinkSelect label="Show" value="mine" options={[{ value: "mine", label: "My lessons", href: HERE }, { value: "t", label: "Bongani Nkosi", href: HERE }, { value: "c", label: "Course: Mathematics Grade 10", href: HERE }]} />
        <BookingDays rows={ROWS} ctx={CTX} now={NOW} staff showStudent showTutor={false} />
        <PageSection title="Lessons left, on a student's page">
          <StaffCredits learnerId="l1" studentName="Thandi Mokoena" courses={[credit("maths", "Mathematics Grade 10", 3), credit("sci", "Physical Sciences Grade 11", 0, [])]} />
        </PageSection>
      </PageFrame>
      <PageFrame type="list" breadcrumb={[{ label: "Hours" }]}>
        <PageTitle icon={<Clock />} title="Your hours" description="When families can book you. Class times are left out for you. Times are in Africa/Johannesburg time." />
        <PageSection title="Every week">
          <HoursForm membershipId="m1" rules={RULES} courses={[MATHS, { id: "sci", name: "Physical Sciences Grade 11" }]} />
        </PageSection>
        <PageSection title="Time off">
          <TimeOff membershipId="m1" timeZone={CTX.timeZone} today="2026-11-24" rows={OFF.map((t) => ({ id: t.id, note: t.note, label: timeOffLabel(t, CTX.timeZone, CTX.locale) }))} />
        </PageSection>
        <PageSection title="Booking rules" description="For everyone in Mokoena Tutors.">
          <PolicyForm policy={{ cancelHours: 24, leadHours: 12, horizonDays: 30 }} />
        </PageSection>
      </PageFrame>
      <PageFrame type="list" breadcrumb={[{ label: "What a parent sees" }]}>
        <PageTitle icon={<CalendarCheck />} title="Bookings" description="Extra lessons booked for your children." />
        <BookingDays rows={FAMILY} ctx={CTX} now={new Date("2026-11-24T06:00:00Z")} staff={false} showStudent showTutor />
        <PageSection title="Lesson packs">
          <FamilyCredits
            withName
            forSale
            lists={[
              { learnerId: "l1", name: "Thandi Mokoena", payer: true, courses: [credit("maths", "Mathematics Grade 10", 3)] },
              { learnerId: "l2", name: "Sipho Mokoena", payer: true, courses: [credit("maths", "Mathematics Grade 10", 0)] },
            ]}
          />
        </PageSection>
        <PageSection title="Lesson packs, billing off (a student)">
          <FamilyCredits withName={false} forSale={false} lists={[{ learnerId: "l3", name: "Lwazi Dube", payer: false, courses: [credit("maths", "Mathematics Grade 10", 0)] }]} />
        </PageSection>
      </PageFrame>
      <PageFrame type="list" breadcrumb={[{ label: "Book a lesson" }]}>
        <PageTitle icon={<CalendarPlus />} title="Book a lesson" description="Mathematics Grade 10 for Thandi Mokoena. 3 lessons left on the pack." />
        <PageSection title="24 Nov – 30 Nov">
          <SlotPicker courseId="maths" courseName="Mathematics Grade 10" learnerId="l1" studentName="Thandi Mokoena" days={DAYS} manyTutors credits={{ needed: true, balance: 3 }} cancelHours={24} staff={false} />
        </PageSection>
        <PageSection title="Out of lessons, one tutor">
          <SlotPicker courseId="maths" courseName="Mathematics Grade 10" learnerId="l1" studentName={null} days={DAYS.slice(1).map((d) => ({ ...d, day: `x${d.day}` }))} manyTutors={false} credits={{ needed: true, balance: 0 }} cancelHours={24} staff={false} />
        </PageSection>
      </PageFrame>
    </div>
  );
}
