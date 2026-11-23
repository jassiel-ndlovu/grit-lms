/**
 * Checks the pure parts of term reports (contracts/term-reports.md): days,
 * who is on a report, marks, levels, attendance and the PDF's characters.
 *
 *   npx tsx scripts/check-term-reports.ts
 */

import {
  achievementLevel, attendanceText, commentsText, countAttendance, countsInTerm, courseReport, dayOf, inTerm, pdfText, percentText, sharedGrade,
  termDaysError, termPhase, termWindow, type ReportAssessment, type ReportGrade,
} from "../src/features/grades/lib/term-report";
import { safe } from "../src/features/reports/term-report-pdf";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const TZ = "Africa/Johannesburg";

// --- The term
check("good days", termDaysError("2026-10-06", "2026-12-09"), null);
check("one day is a term", termDaysError("2026-10-06", "2026-10-06"), null);
check("wrong way round", termDaysError("2026-12-09", "2026-10-06"), "The last day is before the first");
check("not a day", [termDaysError("2026-02-30", "2026-03-01"), termDaysError("", "2026-03-01")], ["Choose the first and last day", "Choose the first and last day"]);
check("more than a year", termDaysError("2025-01-01", "2026-12-31"), "A term can be at most a year");
const w = termWindow("2026-10-06", "2026-12-09", TZ);
check("the window is the workspace's own days", [w.from.toISOString(), w.before.toISOString()], ["2026-10-05T22:00:00.000Z", "2026-12-09T22:00:00.000Z"]);
check("the last evening is in, the next midnight isn't", [inTerm(new Date("2026-12-09T21:59:59Z"), w), inTerm(w.before, w)], [true, false]);
check("a date column's day", dayOf(new Date("2026-10-06T00:00:00Z")), "2026-10-06");
check("phases", ["2026-10-05T21:59:00Z", "2026-10-05T22:00:00Z", "2026-12-09T21:59:00Z", "2026-12-09T22:00:00Z"].map((d) => termPhase("2026-10-06", "2026-12-09", TZ, new Date(d))), ["upcoming", "running", "running", "ended"]);

// --- Enrolments
const e = (startedAt: string, endedAt: string | null) => countsInTerm({ startedAt: new Date(startedAt), endedAt: endedAt ? new Date(endedAt) : null }, w);
check("still enrolled", e("2026-01-01", null), true);
check("joined near the end, still enrolled", e("2026-12-08", null), true);
check("joined after it", e("2026-12-20", null), false);
check("left before it", e("2026-01-01", "2026-09-30"), false);
check("left after it", e("2026-12-08", "2027-01-10"), true);
check("left during it, after weeks", e("2026-01-01", "2026-11-01"), true);
check("added by mistake and taken off", e("2026-10-20", "2026-10-21"), false);
check("left in its first days", e("2026-01-01", "2026-10-08"), false);

// --- Marks
const a = (id: string, dueDate: string, totalPoints: number, weight: number | null = null, isActive = true): ReportAssessment => ({ id, kind: "test", title: id, totalPoints, weight, dueDate: new Date(dueDate), isActive });
const g = (assessmentId: string, score: number, outOf: number, over: Partial<ReportGrade> = {}): ReportGrade => ({
  assessmentId, score, outOf, updatedAt: new Date("2026-11-01"), testSubmission: { status: "GRADED", test: { releaseAutoMarksToStudent: false } }, submissionEntry: null, ...over,
});
const now = new Date("2026-11-23T10:00:00Z");
const work = [a("before", "2026-09-01", 50), a("one", "2026-10-20", 50), a("two", "2026-11-10", 50), a("future", "2026-12-01", 50), a("draft", "2026-11-01", 50, null, false), a("after", "2027-01-20", 50)];

