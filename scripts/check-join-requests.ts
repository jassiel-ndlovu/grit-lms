/**
 * Checks the helpers behind the join-request screens (#206): who a person
 * may ask for, the consent rule on approve, the open-request match, the
 * inbox's status filter and its links, and the "who asked" line.
 *
 *   npx tsx scripts/check-join-requests.ts
 *
 * Pure: no database, no network. Exits 1 on any failure.
 */

import { askedBy, askTargets, joinRoutes, needsConsent, openRequestFor, parseJoinStatus } from "../src/features/courses/lib/join-ui";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

// --- Who may ask -------------------------------------------------------------
const kids = [{ userId: "k1", name: "Thandi" }, { userId: "k2", name: "Musa" }];
check("a student asks for themself", askTargets({ userId: "s", name: "Lindi", isStudent: true }, []), [{ userId: "s", name: "Lindi", self: true }]);
check("a parent asks for each child", askTargets({ userId: "p", name: "Sipho", isStudent: false }, kids).map((t) => t.userId), ["k1", "k2"]);
check("a parent is never a target", askTargets({ userId: "p", name: "Sipho", isStudent: false }, kids).some((t) => t.self), false);
check("a tutor browsing gets no targets", askTargets({ userId: "t", name: "Tutor", isStudent: false }, []), []);

// --- Consent on approve --------------------------------------------------------
check("minor who asked: consent needed", needsConsent(true, false), true);
check("minor, parent asked: no consent box", needsConsent(true, true), false);
check("adult who asked: no consent box", needsConsent(false, false), false);

// --- Open request match --------------------------------------------------------
const rows = [
  { id: "r1", status: "PENDING", course: { id: "c1" }, student: { id: "k1" } },
  { id: "r2", status: "DECLINED", course: { id: "c2" }, student: { id: "k1" } },
  { id: "r3", status: "PENDING", course: { id: "c2" }, student: { id: "k2" } },
];
check("waiting request found", openRequestFor(rows, "c1", "k1")?.id, "r1");
check("a decided request doesn't block asking again", openRequestFor(rows, "c2", "k1"), null);
check("another child's request doesn't count", openRequestFor(rows, "c1", "k2"), null);

// --- Inbox status filter ---------------------------------------------------------
check("no status: waiting", parseJoinStatus(undefined), "PENDING");
check("known status kept", parseJoinStatus("DECLINED"), "DECLINED");
check("lower case isn't a status", parseJoinStatus("approved"), "PENDING");
check("junk: waiting", parseJoinStatus("DROP TABLE"), "PENDING");
check("waiting tab is the bare inbox", joinRoutes.inboxStatus("PENDING"), "/dashboard/join-requests");
check("other tabs carry ?status", joinRoutes.inboxStatus("CANCELLED"), "/dashboard/join-requests?status=CANCELLED");
check("emails' paths match", [joinRoutes.browse, joinRoutes.inbox], ["/dashboard/courses/browse", "/dashboard/join-requests"]);

// --- Who asked ---------------------------------------------------------------------
check("parent asked", askedBy("Thandi", "Sipho"), "Sipho asked for Thandi");
check("student asked", askedBy("Thandi", null), "Thandi asked");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
