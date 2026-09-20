import { buildRunnerTree, type TreeRow } from "../src/features/assessments/lib/question-tree";

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

function row(over: Partial<TreeRow> & { id: string }): TreeRow {
  return {
    question: over.id,
    type: "SHORT_ANSWER",
    points: 1,
    options: [],
    language: null,
    matchPairs: null,
    reorderItems: [],
    blankCount: null,
    parentId: null,
    order: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

/** Flatten to "id(child,child)" so the shape is easy to assert on. */
function shape(nodes: ReturnType<typeof buildRunnerTree>): string {
  return nodes
    .map((n) =>
      n.subQuestions.length > 0 ? `${n.id}(${shape(n.subQuestions)})` : n.id,
    )
    .join(",");
}

check(
  "flat list keeps author order",
  shape(
    buildRunnerTree([
      row({ id: "b", order: 1 }),
      row({ id: "a", order: 0 }),
      row({ id: "c", order: 2 }),
    ]),
  ),
  "a,b,c",
);

check(
  "children nest under their parent, in order",
  shape(
    buildRunnerTree([
      row({ id: "p", order: 0, type: "NONE" }),
      row({ id: "p.b", parentId: "p", order: 1 }),
      row({ id: "p.a", parentId: "p", order: 0 }),
      row({ id: "q", order: 1 }),
    ]),
  ),
  "p(p.a,p.b),q",
);

check(
  "nesting goes deeper than one level",
  shape(
    buildRunnerTree([
      row({ id: "a", order: 0 }),
      row({ id: "a.1", parentId: "a", order: 0 }),
      row({ id: "a.1.i", parentId: "a.1", order: 0 }),
    ]),
  ),
  "a(a.1(a.1.i))",
);

check(
  "equal order falls back to creation time",
  shape(
    buildRunnerTree([
      row({ id: "late", order: 0, createdAt: new Date("2026-02-01") }),
      row({ id: "early", order: 0, createdAt: new Date("2026-01-01") }),
    ]),
  ),
  "early,late",
);

check(
  "a null order sorts as zero rather than throwing",
  shape(
    buildRunnerTree([
      row({ id: "n", order: null, createdAt: new Date("2026-01-01") }),
      row({ id: "one", order: 1 }),
    ]),
  ),
  "n,one",
);

check("empty input yields an empty tree", shape(buildRunnerTree([])), "");

// Orphans (parent missing from the payload) must not silently vanish into
// nowhere or crash — they simply don't appear at top level, which is the
// pre-existing behaviour the student page relied on.
check(
  "a row whose parent isn't present is not promoted to top level",
  shape(buildRunnerTree([row({ id: "orphan", parentId: "gone" })])),
  "",
);

// Field passthrough: the renderer depends on every type-specific column.
const built = buildRunnerTree([
  row({
    id: "m",
    type: "MATCHING",
    points: 5,
    options: ["x"],
    language: "python",
    matchPairs: [{ left: "1", right: "one" }],
    reorderItems: ["a", "b"],
    blankCount: 3,
  }),
]);
check("type-specific fields survive the build", built[0], {
  id: "m",
  question: "m",
  type: "MATCHING",
  points: 5,
  options: ["x"],
  language: "python",
  matchPairs: [{ left: "1", right: "one" }],
  reorderItems: ["a", "b"],
  blankCount: 3,
  parentId: null,
  order: 0,
  subQuestions: [],
});

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
