/**
 * Checks the helpers behind the owner's decisions of 21 Nov (#206, #191,
 * #189): the teaching switch's typed name, the restart panel's steps, the
 * READ_ONLY error, and that a non-teaching organisation's owner or admin is
 * never shown as a course's tutor.
 *
 *   npx tsx scripts/check-decision-screens.ts
 *
 * Pure: no database, no network. Exits 1 on any failure.
 */

import { otherTeacherName } from "../src/features/courses/lib/course-access";
import { confirmsName, isReadOnlyError, restartStep } from "../src/features/courses/lib/teaching-ui";
import { teachesAsOwner, tutorOf } from "../src/features/courses/lib/tenancy-where";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

// --- Teaching switch: typed name --------------------------------------------
check("exact name confirms", confirmsName("Riverside Maths Academy", "Riverside Maths Academy"), true);
check("case and outer spaces don't matter", confirmsName("  riverside maths ACADEMY ", "Riverside Maths Academy"), true);
check("a partial name doesn't confirm", confirmsName("Riverside", "Riverside Maths Academy"), false);
check("empty doesn't confirm", confirmsName("   ", "  "), false);

// --- Restart: one step per result -------------------------------------------
check("PAY_OUTSTANDING pays invoices", restartStep({ status: "PAY_OUTSTANDING", invoiceIds: ["a", "b"] }).action, "pay-invoices");
check("PAY_OUTSTANDING counts bills", restartStep({ status: "PAY_OUTSTANDING", invoiceIds: ["a", "b"] }).title, "Pay the 2 unpaid bills first");
check("one unpaid bill reads as one", restartStep({ status: "PAY_OUTSTANDING", invoiceIds: ["a"] }).title, "Pay the unpaid bill first");
check("PAY_FIRST_PERIOD is the first payment", restartStep({ status: "PAY_FIRST_PERIOD", activeStudents: 1 }).action, "first-payment");
check("PAY_FIRST_PERIOD names one student", restartStep({ status: "PAY_FIRST_PERIOD", activeStudents: 1 }).body.startsWith("You have 1 active student."), true);
check("CARD_REQUIRED saves a card", restartStep({ status: "CARD_REQUIRED" }).action, "add-card");
check("RESTARTED is done", restartStep({ status: "RESTARTED", renewsAt: "2026-12-22T00:00:00.000Z" }).action, "done");

// --- Read-only ----------------------------------------------------------------
check("READ_ONLY error is recognised", isReadOnlyError("READ_ONLY: Your workspace is read-only. Pay to unlock it."), true);
check("other errors aren't", isReadOnlyError("FORBIDDEN: nope"), false);
check("no error isn't", isReadOnlyError(undefined), false);

// --- Tutor lists: an organisation that doesn't teach (#206) ------------------
const user = { id: "u1", name: "Owner Person", tutorProfile: { id: "t1", fullName: "Owner Person", email: "o@example.test" } };
const off = { kind: "ORGANISATION", teachingOffAt: "2026-11-22T00:00:00.000Z" };
const on = { kind: "ORGANISATION", teachingOffAt: null };
check("owner of a non-teaching org isn't a teacher", teachesAsOwner({ role: "OWNER", workspace: off }), false);
check("admin of a non-teaching org isn't a teacher", teachesAsOwner({ role: "ADMIN", workspace: off }), false);
check("tutor of a non-teaching org still teaches", teachesAsOwner({ role: "TUTOR", workspace: off }), true);
check("owner of a teaching org teaches", teachesAsOwner({ role: "OWNER", workspace: on }), true);
check("solo owner always teaches", teachesAsOwner({ role: "OWNER", workspace: { kind: "SOLO", teachingOffAt: "2026-11-22" } }), true);
check("tutorOf hides a non-teaching owner", tutorOf({ ownerMembership: { role: "OWNER", workspace: off, user } }), null);
check("tutorOf shows a teaching owner", tutorOf({ ownerMembership: { role: "OWNER", workspace: on, user } })?.fullName, "Owner Person");
check("tutorOf shows a tutor", tutorOf({ ownerMembership: { role: "TUTOR", workspace: off, user } })?.fullName, "Owner Person");
check("otherTeacherName hides a non-teaching owner", otherTeacherName("viewer", { ownerMembership: { role: "OWNER", workspace: off, user } }), null);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll decision-screen checks passed.");
