"use client";

/** The parts of cover that need state, for the samples page. */

import * as React from "react";

import { CandidateList } from "@/features/events/components/staff-time/cover-actions";
import { EntryCover } from "@/features/events/components/staff-time/entry-cover";
import type { CalendarEntry } from "@/features/events/lib/calendar-ui";
import { coverEntryId } from "@/features/events/lib/staff-time-ui";

const CANDIDATES = [
  { membershipId: "m2", name: "Bongani Nkosi", teachesCourse: true, sameSubject: true },
  { membershipId: "m5", name: "Nkosinathi Johannes van der Westhuizen-Mokoena", teachesCourse: false, sameSubject: true },
  { membershipId: "m6", name: "Zanele Mthembu", teachesCourse: false, sameSubject: false },
];

export function CandidateSample() {
  const [picked, setPicked] = React.useState<string | null>("m2");
  return (
    <div className="max-w-md">
      <CandidateList candidates={CANDIDATES} picked={picked} onPick={setPicked} name="sample" />
    </div>
  );
}

// Far enough ahead that it's never over.
const START = "2099-12-01T13:00:00.000Z";
const CLASS: CalendarEntry = {
  id: coverEntryId("e1", START), kind: "event", eventId: "e1", occurrenceStart: START, start: START, end: "2099-12-01T14:00:00.000Z", title: "Trig graphs",
  description: null, type: "LECTURE", location: null, link: null, cancelled: false, changed: false, recurring: true, courseId: "maths", courseName: "Mathematics Grade 10", href: null,
};
const STAFF = { maths: [{ membershipId: "m1", name: "Ayanda Zulu" }, { membershipId: "m2", name: "Bongani Nkosi" }] };

export function EntryCoverSample() {
  const base = { me: "m1", manages: true, byEntry: {}, myCourseIds: ["maths"], staffByCourse: STAFF };
  const live = { id: "c1", status: "ASSIGNED" as const, absent: STAFF.maths[0], cover: STAFF.maths[1], manageable: true };
  return (
    <div className="max-w-md space-y-4">
      <EntryCover entry={CLASS} cover={{ ...base, manages: false, staffByCourse: {} }} when="Tuesday 1 December at 15:00" />
      <EntryCover entry={CLASS} cover={base} when="Tuesday 1 December at 15:00" />
      <EntryCover entry={CLASS} cover={{ ...base, byEntry: { [CLASS.id]: live } }} when="Tuesday 1 December at 15:00" />
    </div>
  );
}
