/**
 * Curriculum topics (#216, phase 2: CAPS and IEB tagging with a coverage
 * map). Contract: docs/revamp/contracts/curriculum.md.
 *
 * A course names its curriculum, subject and grade; its lessons and test
 * questions carry topic codes from the catalogue below:
 *
 *   caps:<subject>:<grade>:<topic>      e.g. caps:mathematics:10:functions
 *
 * The catalogue lives in code, versioned with the app: a new subject or a
 * renamed topic needs no migration. Codes never change once shipped; a
 * retired topic stays readable (topicByCode) but isn't offered.
 *
 * IEB follows the CAPS content for these subjects, so an IEB course uses
 * the CAPS list. "Other" curricula have no catalogue yet.
 *
 * Pure: safe in server and client components and in scripts.
 */

export const CURRICULA = ["CAPS", "IEB", "OTHER"] as const;
export type Curriculum = (typeof CURRICULA)[number];

export const CURRICULUM_LABEL: Record<Curriculum, string> = {
  CAPS: "CAPS",
  IEB: "IEB",
  OTHER: "Something else",
};

export type Topic = { code: string; title: string; subject: string; grade: number; order: number };

type SubjectDef = { key: string; title: string; grades: Record<number, string[]> };

/**
 * CAPS Further Education and Training (Grades 10 to 12). Topic lists follow
 * the CAPS document's topics per grade, in teaching order.
 */
const SUBJECTS: SubjectDef[] = [
  {
    key: "mathematics",
    title: "Mathematics",
    grades: {
      10: [
        "Algebraic expressions",
        "Exponents",
        "Number patterns",
        "Equations and inequalities",
        "Trigonometry",
        "Functions",
        "Euclidean geometry",
        "Analytical geometry",
        "Finance and growth",
        "Statistics",
        "Measurement",
        "Probability",
      ],
      11: [
        "Exponents and surds",
        "Equations and inequalities",
        "Number patterns",
        "Analytical geometry",
        "Functions",
        "Trigonometry",
        "Measurement",
        "Euclidean geometry",
        "Finance, growth and decay",
        "Probability",
        "Statistics",
      ],
      12: [
        "Number patterns, sequences and series",
        "Functions and inverse functions",
        "Finance, growth and decay",
        "Trigonometry",
        "Polynomials",
        "Differential calculus",
        "Analytical geometry",
        "Euclidean geometry",
        "Statistics",
        "Counting and probability",
      ],
    },
  },
];

/** "Finance, growth and decay" → "finance-growth-and-decay". */
export function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const CATALOGUE: Topic[] = SUBJECTS.flatMap((s) =>
  Object.entries(s.grades).flatMap(([g, titles]) =>
    titles.map((title, i) => ({ code: `caps:${s.key}:${g}:${slug(title)}`, title, subject: s.key, grade: Number(g), order: i })),
  ),
);
const BY_CODE = new Map(CATALOGUE.map((t) => [t.code, t]));

export const SUBJECT_OPTIONS = SUBJECTS.map((s) => ({ key: s.key, title: s.title, grades: Object.keys(s.grades).map(Number) }));

export const subjectTitle = (key: string | null | undefined) => SUBJECTS.find((s) => s.key === key)?.title ?? null;

export const topicByCode = (code: string): Topic | null => BY_CODE.get(code) ?? null;

/** A course's curriculum settings, as stored on Course. */
export type CourseCurriculum = { curriculum: Curriculum | null; subject: string | null; gradeLevel: number | null };

/** The topics a course can tag, in teaching order; empty when it has no catalogue. */
export function topicsFor(c: CourseCurriculum | null | undefined): Topic[] {
  if (!c || (c.curriculum !== "CAPS" && c.curriculum !== "IEB") || !c.subject || c.gradeLevel == null) return [];
  return CATALOGUE.filter((t) => t.subject === c.subject && t.grade === c.gradeLevel);
}

export const MAX_TOPICS = 10;

/** Topic codes to store: known codes only, no repeats, at most MAX_TOPICS, in the order given. */
export function topicsToStore(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === "string" && BY_CODE.has(v) && !out.includes(v)) out.push(v);
    if (out.length === MAX_TOPICS) break;
  }
  return out;
}

/** The curriculum settings to store from a form; anything incomplete or unknown becomes null. */
export function curriculumToStore(raw: { curriculum?: unknown; subject?: unknown; gradeLevel?: unknown }): CourseCurriculum {
  const curriculum = (CURRICULA as readonly unknown[]).includes(raw.curriculum) ? (raw.curriculum as Curriculum) : null;
  if (!curriculum) return { curriculum: null, subject: null, gradeLevel: null };
  if (curriculum === "OTHER") return { curriculum, subject: null, gradeLevel: null };
  const subject = SUBJECTS.find((s) => s.key === raw.subject);
  const grade = Number(raw.gradeLevel);
  return {
    curriculum,
    subject: subject?.key ?? null,
    gradeLevel: subject && Number.isInteger(grade) && grade in subject.grades ? grade : null,
  };
}

/** "CAPS · Mathematics · Grade 10", or null when nothing is set. */
export function curriculumLabel(c: CourseCurriculum | null | undefined): string | null {
  if (!c?.curriculum) return null;
  return [CURRICULUM_LABEL[c.curriculum], subjectTitle(c.subject), c.gradeLevel != null ? `Grade ${c.gradeLevel}` : null]
    .filter(Boolean)
    .join(" · ");
}

export type CoverageRow = { topic: Topic; lessons: number; questions: number; marks: number };

/**
 * Coverage of a course's topics: how many lessons and questions carry each,
 * and the marks those questions are worth. Codes outside the course's list
 * are ignored here.
 */
export function coverage(
  topics: Topic[],
  lessons: Array<{ topics: string[] }>,
  questions: Array<{ topics: string[]; points: number }>,
): CoverageRow[] {
  return topics.map((topic) => ({
    topic,
    lessons: lessons.filter((l) => l.topics.includes(topic.code)).length,
    questions: questions.filter((q) => q.topics.includes(topic.code)).length,
    marks: questions.filter((q) => q.topics.includes(topic.code)).reduce((n, q) => n + q.points, 0),
  }));
}
