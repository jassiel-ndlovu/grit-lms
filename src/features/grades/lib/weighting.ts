/**
 * Weighted course marks. Pure — no Prisma, no I/O.
 *
 * Every assessment in a course (a Test or a Submission) can carry an
 * explicit `weight`: its percentage share of the final mark. Weighting is
 * opt-in, so the two ends of the range both have to behave sensibly:
 *
 *   - Tutor sets nothing      → every assessment is weighted by its
 *                               totalPoints, which is exactly a plain
 *                               "add up the marks" course total.
 *   - Tutor weights some      → those take their stated share and the
 *                               REMAINDER is divided among the rest, still
 *                               in proportion to points.
 *   - Tutor weights all       → their numbers are used verbatim. If they
 *                               don't add to 100 we say so rather than
 *                               silently rescaling, because a tutor who
 *                               typed 30/30/30 means 90, not 100.
 *
 * Marks in progress: a student is only measured against what has actually
 * been graded. `markToDate` renormalises over the graded share so a class
 * three weeks into term doesn't read as though everyone is failing, while
 * `markOfCourse` is the honest running total against the whole course.
 * Both are reported; the UI labels them.
 */

export type AssessmentKind = "test" | "assignment";

export interface WeightedAssessment {
  id: string;
  kind: AssessmentKind;
  title: string;
  /** Marks available on the assessment itself. Used for the points-based fallback. */
  totalPoints: number;
  /** Explicit percentage share, or null to derive one from points. */
  weight: number | null;
  dueDate: Date;
}

export interface AssessmentWithWeight extends WeightedAssessment {
  /** Percentage of the final course mark this assessment actually carries. */
  effectiveWeight: number;
  /** True when effectiveWeight came from the tutor rather than from points. */
  explicit: boolean;
}

export interface WeightPlan {
  assessments: AssessmentWithWeight[];
  /** Sum of the tutor's explicit weights. */
  explicitTotal: number;
  /** Share left over for assessments with no explicit weight. */
  remainingPool: number;
  /** Sum of every effective weight. 100 in a well-formed plan. */
  allocated: number;
  /**
   * Set when the plan doesn't add up to 100 and the tutor should look at
   * it. Null when the plan is fine.
   */
  warning: string | null;
}

/** A single graded result for one student on one assessment. */
export interface StudentResult {
  assessmentId: string;
  score: number;
  outOf: number;
}