const r = courseReport(work, [g("before", 10, 50), g("one", 40, 50), g("two", 30, 50)], w, now);
check("only this term's marks count", r.percent, 70);
check("and only its work shows: no draft, nothing not yet due", r.items.map((i) => i.id), ["one", "two"]);
check("no marks", courseReport(work, [], w, now), { percent: null, items: [{ id: "one", kind: "test", title: "one", score: null, outOf: 50 }, { id: "two", kind: "test", title: "two", score: null, outOf: 50 }] });
check("marked early shows", courseReport(work, [g("future", 25, 50)], w, now).items.map((i) => [i.id, i.score]), [["one", null], ["two", null], ["future", 25]]);
check("a draft someone was marked on shows", courseReport(work, [g("draft", 25, 50)], w, now).items.map((i) => i.id), ["one", "two", "draft"]);

const hidden = courseReport(work, [g("one", 40, 50), g("two", 5, 50, { testSubmission: { status: "SUBMITTED", test: { releaseAutoMarksToStudent: false } } })], w, now);
check("a mark that isn't released stays out", [hidden.percent, hidden.items.map((i) => i.score)], [80, [40, null]]);
check("auto-marks the test releases are in", courseReport(work, [g("two", 25, 50, { testSubmission: { status: "SUBMITTED", test: { releaseAutoMarksToStudent: true } } })], w, now).percent, 50);
check("an assignment returned for changes stays out", courseReport(work, [g("two", 25, 50, { testSubmission: null, submissionEntry: { status: "SUBMITTED" } })], w, now).percent, null);
check("marked out of nothing is no mark", courseReport(work, [g("two", 0, 0)], w, now).percent, null);
check("the newest of two attempts", courseReport(work, [g("two", 45, 50, { updatedAt: new Date("2026-11-12") }), g("two", 5, 50)], w, now).percent, 90);

const weighted = [a("one", "2026-10-20", 50, 30), a("two", "2026-11-10", 50, 10), a("exam", "2027-06-01", 100, 60)];
check("the course's weights, over this term's work", courseReport(weighted, [g("one", 25, 50), g("two", 50, 50)], w, now).percent, 62.5);
check("no assessments at all", courseReport([], [], w, now), { percent: null, items: [] });

check("levels", [100, 79.5, 79.4, 60, 59.4, 30, 29.4, 0].map((p) => achievementLevel(p, "CAPS")), ["Level 7", "Level 7", "Level 6", "Level 5", "Level 4", "Level 2", "Level 1", "Level 1"]);
check("levels only for CAPS and IEB", [achievementLevel(80, "IEB"), achievementLevel(80, "OTHER"), achievementLevel(80, null), achievementLevel(null, "CAPS")], ["Level 7", null, null, null]);
check("a shared grade", [sharedGrade([10, null, 10]), sharedGrade([10, 11]), sharedGrade([null])], ["10", null, null]);

// --- Attendance and words
check("attendance", countAttendance(["PRESENT", "PRESENT", "LATE", "ABSENT"]), { present: 2, late: 1, absent: 1, excused: 0 });
check("no classes marked", countAttendance([]), null);
check("attendance text", [attendanceText(countAttendance(["PRESENT", "EXCUSED"])), attendanceText(null)], ["1 present, 1 excused", null]);
check("comments", [commentsText(0, 1), commentsText(3, 12)], ["0 of 1 comment written", "3 of 12 comments written"]);
check("percent", [percentText(null), percentText(72.46), percentText(0)], ["Not marked yet", "72.5%", "0%"]);

// --- The PDF's characters
check("typographic marks", pdfText("She’s “great” – keep going…"), "She's \"great\" - keep going...");
check("accents of other alphabets come off", pdfText("Ntšeng Łukasz"), "Ntseng Lukasz");
check("Western European letters stay", pdfText("René Moëlé"), "René Moëlé");
check("the parts of a split accent stay together", pdfText("René š"), "René s");
check("emoji go", pdfText("Well done \u{1F389}❤️!"), "Well done !");
check("lines stay", pdfText("One\r\nTwo\tthree"), "One\nTwo three");
check("another script", pdfText("王 Li"), "? Li");
const mixed = "She’s ‘ok’ — Ntšeng \u{1F44D} ≤ 5";
check("the renderer has nothing left to replace", safe(pdfText(mixed)).includes("?"), false);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
