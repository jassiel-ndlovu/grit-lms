import {
  DEFAULT_LABEL_SCHEME,
  LABEL_PRESETS,
  formatLabel,
  labelTree,
  normalizeScheme,
  templateError,
} from "../src/lib/enum-labels";
import {
  buildLessonTree,
  flattenLessonTree,
  subtreeIds,
} from "../src/features/lessons/lib/lesson-tree";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  const ok = g === w;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    console.log(`        got:  ${g}`);
    console.log(`        want: ${w}`);
  }
}

const preset = (id: string) => LABEL_PRESETS.find((p) => p.id === id)!.scheme;

// The default must reproduce the labels the app showed before schemes
// existed, or every existing test silently renumbers.
check("default top", formatLabel(DEFAULT_LABEL_SCHEME, [0]), "1");
check("default sub", formatLabel(DEFAULT_LABEL_SCHEME, [1, 2]), "2.c");
check("default subsub", formatLabel(DEFAULT_LABEL_SCHEME, [0, 0, 3]), "1.a.4");
check("default beyond scheme", formatLabel(DEFAULT_LABEL_SCHEME, [0, 0, 0, 1]), "1.a.1.2");
check("empty scheme = default", formatLabel([], [1, 0]), "2.a");

check("decimal 1.1.1", formatLabel(preset("decimal"), [0, 0, 0]), "1.1.1");
check("latex level 2", formatLabel(preset("latex"), [0, 1]), "(b)");
check("latex level 3", formatLabel(preset("latex"), [0, 0, 3]), "iv.");
check("exam top", formatLabel(preset("exam"), [2]), "Question 3");
check("roman", formatLabel(preset("roman"), [3, 1]), "IV.B");

check("numeric counter ref", formatLabel(["\\arabic*", "\\arabic{1}-\\alph*"], [4, 0]), "5-a");
check("alph past z", formatLabel(["\\alph*"], [26]), "aa");
check("literal text kept", formatLabel(["Part \\Alph*:"], [0]), "Part A:");

check("normalize drops trailing blanks", normalizeScheme(["\\arabic*", "", ""]), ["\\arabic*"]);
check("normalize non-array", normalizeScheme(null), DEFAULT_LABEL_SCHEME);

check("templateError ok", templateError("\\arabic{enumi}.\\alph*"), null);
check("templateError no counter", templateError("Q") !== null, true);
check("templateError bad ref", templateError("\\arabic{foo}") !== null, true);

type N = { id: string; kids: N[] };
const tree: N[] = [
  { id: "a", kids: [{ id: "a1", kids: [] }, { id: "a2", kids: [{ id: "a2x", kids: [] }] }] },
  { id: "b", kids: [] },
];
const labels = labelTree(tree, preset("decimal"), (n) => n.id, (n) => n.kids);
check("labelTree", [...labels.entries()], [
  ["a", "1"], ["a1", "1.1"], ["a2", "1.2"], ["a2x", "1.2.1"], ["b", "2"],
]);

// Lesson tree.
const t0 = new Date("2026-01-01T00:00:00Z");
const t1 = new Date("2026-01-02T00:00:00Z");
const rows = [
  { id: "g", parentId: null, order: 0, createdAt: t0, type: "NONE" },
  { id: "l2", parentId: "g", order: 1, createdAt: t0, type: "CONTENT" },
  { id: "l1", parentId: "g", order: 0, createdAt: t1, type: "CONTENT" },
  { id: "top", parentId: null, order: 1, createdAt: t0, type: "CONTENT" },
  { id: "orphan", parentId: "gone", order: 5, createdAt: t0, type: "CONTENT" },
];
const flat = flattenLessonTree(buildLessonTree(rows), []);
check(
  "lesson tree order + labels",
  flat.map((f) => [f.lesson.id, f.label, f.depth]),
  [["g", "1", 0], ["l1", "1.a", 1], ["l2", "1.b", 1], ["top", "2", 0], ["orphan", "3", 0]],
);
check("subtreeIds", [...subtreeIds(rows, "g")].sort(), ["g", "l1", "l2"]);

const cyclic = [
  { id: "x", parentId: "y", order: 0, createdAt: t0 },
  { id: "y", parentId: "x", order: 0, createdAt: t0 },
];
check(
  "cycle doesn't hang or drop lessons",
  flattenLessonTree(buildLessonTree(cyclic), []).map((f) => f.lesson.id).sort(),
  ["x", "y"],
);

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall passed");
