/**
 * The course study assistant (#216 phase 3, Pro): the pure parts, covered
 * by scripts/check-study.ts. Picking course material, limits and the
 * shape of an answer.
 */

export const STUDY_LIMITS = {
  /** Questions a student may ask per course per day. */
  perStudentDay: 25,
  /** Characters of course material sent with a question (about 15k tokens). */
  materialChars: 60_000,
  /** Earlier turns kept for context. */
  historyTurns: 6,
  questionChars: 1_500,
  /** Chats are kept this long, then deleted. */
  keepDays: 365,
} as const;

export type LessonText = { ref: string; id: string; title: string; text: string; order: number };

const STOP = new Set("the a an and or of to in on for is are was were be how what why when which who do does i my me you it this that with as at by from can".split(" "));
export function words(s: string): string[] {
  return s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * The material to send: every lesson when it all fits (a stable prefix,
 * so it caches across questions), otherwise the lessons that share the
 * most words with the question (and the recent turns), best first, until
 * the limit. Order within the result follows the course.
 */
export function pickMaterial(lessons: LessonText[], question: string, limit: number = STUDY_LIMITS.materialChars): { lessons: LessonText[]; all: boolean } {
  const size = (l: LessonText) => l.title.length + l.text.length + 40;
  const total = lessons.reduce((n, l) => n + size(l), 0);
  if (total <= limit) return { lessons: [...lessons].sort((a, b) => a.order - b.order), all: true };
  const q = new Set(words(question));
  const scored = lessons.map((l) => {
    const t = words(`${l.title} ${l.title} ${l.text}`);
    let hits = 0;
    for (const w of t) if (q.has(w)) hits++;
    return { l, score: t.length ? hits / Math.sqrt(t.length) : 0 };
  }).sort((a, b) => b.score - a.score || a.l.order - b.l.order);
  const out: LessonText[] = [];
  let used = 0;
  for (const { l } of scored) {
    if (used + size(l) > limit) {
      // Room for a cut-down copy of a long, relevant lesson?
      const room = limit - used - l.title.length - 60;
      if (room > 2000 && out.length < 3) { out.push({ ...l, text: `${l.text.slice(0, room)}…` }); used = limit; }
      continue;
    }
    out.push(l);
    used += size(l);
  }
  return { lessons: out.sort((a, b) => a.order - b.order), all: false };
}

export type Concern = "none" | "wellbeing" | "safety" | "integrity";

/** What to do with a model's concern flag: wellbeing and safety alert the tutor; integrity is noted. */
export function concernAction(c: Concern): "none" | "note" | "alert" {
  return c === "wellbeing" || c === "safety" ? "alert" : c === "integrity" ? "note" : "none";
}

/** Keeps only citations to lessons that were sent. */
export function validCitations(refs: string[], sent: LessonText[]): Array<{ ref: string; lessonId: string; title: string }> {
  const byRef = new Map(sent.map((l) => [l.ref, l]));
  const out: Array<{ ref: string; lessonId: string; title: string }> = [];
  for (const r of refs) {
    const l = byRef.get(r);
    if (l && !out.some((o) => o.ref === r)) out.push({ ref: r, lessonId: l.id, title: l.title });
  }
  return out;
}
