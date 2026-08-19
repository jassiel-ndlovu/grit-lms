/**
 * Test import/export IO — pure, no I/O side-effects.
 *
 * The `TEST_JSON_GUIDE` string is what tutors copy to paste into an LLM
 * conversation. If you change the accepted shape below, update the guide
 * so LLMs generate matching JSON.
 *
 * The Zod schema in `TestImportSchema` is the source of truth for what
 * `parseTestJson` will accept.
 */

import { z } from "zod";

import type {
  CreateTestQuestionTree,
  CreateTestWithQuestionsInput,
} from "../schemas";
import type { TestDetail } from "../queries";

/* ------------------------------------------------------------------------- */
/* Import schema                                                              */
/* ------------------------------------------------------------------------- */

const QUESTION_TYPES = [
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "ESSAY",
  "FILE_UPLOAD",
  "MULTI_SELECT",
  "CODE",
  "MATCHING",
  "REORDER",
  "FILL_IN_THE_BLANK",
  "NUMERIC",
  "NONE",
] as const;

const MatchPairSchema = z.object({
  left: z.string(),
  right: z.string(),
});

// Question schema is recursive; declare the TS type first, then z.lazy().
type ImportQuestion = {
  type: (typeof QUESTION_TYPES)[number];
  question: string;
  points?: number;
  options?: string[];
  answer?: unknown;
  language?: string | null;
  matchPairs?: Array<{ left: string; right: string }> | null;
  reorderItems?: string[];
  blankCount?: number | null;
  subQuestions?: ImportQuestion[];
};

const ImportQuestionSchema: z.ZodType<ImportQuestion> = z.lazy(() =>
  z.object({
    type: z.enum(QUESTION_TYPES),
    question: z.string(),
    points: z.number().int().nonnegative().optional(),
    options: z.array(z.string()).optional(),
    answer: z.unknown().optional(),
    language: z.string().nullable().optional(),
    matchPairs: z.array(MatchPairSchema).optional(),
    reorderItems: z.array(z.string()).optional(),
    blankCount: z.number().int().positive().nullable().optional(),
    subQuestions: z.array(ImportQuestionSchema).optional(),
  }),
);

export const TestImportSchema = z.object({
  version: z.literal(1),
  title: z.string().min(1, "title required"),
  description: z.string().default(""),
  // Accept any string that Date can parse (ISO 8601 preferred).
  dueDate: z.string().min(1, "dueDate required"),
  timeLimit: z.number().int().positive().nullable().default(null),
  isActive: z.boolean().default(false),
  releaseAutoMarksToStudent: z.boolean().default(false),
  preTestInstructions: z.string().nullable().default(null),
  questions: z.array(ImportQuestionSchema).default([]),
});
export type TestImportInput = z.infer<typeof TestImportSchema>;

/* ------------------------------------------------------------------------- */
/* parseTestJson — accepts a raw string or object, returns a payload that    */
/* can be spread into createTest() alongside a courseId chosen by the tutor. */
/* ------------------------------------------------------------------------- */

export interface ParsedTestPayload {
  title: string;
  description: string;
  preTestInstructions: string | null;
  dueDate: Date;
  timeLimit: number | null;
  totalPoints: number;
  isActive: boolean;
  releaseAutoMarksToStudent: boolean;
  questions: CreateTestQuestionTree[];
}

/**
 * Recursively convert an import-shape question into the createTest tree
 * shape. Fills in sensible defaults for missing optional fields so the
 * downstream action never has to handle undefined for arrays.
 */
function toCreateTree(q: ImportQuestion): CreateTestQuestionTree {
  return {
    question: q.question,
    type: q.type,
    points: q.points ?? (q.type === "NONE" ? 0 : 1),
    options: q.options ?? [],
    answer: q.answer,
    language: q.language ?? null,
    matchPairs: q.matchPairs ?? null,
    reorderItems: q.reorderItems ?? [],
    blankCount: q.blankCount ?? null,
    subQuestions: (q.subQuestions ?? []).map(toCreateTree),
  }; 
}

function sumPoints(qs: CreateTestQuestionTree[]): number {
  let n = 0;
  for (const q of qs) {
    if (q.type !== "NONE") n += q.points;
    n += sumPoints(q.subQuestions ?? []);
  }
  return n;
}

/**
 * Parse a raw JSON string (or already-parsed object) into a payload ready
 * to hand to `createTest`. Throws with a helpful message on bad input.
 */