export interface StudentMark {
  /**
   * Weighted percentage over the assessments graded so far, renormalised
   * to 100. Null when the student has nothing graded yet.
   */
  markToDate: number | null;
  /** Weighted percentage against the WHOLE course, ungraded counted as 0. */
  markOfCourse: number;
  /** Percentage of the course that has been graded for this student. */
  coverage: number;
  /** Per-assessment detail, in the order given. */
  rows: Array<{
    assessment: AssessmentWithWeight;
    result: StudentResult | null;
    /** Raw percentage on the assessment, or null if not graded. */
    percent: number | null;
    /** Contribution to markOfCourse, i.e. effectiveWeight * percent / 100. */
    contribution: number;
  }>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Resolve each assessment's effective weight.
 *
 * Assessments worth zero points and carrying no explicit weight can't be
 * given a points-proportional share, so they fall back to an equal split of
 * whatever the pool is — otherwise they'd silently vanish from the course.
 */
export function buildWeightPlan(
  assessments: WeightedAssessment[],
): WeightPlan {
  const explicit = assessments.filter((a) => a.weight != null);
  const implicit = assessments.filter((a) => a.weight == null);

  const explicitTotal = explicit.reduce((n, a) => n + (a.weight ?? 0), 0);
  const remainingPool = Math.max(0, 100 - explicitTotal);

  const implicitPoints = implicit.reduce((n, a) => n + Math.max(0, a.totalPoints), 0);

  const resolved: AssessmentWithWeight[] = assessments.map((a) => {
    if (a.weight != null) {
      return { ...a, effectiveWeight: a.weight, explicit: true };
    }
    if (implicit.length === 0) {
      return { ...a, effectiveWeight: 0, explicit: false };
    }
    const share =
      implicitPoints > 0
        ? (remainingPool * Math.max(0, a.totalPoints)) / implicitPoints
        : remainingPool / implicit.length;
    return { ...a, effectiveWeight: share, explicit: false };
  });

  const allocated = resolved.reduce((n, a) => n + a.effectiveWeight, 0);

  let warning: string | null = null;
  if (assessments.length === 0) {
    warning = null;
  } else if (explicitTotal > 100) {
    warning = `Explicit weights add up to ${round2(explicitTotal)}%, which is over 100%. Unweighted assessments are getting nothing.`;
  } else if (Math.abs(allocated - 100) > 0.01) {
    warning = `Weights add up to ${round2(allocated)}%, not 100%.`;
  }

  return {
    assessments: resolved,
    explicitTotal: round2(explicitTotal),
    remainingPool: round2(remainingPool),
    allocated: round2(allocated),
    warning,
  };
}

/**
 * Apply a plan to one student's results.
 *
 * A result whose `outOf` is zero or negative is treated as ungraded rather
 * than as a divide-by-zero.
 */
export function computeStudentMark(
  plan: WeightPlan,
  results: StudentResult[],
): StudentMark {
  const byAssessment = new Map(results.map((r) => [r.assessmentId, r]));

  let weightedSum = 0;
  let gradedWeight = 0;

  const rows = plan.assessments.map((assessment) => {
    const result = byAssessment.get(assessment.id) ?? null;
    const usable = result != null && result.outOf > 0;
    const percent = usable ? (result.score / result.outOf) * 100 : null;
    const contribution =
      percent != null ? (assessment.effectiveWeight * percent) / 100 : 0;

    if (percent != null) {
      weightedSum += contribution;
      gradedWeight += assessment.effectiveWeight;
    }

    return {
      assessment,
      result,
      percent: percent != null ? round2(percent) : null,
      contribution: round2(contribution),
    };
  });

  return {
    markToDate:
      gradedWeight > 0 ? round2((weightedSum / gradedWeight) * 100) : null,
    markOfCourse: round2(weightedSum),
    coverage: round2(gradedWeight),
    rows,
  };
}

/* ─── Class-level summary ──────────────────────────────────────────────── */

export interface ClassStats {
  /** Students with at least one graded assessment. */
  gradedStudents: number;
  totalStudents: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  /** Count of marks in each 10-point band, index 0 = 0-9 … index 9 = 90-100. */
  distribution: number[];
}

/**
 * Summarise a set of student marks. Students with nothing graded are
 * counted in `totalStudents` but excluded from every statistic — averaging
 * them in as zero would misreport the class.
 */
export function summariseClass(marks: Array<StudentMark>): ClassStats {
  const values = marks
    .map((m) => m.markToDate)
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);

  const distribution = new Array(10).fill(0) as number[];
  for (const v of values) {
    const band = Math.min(9, Math.max(0, Math.floor(v / 10)));
    distribution[band] += 1;
  }

  if (values.length === 0) {
    return {
      gradedStudents: 0,
      totalStudents: marks.length,
      mean: null,
      median: null,
      min: null,
      max: null,
      distribution,
    };
  }

  const sum = values.reduce((n, v) => n + v, 0);
  const mid = Math.floor(values.length / 2);
  const median =
    values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];

  return {
    gradedStudents: values.length,
    totalStudents: marks.length,
    mean: round2(sum / values.length),
    median: round2(median),
    min: values[0],
    max: values[values.length - 1],
    distribution,
  };
}

/**
 * Class average on a single assessment, as a percentage. Null when nobody
 * has been graded on it yet.
 */
export function assessmentAverage(
  assessmentId: string,
  resultsByStudent: StudentResult[][],
): number | null {
  const percents: number[] = [];
  for (const results of resultsByStudent) {
    const r = results.find((x) => x.assessmentId === assessmentId);
    if (r && r.outOf > 0) percents.push((r.score / r.outOf) * 100);
  }
  if (percents.length === 0) return null;
  return round2(percents.reduce((n, v) => n + v, 0) / percents.length);
}
