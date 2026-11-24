/**
 * /design-system/staff-time — timesheets, cover for absent tutors and a
 * parent's list of study chats, with sample data and no session, so saving
 * here shows an error. Same gate as /design-system.
 */

import { notFound } from "next/navigation";
import { ReceiptText, UserRoundSearch } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { FamilyChatList } from "@/features/courses/components/study/tutor-views";
import { CandidateSample, EntryCoverSample } from "./samples";
import { CoverDays } from "@/features/events/components/staff-time/cover-views";
import { TimesheetFrame } from "@/features/events/components/staff-time/frames";
import { DecideSheet, SubmitSheet } from "@/features/events/components/staff-time/sheet-actions";
import { PayrollDownloads, SheetDecision, SheetTiles, StaffSheets, TimesheetBody, type SheetRow } from "@/features/events/components/staff-time/sheet-views";
import type { CoverRow } from "@/features/events/staff-time";
import type { TimesheetView } from "@/features/staff/timesheets";
import { canPreviewDesignSystem } from "@/lib/ui-flags";

export const metadata = { title: "Staff time · Design system", robots: { index: false } };

const CTX = { timeZone: "Africa/Johannesburg", locale: "en-ZA" };
const NOW = new Date("2026-11-24T10:00:00Z");
const HERE = "/design-system/staff-time";
const COURSES = [
  { id: "maths", name: "Mathematics Grade 10" },
  { id: "sci", name: "Physical Sciences Grade 11" },
];

const suggested = (key: string, startsAt: string, label: string, kind: "SESSION" | "COVER" | "BOOKING" = "SESSION", minutes = 60): TimesheetView["suggestions"][number] => ({
  kind, key, courseId: "maths", startsAt: new Date(startsAt), minutes, label, eventId: null, occurrenceStart: null, bookingId: null,
});
const entry = (id: string, startsAt: string, label: string, kind: "SESSION" | "COVER" | "BOOKING" | "MANUAL", minutes: number, note: string | null = null): TimesheetView["entries"][number] => ({
  id, kind, key: id, courseId: "maths", startsAt: new Date(startsAt), minutes, label, note,
});

const SHEET: TimesheetView = {
  month: "2026-11", membershipId: "m1", name: "Ayanda Zulu", as: "self",
  sheet: { id: "s1", status: "DRAFT", submittedAt: null, decidedAt: null, decidedById: null, decisionNote: null, hourlyCents: null, totalMinutes: 345, amountCents: null },
  entries: [
    entry("e1", "2026-11-03T13:00:00Z", "Mathematics Grade 10: Functions", "SESSION", 60),
    entry("e2", "2026-11-03T15:00:00Z", "Booked lesson (student didn't come)", "BOOKING", 60),
    entry("e3", "2026-11-05T13:00:00Z", "Cover: Physical Sciences Grade 11: Momentum and impulse, part two", "COVER", 90),
    entry("e4", "2026-11-07T07:00:00Z", "Marked Test 3", "MANUAL", 135, "Two classes.\nThe last five papers came in late."),
  ],
  suggestions: [
    suggested("x1", "2026-11-17T13:00:00Z", "Mathematics Grade 10: Trig graphs"),
    suggested("x2", "2026-11-19T13:00:00Z", "Mathematics Grade 10: Trig graphs, continued with the general solution"),
    suggested("x3", "2026-11-20T14:00:00Z", "Booked lesson", "BOOKING", 45),
    suggested("x4", "2026-11-26T13:00:00Z", "Mathematics Grade 10: Revision"),
  ],
  totals: { minutes: 345, hours: 5.75, hourlyCents: 25_000, amountCents: 143_750 },
  editable: true,
};
const sheet = (status: "SUBMITTED" | "APPROVED" | "REJECTED", note: string | null = null): TimesheetView => ({
  ...SHEET, editable: status === "REJECTED", as: "manager",
  sheet: { ...SHEET.sheet, status, submittedAt: new Date("2026-11-21T10:00:00Z"), decidedAt: status === "SUBMITTED" ? null : new Date("2026-11-23T10:00:00Z"), decisionNote: note },
  suggestions: [],
});

const staff = (membershipId: string, name: string, status: SheetRow["status"], totalMinutes: number, hourlyCents: number | null, amountCents: number | null = null): SheetRow => ({
  membershipId, name, email: `${membershipId}@example.test`, hourlyCents, timesheetId: membershipId, status, totalMinutes, amountCents, submittedAt: null,
});
const STAFF: SheetRow[] = [
  staff("m1", "Ayanda Zulu", "SUBMITTED", 1_725, 25_000),
  staff("m2", "Bongani Nkosi", "APPROVED", 2_400, 31_250, 1_250_000),
  staff("m3", "Nkosinathi Johannes van der Westhuizen-Mokoena", "REJECTED", 345, 25_050),
  staff("m4", "Zanele Mthembu", "DRAFT", 0, null),
];

