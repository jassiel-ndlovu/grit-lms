/**
 * How one question reads on the student review page. Pure.
 *
 * Extracted from the page so the rules are testable: this is where "4 out
 * of 6" used to come back as `correct`, painting a partly-right answer the
 * same green as a full-mark one.
 */

export type QuestionStatus =
  | "correct"
  | "partial"
  | "wrong"
  | "pending"
  | "unanswered"
  | "context";

export interface StatusInput {
  /** NONE-typed parent blocks carry no mark of their own. */
  isContext: boolean;
  /** Did the student put anything in the box? */
  answered: boolean;
  /** The QuestionGrade row, or null when nobody has marked it yet. */
  grade: { score: number; outOf: number } | null | undefined;
}

export function questionStatusTone({
  isContext,
  answered,
  grade,
}: StatusInput): QuestionStatus {
  if (isContext) return "context";

  // No grade row yet. Either the student left it blank, or it's waiting on
  // a human — which is the normal resting state for ESSAY, CODE and
  // FILE_UPLOAD, whether or not the tutor published a model answer.
  if (!grade) return answered ? "pending" : "unanswered";

  // A question worth no marks can't be got wrong. Rare, but it used to
  // fall through to the `score === 0` branch and paint red.
  if (grade.outOf <= 0) return "correct";

  if (grade.score >= grade.outOf) return "correct";
  if (grade.score <= 0) return "wrong";
  return "partial";
}
