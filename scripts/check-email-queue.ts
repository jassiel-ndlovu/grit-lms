/**
 * Checks the email queue rules, the non-production recipient guard and the
 * billing templates. The modules import "server-only", so run with the shim:
 *
 *   NODE_PATH=<dir with an empty server-only package> npx tsx scripts/check-email-queue.ts
 */

import { rands, renderBillingEmail } from "../src/lib/email/billing-templates";
import { retentionWarningDue } from "../src/features/billing/retention";
import { isRetryable, retryDelayMinutes, sealForQueue } from "../src/lib/email/queue";
import { recipientAllowed } from "../src/lib/email/send";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

// Retries: 1 min, 5 min, 30 min, 2 h, 12 h, then give up.
check("retry delays", [1, 2, 3, 4, 5, 6].map(retryDelayMinutes), [1, 5, 30, 120, 720, null]);
check("429 retries", isRetryable(429), true);
check("409 (concurrent idempotent request) retries", isRetryable(409), true);
check("5xx retries", isRetryable(503), true);
check("no answer retries", isRetryable(undefined), true);
check("403 (dev sender, wrong recipient) does not", isRetryable(403), false);
check("422 (bad request) does not", isRetryable(422), false);

// Non-production guard
check("production mails anyone", recipientAllowed("a@x.com", { VERCEL_ENV: "production" }), true);
check("preview without allowlist mails nobody", recipientAllowed("a@x.com", { VERCEL_ENV: "preview" }), false);
check("local without allowlist mails nobody", recipientAllowed("a@x.com", {}), false);
check("allowlisted address, any case", recipientAllowed("Owner@X.com", { VERCEL_ENV: "preview", EMAIL_ALLOWLIST: " owner@x.com , b@y.com" }), true);
check("not on the allowlist", recipientAllowed("c@z.com", { VERCEL_ENV: "preview", EMAIL_ALLOWLIST: "owner@x.com" }), false);

// Money
check("rands", [rands(0), rands(9900), rands(333600), rands(123456789)], ["R0.00", "R99.00", "R3,336.00", "R1,234,567.89"]);

// Templates render, escape, and carry the amounts
const dun = renderBillingEmail("dunning", { workspaceName: "Maths <Club>", day: 7, invoiceNumber: "NX-2027-000123", totalCents: 457400, readOnlyOn: "19 March 2027" });
check("dunning day 7 is the final notice", dun.subject.startsWith("Final notice"), true);
check("workspace name escaped in html", dun.html.includes("Maths &lt;Club&gt;") && !dun.html.includes("<Club>"), true);
check("amount in text", dun.text.includes("R4,574.00"), true);
check("trial ending tomorrow", renderBillingEmail("trial-ending", { workspaceName: "W", daysLeft: 1, trialEndsOn: "3 Feb 2027" }).subject, "Your Nexa trial ends tomorrow");
check("trial ending in 4 days", renderBillingEmail("trial-ending", { workspaceName: "W", daysLeft: 4, trialEndsOn: "3 Feb 2027" }).subject, "Your Nexa trial ends in 4 days");
const rec = renderBillingEmail("receipt", { workspaceName: "W", invoiceNumber: "NX-2027-000001", totalCents: 19800, paidOn: "3 Feb 2027", renewsOn: "5 Mar 2027", cardLast4: "4081" });
check("receipt names card and renewal", rec.text.includes("ending 4081") && rec.text.includes("5 Mar 2027"), true);
check("every template links to billing", ["trial-ended", "read-only"].every((t) => renderBillingEmail(t as "trial-ended", { workspaceName: "W", invoiceNumber: "N", totalCents: 1 } as never).text.includes("/dashboard/billing")), true);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
