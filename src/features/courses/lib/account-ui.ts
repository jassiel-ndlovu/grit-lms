/**
 * Pure helpers for the account screens (#174), kept apart from the
 * components so scripts can check them.
 */

/** Splits pasted addresses on commas, semicolons, spaces or new lines. */
export function parseEmails(raw: string): { emails: string[]; bad: string[] } {
  const parts = raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const emails: string[] = [];
  const bad: string[] = [];
  for (const p of parts) (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p) ? emails : bad).push(p);
  return { emails: [...new Set(emails)], bad };
}

/** A readable message from a safe-action result. */
export function actionError(res: { serverError?: string; validationErrors?: unknown } | undefined, fallback = "That didn't work. Check your connection and try again."): string {
  if (res?.validationErrors) return "Check the details and try again.";
  const m = res?.serverError?.trim();
  if (!m) return fallback;
  const coded = /^[A-Z_]+:\s*(.+)$/.exec(m);
  return coded ? coded[1] : m;
}

/** Where a student-limit error sends people (#178). */
export const BILLING_PATH = "/dashboard/settings/billing";

/**
 * True when a server error is a student limit (A's assertCanAddLearners):
 * TRIAL_CAP_REACHED, or FORBIDDEN for the workspace's own limit. These get
 * a link to billing.
 */
export function isStudentLimitError(serverError: string | null | undefined): boolean {
  const m = serverError?.trim() ?? "";
  return m.startsWith("TRIAL_CAP_REACHED:") || (m.startsWith("FORBIDDEN:") && /limit/i.test(m) && /student/i.test(m));
}
