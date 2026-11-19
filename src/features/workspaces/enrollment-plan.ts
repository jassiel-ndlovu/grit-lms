/**
 * Which Enrollment rows to open and close so a course's open enrolments
 * match a set of learners (design 01: append-only intervals). Pure, so
 * scripts/check-tenancy-writes.ts can test it.
 *
 * - A learner in the set with no open row gets a new row (never a reopened
 *   one: re-enrolling adds a new interval).
 * - An open row whose learner is not in the set is closed.
 * - If a learner somehow has two open rows, the extra ones are closed so at
 *   most one stays open per course and learner.
 */

export type OpenEnrollment = { id: string; learnerId: string; startedAt: Date };

export type EnrollmentPlan = {
  open: string[]; // learnerIds to open a new row for
  close: string[]; // Enrollment ids to close
};

export function planEnrollmentChanges(openRows: OpenEnrollment[], wantedLearnerIds: Iterable<string>): EnrollmentPlan {
  const wanted = new Set(wantedLearnerIds);
  const close: string[] = [];
  const keptOpen = new Set<string>();

  // Oldest first, so the earliest open interval is the one kept.
  const rows = [...openRows].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime() || a.id.localeCompare(b.id));
  for (const row of rows) {
    if (!wanted.has(row.learnerId) || keptOpen.has(row.learnerId)) close.push(row.id);
    else keptOpen.add(row.learnerId);
  }
  const open = [...wanted].filter((id) => !keptOpen.has(id)).sort();
  return { open, close };
}
