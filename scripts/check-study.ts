/**
 * The course study assistant (#216 phase 3): choosing course material,
 * concern handling and citations. Pure.
 *
 *   npx tsx scripts/check-study.ts
 */

import { concernAction, pickMaterial, validCitations, words, type LessonText } from "../src/features/study/study-rules";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const L = (n: number, title: string, text: string): LessonText => ({ ref: `L${n}`, id: `l${n}`, title, text, order: n });
const small = [L(2, "Momentum", "p = mv. Impulse is change in momentum."), L(1, "Newton's laws", "F = ma. Inertia.")];
const all = pickMaterial(small, "what is momentum?");
check("everything fits: all lessons, in course order", [all.all, all.lessons.map((l) => l.ref)], [true, ["L1", "L2"]]);

const filler = (w: string) => `${w} `.repeat(6000);
const big = [
  L(1, "Vectors", filler("vector direction magnitude")),
  L(2, "Momentum", filler("momentum impulse collision mass velocity")),
  L(3, "Electric circuits", filler("current resistance voltage circuit")),
];
const picked = pickMaterial(big, "How does momentum change in a collision?", 60_000);
check("too big: picks the relevant lesson first", [picked.all, picked.lessons[0].ref], [false, "L2"]);
check("never over the limit", picked.lessons.reduce((n, l) => n + l.title.length + l.text.length + 40, 0) <= 60_000 + 100, true);
check("words drop stop words and punctuation", words("What is the net force, F = ma?"), ["net", "force"]);

check("concerns", [concernAction("none"), concernAction("integrity"), concernAction("wellbeing"), concernAction("safety")], ["none", "note", "alert", "alert"]);
check("citations only to lessons sent, once each", validCitations(["L2", "L9", "L2", "L1"], small), [{ ref: "L2", lessonId: "l2", title: "Momentum" }, { ref: "L1", lessonId: "l1", title: "Newton's laws" }]);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
