import {
  choiceSeed,
  seededShuffle,
  shuffleAwayFromOriginal,
} from "../src/features/assessments/lib/shuffle";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok && detail !== undefined) console.log(`        ${JSON.stringify(detail)}`);
}

const opts = ["A", "B", "C", "D", "E"];

const s1 = seededShuffle(opts, choiceSeed("attempt-1", "q1"));
check("same seed → same order (stable across reloads)",
  JSON.stringify(s1) === JSON.stringify(seededShuffle(opts, choiceSeed("attempt-1", "q1"))));
check("keeps every option exactly once", [...s1].sort().join() === opts.join(), s1);
check("input array is not mutated", opts.join() === "A,B,C,D,E");

// Across many attempts the orders should genuinely vary.
const orders = new Set<string>();
const firsts = new Map<string, number>();
for (let i = 0; i < 400; i++) {
  const o = seededShuffle(opts, choiceSeed(`attempt-${i}`, "q1"));
  orders.add(o.join());
  firsts.set(o[0], (firsts.get(o[0]) ?? 0) + 1);
}
check("different attempts get different orders", orders.size > 50, orders.size);
check("every option leads sometimes (no fixed first choice)",
  opts.every((o) => (firsts.get(o) ?? 0) > 30), Object.fromEntries(firsts));

check("different questions in one attempt differ",
  seededShuffle(opts, choiceSeed("a", "q1")).join() !== seededShuffle(opts, choiceSeed("a", "q2")).join()
  || seededShuffle(opts, choiceSeed("a", "q3")).join() !== seededShuffle(opts, choiceSeed("a", "q1")).join());

// REORDER must never start in the correct order.
let leaked = 0;
for (let i = 0; i < 2000; i++) {
  const items = ["first", "second"];
  if (shuffleAwayFromOriginal(items, `s${i}`).join() === items.join()) leaked++;
  const five = ["1", "2", "3", "4", "5"];
  if (shuffleAwayFromOriginal(five, `t${i}`).join() === five.join()) leaked++;
}
check("reorder never shows the answer order", leaked === 0, leaked);
check("single item reorder is left alone", shuffleAwayFromOriginal(["x"], "s").join() === "x");
check("identical items don't loop", shuffleAwayFromOriginal(["x", "x"], "s").join() === "x,x");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
