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
export function actionError(res: { serverError?: string; validationErrors?: unknown } | undefined, fallback = "Something went wrong. Try again."): string {
  if (res?.validationErrors) return "Check the details and try again.";
  const m = res?.serverError?.trim();
  if (!m) return fallback;
  const coded = /^[A-Z_]+:\s*(.+)$/.exec(m);
  return coded ? coded[1] : m;
}
