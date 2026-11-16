/**
 * Checks which account banners each viewer sees
 * (src/features/workspaces/account-banners.ts).
 *
 *   npx tsx scripts/check-account-banners.ts
 */

import { accountBannersFor } from "../src/features/workspaces/account-banners";
import { buildLegacyViewer, permissionsFor, type LegacyRole, type Viewer } from "../src/lib/viewer-core";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const now = new Date("2027-02-10T08:00:00Z");
const base = (role: LegacyRole, verified = true) =>
  buildLegacyViewer({
    user: { id: "u1", name: "Test User", email: "test@example.invalid", role, emailVerified: verified, imageUrl: null },
    profileId: "p1",
  });
const owner = (state: NonNullable<Viewer["workspace"]>["billingState"], trialEndsAt: string | null = null): Viewer => {
  const v = base("TUTOR");
  return {
    ...v,
    workspace: { ...v.workspace!, billingState: state, trialEndsAt, readOnly: state === "READ_ONLY" || state === "CANCELLED" },
    membership: { ...v.membership!, role: "OWNER" },
    permissions: permissionsFor({ persona: "staff", membershipRole: "OWNER", workspaceKind: "ORGANISATION", learnerPaymentVisible: false, hasActiveGuardian: false }),
  };
};
const ids = (v: Viewer) => accountBannersFor(v, now).map((b) => b.id);

// Phase 0: everyone is comped and verified, so nothing shows
for (const r of ["TUTOR", "STUDENT", "PARENT", "ADMIN"] as const) {
  check(`${r}: no banners in Phase 0`, ids(base(r)), []);
}

// Email verification
const unverified = accountBannersFor(base("STUDENT", false), now);
check("unverified: verify-email banner", unverified.map((b) => b.id), ["verify-email"]);
check("unverified: resend action", unverified[0].actions[0].kind, "resend-verification");

// Billing, owner
check("trial with 9 days left: no banner", ids(owner("TRIAL", "2027-02-19T08:00:00Z")), []);
const trial = accountBannersFor(owner("TRIAL", "2027-02-14T08:00:00Z"), now);
check("trial with 4 days left: warning with Pay now", [trial[0].tone, trial[0].actions.map((a) => a.label)], ["warning", ["Pay now"]]);
check("trial message names the end date", trial[0].message.includes("14 Feb"), true);
check("past due: danger, update card and pay", accountBannersFor(owner("PAST_DUE"), now)[0].actions.map((a) => a.label), ["Update card", "Pay now"]);
check("read-only: danger", accountBannersFor(owner("READ_ONLY"), now)[0].tone, "danger");
check("active and comped: nothing", [ids(owner("ACTIVE")), ids(owner("COMPED"))], [[], []]);

// Billing, tutor without billing.manage
const tutorRO = (() => {
  const v = base("TUTOR");
  return { ...v, workspace: { ...v.workspace!, billingState: "READ_ONLY" as const, readOnly: true } };
})();
const t = accountBannersFor(tutorRO, now);
check("read-only tutor: told to ask the owner, no button", [t[0].message.includes("Ask the owner"), t[0].actions.length], [true, 0]);
const tutorPD = (() => {
  const v = base("TUTOR");
  return { ...v, workspace: { ...v.workspace!, billingState: "PAST_DUE" as const } };
})();
check("past due tutor: no banner (billing people only)", ids(tutorPD), []);

// Learners never see billing
const studentRO = (() => {
  const v = base("STUDENT");
  return { ...v, workspace: { ...v.workspace!, billingState: "READ_ONLY" as const, readOnly: true } };
})();
check("read-only workspace: student sees nothing", ids(studentRO), []);

// Impersonation comes first and suppresses the verification email
const imp: Viewer = { ...base("TUTOR", false), impersonatedBy: { userId: "a1", name: "Nexa Admin", endsAt: "2027-02-10T08:25:00Z" } };
const ib = accountBannersFor(imp, now);
check("impersonation: first, danger, no verify-email", [ib.map((b) => b.id), ib[0].tone], [["impersonation"], "danger"]);
check("impersonation: minutes left", ib[0].message.includes("25 min left"), true);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