const cover = (id: string, startsAt: string, courseName: string, more: Partial<CoverRow> = {}): CoverRow => ({
  id, courseId: id, courseName, eventId: id, occurrenceStart: new Date(startsAt), startsAt: new Date(startsAt), endsAt: new Date(new Date(startsAt).getTime() + 3_600_000),
  status: "OPEN", reason: null, absent: { membershipId: "m1", name: "Ayanda Zulu" }, cover: null, manageable: true, ...more,
});
const OPEN = [
  cover("c1", "2026-11-25T13:00:00Z", "Mathematics Grade 10", { reason: "Dentist.\nThe worksheet is in the lesson." }),
  cover("c2", "2026-11-25T15:00:00Z", "Physical Sciences Grade 11 for the Saturday catch-up group", { absent: { membershipId: "m3", name: "Nkosinathi Johannes van der Westhuizen-Mokoena" } }),
];
const ARRANGED = [
  cover("c3", "2026-11-27T13:00:00Z", "Mathematics Grade 10", { status: "ASSIGNED", cover: { membershipId: "m2", name: "Bongani Nkosi" } }),
  cover("c4", "2026-11-28T07:00:00Z", "English Grade 9", { status: "ASSIGNED", absent: { membershipId: "m4", name: "Zanele Mthembu" }, cover: { membershipId: "m1", name: "Ayanda Zulu" }, manageable: false }),
];
const PAST = [
  cover("c5", "2026-11-10T13:00:00Z", "Mathematics Grade 10", { status: "ASSIGNED", cover: { membershipId: "m2", name: "Bongani Nkosi" } }),
  cover("c6", "2026-11-11T13:00:00Z", "Mathematics Grade 10"),
  cover("c7", "2026-11-12T13:00:00Z", "Mathematics Grade 10", { status: "CANCELLED", cover: { membershipId: "m2", name: "Bongani Nkosi" } }),
];

const CHATS = [
  { id: "1", title: "How do I find the gradient at a point on a parabola?", courseName: "Mathematics Grade 10", updatedAt: new Date("2026-11-24T08:00:00Z") },
  { id: "2", title: "What is impulse", courseName: "Physical Sciences Grade 11", updatedAt: new Date("2026-11-20T08:00:00Z") },
];

export default function StaffTimePreviewPage() {
  if (!canPreviewDesignSystem()) notFound();
  const frame = { month: "2026-11", thisMonth: "2026-11", locale: CTX.locale, at: () => HERE, tabs: true };
  return (
    <div data-ui="revamp" data-shell="focus" className="bg-background text-foreground min-h-screen font-sans">
      <TimesheetFrame {...frame} current="mine" actions={<SubmitSheet timesheetId="s1" summary="5 h 45 min in November 2026" leftOut={3} forName={null} />}>
        <PageTitle icon={<ReceiptText />} title="My timesheet" description="November 2026" properties={<SheetTiles view={SHEET} />} />
        <TimesheetBody view={SHEET} ctx={CTX} now={NOW} courses={COURSES} />
      </TimesheetFrame>
      <TimesheetFrame {...frame} current="mine" tabs={false}>
        <PageTitle title="Sent back, waiting and empty" />
        <SheetDecision view={sheet("REJECTED", "The cover on 5 November was an hour, not an hour and a half.")} ctx={CTX} />
        <SheetDecision view={sheet("SUBMITTED")} ctx={CTX} />
        <SheetTiles view={{ ...SHEET, totals: { minutes: 0, hours: 0, hourlyCents: null, amountCents: null } }} />
        <TimesheetBody view={{ ...SHEET, entries: [], suggestions: [] }} ctx={CTX} now={NOW} courses={[]} />
      </TimesheetFrame>
      <TimesheetFrame {...frame} current="staff" person="Ayanda Zulu" actions={<DecideSheet timesheetId="s1" status="SUBMITTED" name="Ayanda Zulu" summary="5 h 45 min in November 2026. R1 437,50" />}>
        <PageTitle title="Ayanda Zulu" description="November 2026" properties={<SheetTiles view={SHEET} />} />
        <SheetDecision view={sheet("SUBMITTED")} ctx={CTX} />
        <TimesheetBody view={sheet("SUBMITTED")} ctx={CTX} now={NOW} courses={COURSES} />
      </TimesheetFrame>
      <TimesheetFrame {...frame} current="staff" actions={<DecideSheet timesheetId="s2" status="APPROVED" name="Bongani Nkosi" summary="40 h in November 2026" />}>
        <PageTitle
          icon={<ReceiptText />}
          title="Timesheets"
          description="November 2026"
          properties={
            <StatTiles>
              <StatTile label="To approve" value="1" />
              <StatTile label="Approved" value="1 of 4" />
              <StatTile label="Approved pay" value="R12 500" />
            </StatTiles>
          }
        />
        <PageSection id="staff">
          <StaffSheets rows={STAFF} month="2026-11" />
        </PageSection>
        <PayrollDownloads month="2026-11" locale={CTX.locale} approved={1} />
        <PayrollDownloads month="2026-12" locale={CTX.locale} approved={0} />
      </TimesheetFrame>
      <PageFrame type="list" breadcrumb={[{ label: "Cover" }]}>
        <PageTitle icon={<UserRoundSearch />} title="Cover" description="Classes whose tutor is away, and who takes them." />
        <PageSection id="open" title="Needs cover (2)">
          <CoverDays rows={OPEN} ctx={CTX} now={NOW} me="m1" />
        </PageSection>
        <PageSection id="arranged" title="Arranged (2)">
          <CoverDays rows={ARRANGED} ctx={CTX} now={NOW} me="m1" />
        </PageSection>
        <PageSection id="past" title="Past and cancelled">
          <CoverDays rows={PAST} ctx={CTX} now={NOW} me="m1" newestFirst />
        </PageSection>
        <PageSection id="pick" title="Picking who covers">
          <CandidateSample />
        </PageSection>
        <PageSection id="calendar" title="On a class in the calendar">
          <EntryCoverSample />
        </PageSection>
      </PageFrame>
      <PageFrame type="record" breadcrumb={[{ label: "Lwazi Dube" }, { label: "Study chats" }]}>
        <PageTitle title="Study chats" description="What a parent sees." />
        <FamilyChatList childUserId="u1" rows={CHATS} ctx={CTX} />
      </PageFrame>
    </div>
  );
}
