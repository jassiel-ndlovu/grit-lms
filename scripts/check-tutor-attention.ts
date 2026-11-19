/**
 * Checks the tutor home's "Needs your attention" rules
 * (src/features/activity/lib/attention.ts).
 *
 *   npx tsx scripts/check-tutor-attention.ts
 */

import {
  attentionRows,
  bucketFor,
  filterRows,
  parseAttentionFilter,
  type AttentionSource,
} from "../src/features/activity/lib/attention";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const now = new Date("2026-11-19T10:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
const item = (over: Partial<AttentionSource>): AttentionSource => ({
  kind: "test",
  id: "x",
  title: "X",
  course: "C",
  dueDate: days(3),
  isActive: true,
  toMark: 0,
  ...over,
});

// Buckets.
check("hand-ins waiting → mark", bucketFor(item({ toMark: 2 }), now), "mark");
check("mark wins over draft", bucketFor(item({ toMark: 1, isActive: false }), now), "mark");
check("mark even when long past due", bucketFor(item({ toMark: 1, dueDate: days(-30) }), now), "mark");
check("hidden and upcoming → draft", bucketFor(item({ isActive: false, dueDate: days(20) }), now), "draft");
check("hidden and past → nothing", bucketFor(item({ isActive: false, dueDate: days(-1) }), now), null);
check("visible, due in 3 days → due", bucketFor(item({}), now), "due");
check("visible, due in exactly 7 days → due", bucketFor(item({ dueDate: days(7) }), now), "due");
check("visible, due in 8 days → nothing", bucketFor(item({ dueDate: days(8) }), now), null);
check("visible, past due, nothing to mark → nothing", bucketFor(item({ dueDate: days(-1) }), now), null);
check("custom window", bucketFor(item({ dueDate: days(10) }), now, 14), "due");

// Order: mark, due, draft; soonest first; title breaks ties.
const rows = attentionRows(
  [
    item({ id: "d1", title: "Draft late", isActive: false, dueDate: days(30) }),
    item({ id: "u2", title: "Due later", dueDate: days(5) }),
    item({ id: "m1", title: "Mark", toMark: 4, dueDate: days(-2) }),
    item({ id: "u1", title: "Due soon", dueDate: days(1) }),
    item({ id: "skip", title: "Far off", dueDate: days(40) }),
    item({ id: "d0", title: "Draft soon", isActive: false, dueDate: days(2) }),
  ],
  now,
);
check("rows in display order", rows.map((r) => r.id), ["m1", "u1", "u2", "d0", "d1"]);
check("rows carry their bucket", rows.map((r) => r.bucket), ["mark", "due", "due", "draft", "draft"]);

// Filters.
check("filter parse: mark", parseAttentionFilter("mark"), "mark");
check("filter parse: unknown → all", parseAttentionFilter("unpaid"), "all");
check("filter parse: missing → all", parseAttentionFilter(undefined), "all");
check("filter parse: array takes first", parseAttentionFilter(["draft", "mark"]), "draft");
check("filter all keeps every row", filterRows(rows, "all").length, 5);
check("filter due", filterRows(rows, "due").map((r) => r.id), ["u1", "u2"]);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