export function parseTestJson(input: string | unknown): ParsedTestPayload {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch (e) {
      throw new Error(
        `Invalid JSON: ${e instanceof Error ? e.message : "parse failed"}`,
      );
    }
  }
  const parsed = TestImportSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(
      `Test JSON is invalid at ${first.path.join(".") || "(root)"}: ${first.message}`,
    );
  }
  const data = parsed.data;

  const dueDate = new Date(data.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    throw new Error(`dueDate is not a valid date: ${data.dueDate}`);
  }

  const questions = data.questions.map(toCreateTree);

  return {
    title: data.title,
    description: data.description,
    preTestInstructions: data.preTestInstructions,
    dueDate,
    timeLimit: data.timeLimit,
    totalPoints: sumPoints(questions),
    isActive: data.isActive,
    releaseAutoMarksToStudent: data.releaseAutoMarksToStudent,
    questions,
  };
}

/**
 * Convenience helper — layers the courseId onto a parsed payload so it
 * matches the createTest action's input shape exactly.
 */
export function toCreateInput(
  parsed: ParsedTestPayload,
  courseId: string,
): CreateTestWithQuestionsInput {
  return {
    ...parsed,
    courseId,
  };
}

/* ------------------------------------------------------------------------- */
/* serializeTest — turn a TestDetail from the DB into the exchange shape.    */
/* ------------------------------------------------------------------------- */

type SerializedQuestion = {
  type: ( typeof QUESTION_TYPES)[number];
  question: string;
  points: number;
  options: string[];
  answer: unknown;
  language: string | null;
  matchPairs: Array<{ left: string; right: string }> | null;
  reorderItems: string[];
  blankCount: number | null;
  subQuestions: SerializedQuestion[];
};

