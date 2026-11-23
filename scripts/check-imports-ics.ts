/**
 * Checks the .ics reader used by the calendar import
 * (src/features/imports/ics.ts). Pure; runs in CI.
 *
 *   npx tsx scripts/check-imports-ics.ts
 */

import { durationMinutes, readIcs, repeatText, zonedToUtc } from "../src/features/imports/ics";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

check("Johannesburg is UTC+2", zonedToUtc(2026, 12, 1, 14, 0, 0, "Africa/Johannesburg").toISOString(), "2026-12-01T12:00:00.000Z");
check("New York in winter is UTC-5", zonedToUtc(2026, 1, 15, 9, 0, 0, "America/New_York").toISOString(), "2026-01-15T14:00:00.000Z");
check("New York in summer is UTC-4", zonedToUtc(2026, 7, 15, 9, 0, 0, "America/New_York").toISOString(), "2026-07-15T13:00:00.000Z");
check("durations", ["PT1H30M", "P1D", "P1W", "PT45M", "bad"].map(durationMinutes), [90, 1440, 10080, 45, null]);

const google = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
  "BEGIN:VEVENT",
  "DTSTART;TZID=Africa/Johannesburg:20261201T160000",
  "DTEND;TZID=Africa/Johannesburg:20261201T173000",
  "RRULE:FREQ=WEEKLY;WKST=MO;UNTIL=20261231T215959Z;BYDAY=TU,TH",
  "EXDATE;TZID=Africa/Johannesburg:20261208T160000",
  "UID:maths-123@google.com",
  "SUMMARY:Maths\\, Grade 10",
  "DESCRIPTION:Bring a calculator\\nChapter 3",
  "LOCATION:Room 4",
  "BEGIN:VALARM",
  "ACTION:DISPLAY",
  "DESCRIPTION:This is an alarm, not the event",
  "END:VALARM",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20261216",
  "DTEND;VALUE=DATE:20261217",
  "SUMMARY:Day of Reconciliation",
  "UID:holiday-1",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20261203T080000Z",
  "DURATION:PT45M",
  "SUMMARY:Quiz with a very long title that the export folded onto",
  "  a second line",
  "URL:https://meet.example.test/abc",
  "RRULE:FREQ=MONTHLY;BYMONTHDAY=3;COUNT=4",
  "UID:quiz-1",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "RECURRENCE-ID;TZID=Africa/Johannesburg:20261210T160000",
  "DTSTART;TZID=Africa/Johannesburg:20261210T170000",
  "SUMMARY:Maths moved",
  "UID:maths-123@google.com",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:No start",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const r = readIcs(google, "Africa/Johannesburg");
check("three events read; a changed occurrence and a broken event reported", [r.events.length, r.changedOccurrences, r.problems.length], [3, 1, 1]);
const [maths, holiday, quiz] = r.events;
check("escaped comma and new line; alarm text ignored", [maths.title, maths.description], ["Maths, Grade 10", "Bring a calculator\nChapter 3"]);
check("TZID start converted to UTC, length from DTEND", [maths.start.toISOString(), maths.durationMinutes, maths.timeZone], ["2026-12-01T14:00:00.000Z", 90, "Africa/Johannesburg"]);
check("weekly repeat on Tuesday and Thursday until the end of December", [maths.repeat?.frequency, maths.repeat?.weekdays, maths.repeat?.until?.toISOString(), maths.repeatDropped], ["WEEKLY", [2, 4], "2026-12-31T21:59:59.000Z", []]);
check("skipped date", maths.excluded.map((d) => d.toISOString()), ["2026-12-08T14:00:00.000Z"]);
check("all-day: midnight local, one day long", [holiday.allDay, holiday.start.toISOString(), holiday.durationMinutes], [true, "2026-12-15T22:00:00.000Z", 1440]);
check("folded title, UTC start, DURATION, link", [quiz.title, quiz.start.toISOString(), quiz.durationMinutes, quiz.link], ["Quiz with a very long title that the export folded onto a second line", "2026-12-03T08:00:00.000Z", 45, "https://meet.example.test/abc"]);
check("unsupported rule parts reported", [quiz.repeat?.frequency, quiz.repeat?.count, quiz.repeatDropped], ["MONTHLY", 4, ["BYMONTHDAY"]]);
check("rule written back for the preview", repeatText(maths.repeat), "FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261231T215959Z");
check("not a calendar", readIcs("Full name,Email\nThandi,t@example.com", "Africa/Johannesburg").problems, ["That isn't a calendar (.ics) file."]);
check("floating time uses the workspace zone", readIcs("BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20261201T090000\nSUMMARY:x\nEND:VEVENT\nEND:VCALENDAR", "Africa/Johannesburg").events[0].start.toISOString(), "2026-12-01T07:00:00.000Z");

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll .ics checks passed.");
