/**
 * Translating between a runner answer and a question's stored answer key.
 * Pure — no Prisma, no I/O.
 *
 * The tutor preview reuses the student runner verbatim, so whatever the
 * tutor types comes back in exactly the shape a student's answer would
 * take. Saving that as the memo means mapping it onto the right column,
 * which is not the same column for every type:
 *
 *   MATCHING  the key IS `matchPairs` — the pairing the tutor chose
 *   REORDER   the key IS `reorderItems` — the order the tutor put them in
 *   the rest  the key lives in the `answer` JSON column
 *
 * Both directions live here so preview seeding and preview saving can't
 * drift apart: `seedAnswerFromKey` is the inverse of `answerToKeyPatch`.
 *
 * ESSAY, CODE and FILE_UPLOAD have no auto-marking, but a tutor still
 * benefits from recording a model answer — it becomes the memo they mark
 * against. Those are stored in `answer` and simply ignored by the
 * auto-grader (see lib/auto-grade.ts, which only looks at AUTO_MARKABLE).
 */

import { toFileAnswers } from "./file-answers";

export interface KeyQuestion {
  id: string;
  type: string;
  options: string[];
  matchPairs: unknown;
  reorderItems: string[];
  blankCount: number | null;
}

/** Columns a saved key may touch. Absent fields are left untouched. */
export interface AnswerKeyPatch {
  answer?: unknown;
  matchPairs?: unknown;
  reorderItems?: string[];
}

export type KeyResult =
  | { ok: true; patch: AnswerKeyPatch }
  | { ok: false; reason: string };

/** Types the tutor can record a key for at all. */
const KEYABLE = new Set([
  "MULTIPLE_CHOICE",
  "MULTI_SELECT",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "NUMERIC",
  "FILL_IN_THE_BLANK",
  "MATCHING",
  "REORDER",
  "ESSAY",
  "CODE",
  "FILE_UPLOAD",
]);

export function isKeyable(type: string): boolean {
  return KEYABLE.has(type);
}

/** Compare two lists as multisets, ignoring order. */
function sameMultiset(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const v of a) counts.set(v, (counts.get(v) ?? 0) + 1);
  for (const v of b) {
    const n = counts.get(v);
    if (!n) return false;
    counts.set(v, n - 1);
  }
  return true;
}

function asPairs(raw: unknown): Array<{ left: string; right: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is { left: string; right: string } =>
      !!p &&
      typeof p === "object" &&
      typeof (p as { left?: unknown }).left === "string" &&
      typeof (p as { right?: unknown }).right === "string",
  );
}

function asStrings(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.map((v) => (typeof v === "string" ? v : String(v ?? "")));
}

/**
 * Turn one runner answer into the DB patch that records it as the key.
 *
 * An empty answer is not an error — it clears the key, so a tutor can
 * remove a wrong memo by blanking the field. Only a *malformed* answer
 * (one that couldn't have come from this question) is rejected, because
 * writing it back would corrupt what students see.
 */
