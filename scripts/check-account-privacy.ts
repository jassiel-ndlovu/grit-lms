/**
 * Checks the account and privacy screens (#182, #185, #178, #174):
 * the words and helpers behind them, the QR code, that the emailed-link
 * pages act on a click (never on load) inside the page frame, and that
 * messages written for users reach the screen as written.
 *
 *   npx tsx scripts/check-account-privacy.ts
 *
 * Pure: no database, no network. Exits 1 on any failure.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderSVG } from "uqr";

import {
  deleteWordMatches,
  deletionConsequences,
  deletionDoneHref,
  EMAIL_LINK_COPY,
  formatDeletionDate,
} from "../src/components/account/account-copy";
import { actionError } from "../src/features/courses/lib/account-ui";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}
const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// --- Delete: the typed word ---------------------------------------------------
check("DELETE confirms", deleteWordMatches("DELETE"), true);
check("outer spaces are fine", deleteWordMatches("  DELETE "), true);
check("lower case doesn't confirm (strict)", deleteWordMatches("delete"), false);
check("empty doesn't confirm", deleteWordMatches(""), false);

// --- Delete: what happens -----------------------------------------------------
const learner = deletionConsequences({ isGuardian: false, isLearner: true, isStaff: false });
check("learners lose tests and grades", learner.some((l) => /tests, assignments and grades/.test(l)), true);
check("learners aren't told about workspaces", learner.some((l) => /workspace/.test(l)), false);
const guardian = deletionConsequences({ isGuardian: true, isLearner: false, isStaff: false });
check("guardians: links end, children's accounts stay", guardian.some((l) => /children end\. Their own accounts stay/.test(l)), true);
check("invoices are kept with the name only", guardian.at(-1)?.startsWith("Invoices and payments are kept with your name only"), true);

// --- After a self-deletion: only the date travels ----------------------------
check("done link carries the date only", deletionDoneHref("2026-12-06T10:15:00.000Z", true), "/account/deletion-requested?on=2026-12-06");
check("no email: says so", deletionDoneHref("2026-12-06T10:15:00.000Z", false), "/account/deletion-requested?on=2026-12-06&email=0");
check("date reads in words", formatDeletionDate("2026-12-06T12:00:00Z"), "6 December 2026");
check("a bad date is empty", formatDeletionDate("nope"), "");

// --- Email links: every status has words -----------------------------------
check("confirm handles each status", Object.keys(EMAIL_LINK_COPY.confirm.outcomes).sort(), ["changed", "expired", "invalid", "taken"]);
check("revert handles each status", Object.keys(EMAIL_LINK_COPY.revert.outcomes).sort(), ["expired", "invalid", "reverted", "taken"]);
check("changed sends them to sign in", EMAIL_LINK_COPY.confirm.outcomes.changed.next?.href, "/auth");
check("reverted suggests a password reset", EMAIL_LINK_COPY.revert.outcomes.reverted.next?.href, "/forgot-password");

// --- Server messages are shown as written (#174, #185) ----------------------
const twoFactorMsg = "For your security, sign out and sign in again with your authenticator code, then change your email within 15 minutes.";
check("a UserError message is shown as is", actionError({ serverError: twoFactorMsg }), twoFactorMsg);
check("a managed-account refusal is shown as is", actionError({ serverError: "This person manages their own account. They can reset their password from the sign-in page, or delete the account in their settings." }).startsWith("This person manages"), true);
check("a coded error drops the code", actionError({ serverError: "TRIAL_CAP_REACHED: The trial allows 20 students." }), "The trial allows 20 students.");

// --- Two-factor QR code (#178) ----------------------------------------------
const svg = renderSVG("otpauth://totp/Nexa:owner@example.test?secret=JBSWY3DPEHPK3PXP&issuer=Nexa", { border: 2, ecc: "M" });
check("the QR code is an SVG", svg.trimStart().startsWith("<svg"), true);
check("the QR code has no script", /<script/i.test(svg), false);
const twoFactor = src("src/components/auth/two-factor-setup.tsx");
check("setup shows the QR code next to the key", twoFactor.includes('data-testid="totp-qr"') && twoFactor.includes('data-testid="totp-secret"'), true);
check("passwordless accounts skip the password", twoFactor.includes("hasPassword ? { password } : {}"), true);
check("Remind me tomorrow stays", twoFactor.includes("Remind me tomorrow"), true);
check("uqr is pinned exactly", JSON.parse(src("package.json")).dependencies.uqr, "0.1.3");

// --- Emailed-link pages: framed, and act on a click ---------------------------
for (const page of ["cancel-deletion", "confirm-email", "revert-email", "deletion-requested"]) {
  check(`/account/${page} uses the page frame`, src(`src/app/account/${page}/page.tsx`).includes("<PageFrame"), true);
}
const tokenActions = src("src/components/account/token-actions.tsx");
check("link pages never act on load", /useEffect/.test(tokenActions), false);
check("account settings is framed", src("src/app/dashboard/settings/account/page.tsx").includes('type="settings"'), true);

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nAll passed");
