/**
 * Words and small pure helpers for the account and privacy screens (#182,
 * #185; viewer contract Drafts 1.8 and 1.9). Kept apart from the
 * components so scripts/check-account-privacy.ts can check them.
 */

export type EmailLinkKind = "confirm" | "revert";

type OutcomeCopy = {
  tone: "success" | "neutral" | "error";
  title: string;
  body: string;
  next?: { href: string; label: string };
};

/** confirmEmailChange: changed | invalid | expired | taken. revertEmailChange: reverted | invalid | expired | taken. */
export const EMAIL_LINK_COPY: Record<EmailLinkKind, { title: string; lead: string; button: string; outcomes: Record<string, OutcomeCopy> }> = {
  confirm: {
    title: "Confirm your new email address",
    lead: "Confirm this address to finish changing it. You'll be signed out everywhere, then you sign in with the new address.",
    button: "Confirm my new address",
    outcomes: {
      changed: {
        tone: "success",
        title: "Email address changed",
        body: "You've been signed out on every device. Sign in with your new address.",
        next: { href: "/auth", label: "Sign in" },
      },
      invalid: {
        tone: "error",
        title: "This link doesn't work",
        body: "It may have been used already, or a newer link replaced it. Your email address hasn't changed.",
        next: { href: "/dashboard/settings/account", label: "Go to account settings" },
      },
      expired: {
        tone: "error",
        title: "This link has expired",
        body: "Links work for 1 hour. Ask for a new one in your account settings. Your email address hasn't changed.",
        next: { href: "/dashboard/settings/account", label: "Go to account settings" },
      },
      taken: {
        tone: "error",
        title: "That address is taken",
        body: "Another account started using this address after you asked. Choose a different address in your account settings.",
        next: { href: "/dashboard/settings/account", label: "Go to account settings" },
      },
    },
  },
  revert: {
    title: "Undo an email change",
    lead: "Someone changed the email address on your Nexa account. If it wasn't you, put your old address back. Everyone is signed out.",
    button: "This wasn't me: undo it",
    outcomes: {
      reverted: {
        tone: "success",
        title: "Your old address is back",
        body: "Everyone has been signed out. If you didn't make the change, someone may know your password: reset it now.",
        next: { href: "/forgot-password", label: "Reset my password" },
      },
      invalid: {
        tone: "error",
        title: "This link doesn't work",
        body: "It may have been used already. If you can't sign in, reset your password from the sign-in page.",
        next: { href: "/forgot-password", label: "Reset my password" },
      },
      expired: {
        tone: "error",
        title: "This link has expired",
        body: "Undo links work for 7 days. If you can't sign in, reset your password from the sign-in page, or contact Nexa support.",
        next: { href: "/support", label: "Contact support" },
      },
      taken: {
        tone: "error",
        title: "We couldn't put the old address back",
        body: "Another account uses it now. Contact Nexa support and we'll help you get your account back.",
        next: { href: "/support", label: "Contact support" },
      },
    },
  },
};

/** "14 December 2026" in the user's zone, or Johannesburg. */
export function formatDeletionDate(iso: string, timeZone = "Africa/Johannesburg"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone }).format(d);
}

/** Only a YYYY-MM-DD date travels in the URL after a self-deletion: no names or addresses. */
export function deletionDoneHref(deleteOnIso: string, emailed: boolean): string {
  return `/account/deletion-requested?on=${encodeURIComponent(deleteOnIso.slice(0, 10))}${emailed ? "" : "&email=0"}`;
}

/** What happens to the data, from the contract's "after the grace" list. */
export function deletionConsequences(opts: { isGuardian: boolean; isLearner: boolean; isStaff: boolean }): string[] {
  const out = [
    "Your name becomes “Former user” and your email address and username are removed.",
    "Your sign-in details, preferences and notifications are deleted.",
  ];
  if (opts.isLearner) out.push("Your tests, assignments and grades are deleted.");
  if (opts.isStaff) out.push("You leave every organisation you're a member of.");
  if (opts.isGuardian) out.push("Your links to your children end. Their own accounts stay as they are.");
  out.push("Invoices and payments are kept with your name only, because the law requires financial records.");
  return out;
}

/** The typed word that unlocks the delete button. */
export const DELETE_WORD = "DELETE";

export function deleteWordMatches(typed: string): boolean {
  return typed.trim() === DELETE_WORD;
}
