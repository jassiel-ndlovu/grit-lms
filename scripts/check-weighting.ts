import {
  buildWeightPlan,
  computeStudentMark,
  summariseClass,
  assessmentAverage,
  type WeightedAssessment,
} from "../src/features/grades/lib/weighting";

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

const d = new Date("2026-01-01");
function a(
  id: string,
  totalPoints: number,
  weight: number | null = null,
): WeightedAssessment {
  return { id, kind: "test", title: id, totalPoints, weight, dueDate: d };
}

/* ─── Default behaviour: no weights at all ─────────────────────────────── */

const plainPlan = buildWeightPlan([a("t1", 50), a("t2", 30), a("t3", 20)]);
check(
  "no weights -> split by points",
  plainPlan.assessments.map((x) => x.effectiveWeight),
  [50, 30, 20],
);
check("no weights -> allocates 100%", plainPlan.allocated, 100);
check("no weights -> no warning", plainPlan.warning, null);

// A points-weighted plan must agree with a plain marks total.
const plainMark = computeStudentMark(plainPlan, [
  { assessmentId: "t1", score: 40, outOf: 50 },
  { assessmentId: "t2", score: 15, outOf: 30 },
  { assessmentId: "t3", score: 20, outOf: 20 },
]);
// raw: 75/100 marks = 75%
check("points-weighted matches a raw marks total", plainMark.markOfCourse, 75);
check("full coverage", plainMark.coverage, 100);
check("markToDate equals markOfCourse when fully graded", plainMark.markToDate, 75);

/* ─── Partial explicit weights ─────────────────────────────────────────── */

const mixed = buildWeightPlan([
  a("exam", 100, 60), // explicit 60%
  a("h1", 30), // share the remaining 40% by points...
  a("h2", 10), // ...30:10, so 30% and 10%
]);
check(
  "explicit weight respected, remainder split by points",
  mixed.assessments.map((x) => x.effectiveWeight),
  [60, 30, 10],
);
check("mixed plan allocates 100%", mixed.allocated, 100);
check("mixed plan has no warning", mixed.warning, null);

/* ─── All explicit, not adding to 100 ──────────────────────────────────── */

const short = buildWeightPlan([a("x", 10, 30), a("y", 10, 30), a("z", 10, 30)]);
check("under-allocated plan is reported, not rescaled", short.allocated, 90);
check(
  "under-allocated warning",
  short.warning,
  "Weights add up to 90%, not 100%.",
);

const over = buildWeightPlan([a("x", 10, 70), a("y", 10, 60)]);
check("over-allocated plan is reported", over.explicitTotal, 130);
check(
  "over-allocated warning mentions unweighted starvation",
  over.warning?.includes("over 100%"),
  true,
);

/* ─── Explicit weights leave nothing for the rest ──────────────────────── */

const starved = buildWeightPlan([a("x", 10, 100), a("y", 10)]);
check(
  "unweighted gets 0 when explicit weights take everything",
  starved.assessments.map((x) => x.effectiveWeight),
  [100, 0],
);

/* ─── Partially graded student ─────────────────────────────────────────── */

const partial = computeStudentMark(mixed, [
  { assessmentId: "h1", score: 27, outOf: 30 }, // 90% of a 30% item
]);
check("markOfCourse counts ungraded as zero", partial.markOfCourse, 27);
check("markToDate renormalises over graded weight", partial.markToDate, 90);
check("coverage reflects graded share", partial.coverage, 30);

/* ─── Degenerate inputs ────────────────────────────────────────────────── */

const zeroOutOf = computeStudentMark(plainPlan, [
  { assessmentId: "t1", score: 0, outOf: 0 },
]);
check("outOf of zero is treated as ungraded", zeroOutOf.markToDate, null);
check("no grades -> markToDate null", zeroOutOf.coverage, 0);

const zeroPoints = buildWeightPlan([a("p", 0), a("q", 0)]);
check(
  "zero-point assessments split the pool evenly",
  zeroPoints.assessments.map((x) => x.effectiveWeight),
  [50, 50],
);

check("empty course produces no warning", buildWeightPlan([]).warning, null);

/* ─── Class summary ────────────────────────────────────────────────────── */

const marks = [
  computeStudentMark(plainPlan, [{ assessmentId: "t1", score: 45, outOf: 50 }]), // 90
  computeStudentMark(plainPlan, [{ assessmentId: "t1", score: 25, outOf: 50 }]), // 50
  computeStudentMark(plainPlan, [{ assessmentId: "t1", score: 35, outOf: 50 }]), // 70
  computeStudentMark(plainPlan, []), // nothing graded
];
const stats = summariseClass(marks);
check("ungraded students excluded from the mean", stats.mean, 70);
check("median of three marks", stats.median, 70);
check("min / max", [stats.min, stats.max], [50, 90]);
check("graded vs total students", [stats.gradedStudents, stats.totalStudents], [3, 4]);
check("distribution bands", [stats.distribution[5], stats.distribution[7], stats.distribution[9]], [1, 1, 1]);
check("100% lands in the top band", summariseClass([
  computeStudentMark(plainPlan, [{ assessmentId: "t1", score: 50, outOf: 50 }]),
]).distribution[9], 1);

/* ─── Per-assessment average ───────────────────────────────────────────── */

check(
  "assessment average ignores students without that result",
  assessmentAverage("t1", [
    [{ assessmentId: "t1", score: 40, outOf: 50 }],
    [{ assessmentId: "t2", score: 10, outOf: 30 }],
    [{ assessmentId: "t1", score: 30, outOf: 50 }],
  ]),
  70,
);
check("assessment average with nobody graded", assessmentAverage("zzz", [[]]), null);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