function serializeQuestion(
  q: TestDetail["questions"][number],
  byParent: Map<string | null, TestDetail["questions"]>,
): SerializedQuestion {
  const children = (byParent.get(q.id) ?? []).sort(
    (a, b) =>
      (a.order ?? 0) - (b.order ?? 0) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
  return {
    type: q.type,
    question: q.question,
    points: q.points,
    options: q.options,
    answer: q.answer,
    language: q.language,
    matchPairs: Array.isArray(q.matchPairs)
      ? (q.matchPairs as Array<{ left: string; right: string }>)
      : null,
    reorderItems: q.reorderItems,
    blankCount: q.blankCount,
    subQuestions: children.map((c) => serializeQuestion(c, byParent)),
  };
}

/**
 * Produce a fully-serializable object matching TestImportSchema so
 * round-tripping is safe: export → save → import → same test.
 */
export function serializeTest(test: TestDetail): TestImportInput & {
  questions: SerializedQuestion[];
} {
  // Group children by parentId so we can build the tree without an extra
  // Prisma query per level.
  const byParent = new Map<string | null, TestDetail["questions"]>();
  for (const q of test.questions) {
    const key = q.parentId ?? null;
    const list = byParent.get(key);
    if (list) list.push(q);
    else byParent.set(key, [q]);
  }
  for (const list of byParent.values()) {
    list.sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }
  const top = (byParent.get(null) ?? []).map((q) => serializeQuestion(q, byParent));

  return {
    version: 1,
    title: test.title,
    description: test.description,
    // ISO string round-trips cleanly through JSON and Date.
    dueDate: test.dueDate.toISOString(),
    timeLimit: test.timeLimit,
    isActive: test.isActive,
    // Cast: field exists in schema.prisma; `prisma generate` will surface
    // it on the TestDetail type. Widen to unknown here until the client is
    // regenerated to keep tsc quiet.
    releaseAutoMarksToStudent:
      (test as unknown as { releaseAutoMarksToStudent?: boolean })
        .releaseAutoMarksToStudent ?? false,
    preTestInstructions: test.preTestInstructions,
    questions: top,
  };
}

/* ------------------------------------------------------------------------- */
/* LLM prompt guide                                                           */
/* ------------------------------------------------------------------------- */

/**
 * A copy-paste prompt tutors give to an LLM to generate importable tests.
 * Keep this in sync with TestImportSchema above — if you rename a field
 * or add a type, update this string.
 */
export const TEST_JSON_GUIDE = `# Nexa LMS — Test JSON format

Please produce ONLY a single JSON object that matches the schema below.
Do not wrap in markdown or add commentary; the value will be pasted into an
importer that runs \`JSON.parse\` directly.

## Rendering

Question text, options, and feedback are rendered with **react-markdown** +
**MathJax v3**. That means:

- Markdown works: **bold**, *italic*, lists, tables, links, fenced code.
- Inline LaTeX: \`$x^2 + 2x + 1$\` or \`\\(x^2 + 2x + 1\\)\`
- Display LaTeX: \`$$\\int_0^1 x^2\\,dx$$\` or \`\\[ ... \\]\`
- Literal \`$\` in fenced code is fine — code/pre blocks are skipped by MathJax.

## Root object

\`\`\`json
{
  "version": 1,
  "title": "string, required",
  "description": "string (may be empty)",
  "dueDate": "ISO 8601 datetime, e.g. 2025-12-31T23:59:00Z",
  "timeLimit": 60,             // integer minutes, or null for untimed
  "isActive": false,           // true = publish, false = draft
  "releaseAutoMarksToStudent": false, // true = auto-marks visible to students on submit
  "preTestInstructions": null, // string or null
  "questions": [ Question, ... ]
}
\`\`\`

## Question object

Every question has these base fields:

\`\`\`json
{
  "type": "MULTIPLE_CHOICE",   // one of the 12 types below
  "question": "Markdown + LaTeX supported.",
  "points": 5,                  // non-negative integer (0 for NONE)
  "subQuestions": []            // optional array of nested Question objects
}
\`\`\`

Extra fields depend on the type. Only include the fields relevant to the type.

### Question types & their answer shape

| type                 | extra fields                                    | \`answer\`                                            |
|----------------------|-------------------------------------------------|-----------------------------------------------------|
| \`MULTIPLE_CHOICE\`    | \`options: string[]\`                             | string — must exactly equal one option              |
| \`MULTI_SELECT\`       | \`options: string[]\`                             | string[] — subset of options                        |
| \`TRUE_FALSE\`         | —                                               | \`"true"\` or \`"false"\` (string)                      |
| \`SHORT_ANSWER\`       | —                                               | string                                              |
| \`NUMERIC\`            | —                                               | string or number                                    |
| \`ESSAY\`              | —                                               | \`null\` (graded manually)                            |
| \`CODE\`               | \`language: string\`                              | \`null\` (graded manually)                            |
| \`FILE_UPLOAD\`        | —                                               | \`null\` (graded manually)                            |
| \`MATCHING\`           | \`matchPairs: [{left, right}, ...]\`              | \`null\` — the pairs ARE the answer key               |
| \`REORDER\`            | \`reorderItems: string[]\` (in correct order)     | \`null\` — the array ARE the answer key               |
| \`FILL_IN_THE_BLANK\`  | \`blankCount: number\`                            | string[] — one entry per blank                      |
| \`NONE\`               | —                                               | \`null\` — parent context block, must have subQuestions |

## Sub-questions

Any question may nest \`subQuestions\`. Use type \`NONE\` on a parent to
mark it as **context only** (no answer, no points) — the sub-questions
underneath carry the graded work. Sub-questions must NOT themselves be
type \`NONE\`.

## Full example

\`\`\`json
{
  "version": 1,
  "title": "Calculus review",
  "description": "Chapter 3 self-check.",
  "dueDate": "2025-12-31T23:59:00Z",
  "timeLimit": 45,
  "isActive": false,
  "preTestInstructions": "You may use a calculator. Show your work in the essay questions.",
  "questions": [
    {
      "type": "MULTIPLE_CHOICE",
      "question": "What is the derivative of $f(x) = x^3$?",
      "points": 2,
      "options": ["$3x^2$", "$x^2$", "$3x$", "$x^4/4$"],
      "answer": "$3x^2$",
      "subQuestions": []
    },
    {
      "type": "NONE",
      "question": "Consider the function $g(x) = 2x^2 - 4x + 1$.",
      "points": 0,
      "subQuestions": [
        {
          "type": "SHORT_ANSWER",
          "question": "What is $g'(x)$?",
          "points": 2,
          "answer": "4x - 4",
          "subQuestions": []
        },
        {
          "type": "NUMERIC",
          "question": "At what $x$ value is the minimum of $g$?",
          "points": 3,
          "answer": 1,
          "subQuestions": []
        }
      ]
    },
    {
      "type": "MATCHING",
      "question": "Match each function to its derivative.",
      "points": 4,
      "matchPairs": [
        { "left": "$\\sin(x)$", "right": "$\\cos(x)$" },
        { "left": "$\\cos(x)$", "right": "$-\\sin(x)$" },
        { "left": "$e^x$",       "right": "$e^x$" }
      ],
      "answer": null,
      "subQuestions": []
    },
    {
      "type": "ESSAY",
      "question": "Explain the geometric meaning of the derivative in one paragraph.",
      "points": 5,
      "answer": null,
      "subQuestions": []
    }
  ]
}
\`\`\`

## Rules recap

- Emit only JSON — no prose, no code fence, no trailing commas.
- Every question needs a \`type\`, \`question\`, and \`points\` field.
- \`NONE\` questions must have children; other questions must not use type \`NONE\`.
- Answer shapes must match the type. Wrong shapes are rejected.
- Points is auto-summed on import; you can set 0 on \`NONE\` questions.
- Escape LaTeX in JSON strings with double backslashes, e.g. \`\\sin(x)\\ \`.
`;