export function answerToKeyPatch(
  question: KeyQuestion,
  answer: unknown,
): KeyResult {
  const { type } = question;

  if (type === "NONE") return { ok: true, patch: {} };
  if (!isKeyable(type)) return { ok: true, patch: {} };

  switch (type) {
    case "MULTIPLE_CHOICE": {
      if (answer == null || answer === "") return { ok: true, patch: { answer: null } };
      if (typeof answer !== "string") {
        return { ok: false, reason: "expected one of the options" };
      }
      // The key has to be an option students can actually pick.
      if (question.options.length > 0 && !question.options.includes(answer)) {
        return { ok: false, reason: "the chosen answer is not one of the options" };
      }
      return { ok: true, patch: { answer } };
    }

    case "TRUE_FALSE": {
      if (answer == null || answer === "") return { ok: true, patch: { answer: null } };
      if (answer !== "true" && answer !== "false") {
        return { ok: false, reason: "expected true or false" };
      }
      return { ok: true, patch: { answer } };
    }

    case "SHORT_ANSWER":
    case "NUMERIC":
    case "ESSAY":
    case "CODE": {
      if (answer == null) return { ok: true, patch: { answer: null } };
      if (typeof answer !== "string") {
        return { ok: false, reason: "expected text" };
      }
      return {
        ok: true,
        patch: { answer: answer.trim() === "" ? null : answer },
      };
    }

    case "MULTI_SELECT": {
      const list = asStrings(answer);
      if (list == null) return { ok: true, patch: { answer: null } };
      if (list.length === 0) return { ok: true, patch: { answer: null } };
      const unknown = list.find(
        (v) => question.options.length > 0 && !question.options.includes(v),
      );
      if (unknown !== undefined) {
        return { ok: false, reason: "a selected answer is not one of the options" };
      }
      return { ok: true, patch: { answer: list } };
    }

    case "FILL_IN_THE_BLANK": {
      const list = asStrings(answer);
      if (list == null) return { ok: true, patch: { answer: null } };
      const blanks = question.blankCount ?? list.length;
      // Trailing blanks the tutor left empty are fine; a short array is not,
      // because the grader indexes positionally.
      const filled = list.slice(0, blanks);
      if (filled.every((v) => v.trim() === "")) {
        return { ok: true, patch: { answer: null } };
      }
      if (filled.length < blanks) {
        return { ok: false, reason: `expected ${blanks} blanks` };
      }
      return { ok: true, patch: { answer: filled } };
    }

    case "MATCHING": {
      const original = asPairs(question.matchPairs);
      const given = asPairs(answer);
      if (given.length === 0) return { ok: true, patch: {} };
      if (original.length === 0) {
        return { ok: false, reason: "this question has no pairs to match" };
      }
      if (given.length !== original.length) {
        return { ok: false, reason: "every row needs a match" };
      }
      if (!sameMultiset(given.map((p) => p.left), original.map((p) => p.left))) {
        return { ok: false, reason: "the left-hand items changed" };
      }
      // Rights must be a rearrangement of the rights already on the
      // question. Rejecting anything else stops a duplicate selection from
      // silently deleting one of the options students get to choose from.
      if (!sameMultiset(given.map((p) => p.right), original.map((p) => p.right))) {
        return {
          ok: false,
          reason: "each option on the right must be used exactly as often as before",
        };
      }
      // Preserve the original left-hand order so the question renders the
      // same way it did before the key was saved.
      const byLeft = new Map(given.map((p) => [p.left, p.right]));
      const ordered = original.map((p) => ({
        left: p.left,
        right: byLeft.get(p.left) ?? p.right,
      }));
      return { ok: true, patch: { matchPairs: ordered } };
    }

    case "REORDER": {
      const list = asStrings(answer);
      if (list == null || list.length === 0) return { ok: true, patch: {} };
      if (!sameMultiset(list, question.reorderItems)) {
        return { ok: false, reason: "the items changed" };
      }
      return { ok: true, patch: { reorderItems: list } };
    }

    case "FILE_UPLOAD": {
      const files = toFileAnswers(answer);
      return { ok: true, patch: { answer: files.length > 0 ? files : null } };
    }

    default:
      return { ok: true, patch: {} };
  }
}

/**
 * The inverse: what the runner should show for a question whose key is
 * already recorded, so opening the preview shows the current memo rather
 * than a blank form.
 */
export function seedAnswerFromKey(
  question: KeyQuestion & { answer: unknown },
): unknown {
  switch (question.type) {
    case "MULTIPLE_CHOICE":
    case "TRUE_FALSE":
    case "SHORT_ANSWER":
    case "NUMERIC":
    case "ESSAY":
    case "CODE":
      return typeof question.answer === "string"
        ? question.answer
        : question.answer == null
          ? undefined
          : String(question.answer);

    case "MULTI_SELECT":
    case "FILL_IN_THE_BLANK":
      return Array.isArray(question.answer) ? question.answer : undefined;

    case "MATCHING": {
      const pairs = asPairs(question.matchPairs);
      return pairs.length > 0 ? pairs : undefined;
    }

    case "REORDER":
      return question.reorderItems.length > 0 ? question.reorderItems : undefined;

    case "FILE_UPLOAD": {
      const files = toFileAnswers(question.answer);
      return files.length > 0 ? files : undefined;
    }

    default:
      return undefined;
  }
}

/**
 * Seed the whole runner answer record from a flat question list. Questions
 * with no key recorded are simply absent, which the runner reads as
 * unanswered.
 */
export function seedAnswersFromKeys(
  questions: Array<KeyQuestion & { answer: unknown }>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const q of questions) {
    const seeded = seedAnswerFromKey(q);
    if (seeded !== undefined) out[q.id] = seeded;
  }
  return out;
}
