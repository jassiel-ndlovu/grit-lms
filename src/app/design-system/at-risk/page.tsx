/**
 * /design-system/at-risk — at-risk alert screens with sample data and no
 * session, so sharing or closing here shows an error. Same gate as
 * /design-system.
 */

import { notFound } from "next/navigation";
import { LifeBuoy } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { Card } from "@/components/ui/card";
import type { AlertRow } from "@/features/activity/at-risk";
import { AlertCourseFilter, AlertList, FamilyNotes, NoAlerts } from "@/features/activity/components/at-risk/views";
import { alertCourses } from "@/features/activity/lib/at-risk";
import type { SharedRiskAlert } from "@/features/risk/alerts";
import { riskSummary, type RiskReason } from "@/features/risk/rules";
import { canPreviewDesignSystem } from "@/lib/ui-flags";

export const metadata = { title: "At risk · Design system", robots: { index: false } };

const CTX = { timeZone: "Africa/Johannesburg", locale: "en-ZA" };
const MATHS = { id: "maths", name: "Mathematics Grade 10" };
const SCIENCE = { id: "science", name: "Physical Sciences Grade 11" };
const at = (iso: string) => new Date(iso);

function row(id: string, name: string, course: typeof MATHS, level: AlertRow["level"], reasons: RiskReason[], more: Partial<AlertRow> = {}): AlertRow {
  return {
    id, course, student: { userId: id, name }, level, status: "OPEN", reasons, summary: riskSummary(name, course.name, reasons),
    firstSeenAt: at("2026-11-18T04:00:00Z"), lastSeenAt: at("2026-11-24T04:00:00Z"), sharedAt: null, sharedWith: [], shareNote: null, closedAt: null,
    canShareWith: { guardians: 2, student: false }, share: "yes", ...more,
  };
}

const MISSED: RiskReason = { rule: "MISSED_WORK", count: 3, titles: ["Essay", "Test 2", "Functions and graphs: sketching and interpreting"], since: "2026-11-03T10:00:00Z" };
const OPEN: AlertRow[] = [
  row("a1", "Thandi Mokoena", MATHS, "AT_RISK", [{ rule: "FALLING_MARKS", from: 72, to: 46 }, { rule: "LOW_MARKS", average: 46, count: 3 }, MISSED]),
  row("a2", "Nkosinathi Johannes van der Westhuizen-Mokoena", MATHS, "AT_RISK", [{ rule: "ABSENCES", absent: 3, sessions: 8 }, MISSED], {
    status: "SHARED", sharedAt: at("2026-11-20T10:00:00Z"), sharedWith: ["GUARDIANS", "STUDENT"], canShareWith: { guardians: 1, student: true },
    shareNote: "Hi, I'd like to help Nkosinathi catch up.\nCould we talk on Thursday after 16:00?",
  }),
  row("a3", "Zanele Mthembu", SCIENCE, "WATCH", [{ rule: "LOW_MARKS", average: 47, count: 2 }], { canShareWith: { guardians: 0, student: false } }),
  row("a4", "Lwazi Dube", SCIENCE, "WATCH", [{ rule: "ABSENCES", absent: 2, sessions: 6 }], { share: "plan" }),
];
const CLOSED: AlertRow[] = [
  row("c1", "Amahle Ngcobo", MATHS, "WATCH", [{ rule: "ABSENCES", absent: 2, sessions: 7 }], { status: "DISMISSED", closedAt: at("2026-11-22T10:00:00Z"), share: "hidden" }),
  row("c2", "Luyanda Ngcobo", MATHS, "AT_RISK", [{ rule: "LOW_MARKS", average: 38, count: 3 }], {
    status: "RESOLVED", closedAt: at("2026-11-16T10:00:00Z"), sharedAt: at("2026-11-10T10:00:00Z"), sharedWith: ["GUARDIANS"], share: "hidden",
  }),
];
const note = (id: string, student: string, course: typeof MATHS, summary: string, text: string | null): SharedRiskAlert => ({
  id, course, student: { userId: id, name: student }, summary, note: text, sharedAt: at("2026-11-20T10:00:00Z"), sharedBy: "Ayanda Zulu", open: true,
});
const NOTES = [
  note("n1", "Thandi Mokoena", MATHS, OPEN[0].summary, "Hi, I'd like to help Thandi catch up.\nCould we talk on Thursday after 16:00?"),
  note("n2", "Sipho Mokoena", SCIENCE, "Sipho was absent from 2 of the last 6 Physical Sciences Grade 11 sessions.", null),
];

export default function AtRiskPreviewPage() {
  if (!canPreviewDesignSystem()) notFound();
  return (
    <div data-ui="revamp" data-shell="focus" className="bg-background text-foreground min-h-screen font-sans">
      <PageFrame type="list" breadcrumb={[{ label: "Design system", href: "/design-system" }, { label: "At risk" }]}>
        <PageTitle
          icon={<LifeBuoy />}
          title="At risk"
          description="Students whose marks, missed work or attendance need a look. Families see nothing until you share it."
        />
        <PageSection id="alerts">
          <AlertCourseFilter view="open" courses={alertCourses(OPEN)} current={null} total={OPEN.length} />
          <AlertList rows={OPEN} ctx={CTX} />
        </PageSection>
        <PageSection title="Closed">
          <AlertList rows={CLOSED} ctx={CTX} />
        </PageSection>
        <PageSection title="Nothing to show">
          <Card className="p-0"><NoAlerts view="open" switchedOn /></Card>
          <Card className="p-0"><NoAlerts view="open" switchedOn={false} /></Card>
          <Card className="p-0"><NoAlerts view="closed" switchedOn /></Card>
        </PageSection>
      </PageFrame>
      <PageFrame type="home" breadcrumb={[{ label: "What a parent of two sees" }]}>
        <FamilyNotes notes={NOTES} ctx={CTX} withStudent />
      </PageFrame>
      <PageFrame type="home" breadcrumb={[{ label: "What a student sees" }]}>
        <FamilyNotes notes={NOTES.slice(0, 1)} ctx={CTX} />
      </PageFrame>
    </div>
  );
}
