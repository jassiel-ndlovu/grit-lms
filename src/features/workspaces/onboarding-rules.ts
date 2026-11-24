/**
 * Bulk onboarding (#216 phase 3): the pure checklist and progress rules,
 * covered by scripts/check-branding.ts.
 */

export type BranchCounts = { teams: number; staff: number; invited: number; courses: number; students: number; events: number };

/** A branch's steps, in order, and how far along it is (0–100). */
export function branchProgress(c: BranchCounts) {
  const steps = [
    { key: "teams", label: "Teams set up", done: c.teams > 0 },
    { key: "staff", label: "Staff joined", done: c.staff > 0 },
    { key: "courses", label: "Courses in its teams", done: c.courses > 0 },
    { key: "students", label: "Students enrolled", done: c.students > 0 },
    { key: "calendar", label: "Classes on the calendar", done: c.events > 0 },
  ];
  return { steps, percent: Math.round((steps.filter((s) => s.done).length / steps.length) * 100), waitingOnInvites: c.invited };
}

export type OrgFacts = {
  branches: number;
  brand: boolean;
  brandAllowed: boolean;
  payout: boolean;
  fees: boolean;
  enquiryForm: boolean;
  staffImported: boolean;
  studentsImported: boolean;
  calendarImported: boolean;
};

/** Organisation-wide steps. Optional ones say so; branding only shows when the plan allows it. */
export function orgChecklist(f: OrgFacts) {
  return [
    { key: "branches", label: "Branches and teams (import \"Branches and teams\")", done: f.branches > 0, optional: false },
    { key: "staff", label: "Staff invited (import \"Tutors and admins\", with Teams)", done: f.staffImported, optional: false },
    { key: "students", label: "Students imported", done: f.studentsImported, optional: false },
    { key: "calendar", label: "Timetable imported", done: f.calendarImported, optional: true },
    { key: "payout", label: "Payout account connected", done: f.payout, optional: true },
    { key: "fees", label: "Fees set up", done: f.fees, optional: true },
    ...(f.brandAllowed ? [{ key: "brand", label: "Logo and sender name", done: f.brand, optional: true }] : []),
    { key: "enquiries", label: "Online enquiry form on", done: f.enquiryForm, optional: true },
  ];
}
