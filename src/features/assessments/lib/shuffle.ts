/**
 * Per-attempt shuffling of choices. Pure.
 *
 * Every student should see a test's options in their own order, so the
 * seed combines the attempt (TestSubmission id) with the question id:
 * stable for one student across reloads and re-renders, different between
 * students and between questions.
 *
 * Only presentation is shuffled. Answers are stored by option TEXT (and
 * matching answers by left-hand text), so nothing about grading, answer
 * keys or the review page depends on the order a student saw.
 */

/** 32-bit FNV-1a, enough to spread string seeds. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic Fisher–Yates shuffle (mulberry32 PRNG). */
export function seededShuffle<T>(arr: readonly T[], seed: string): T[] {
  let a = hash(seed);
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Shuffle that never returns the original order (when that's possible),
 * for REORDER questions, where the authored order IS the answer — showing
 * it unshuffled would hand the student the key.
 */
export function shuffleAwayFromOriginal<T>(arr: readonly T[], seed: string): T[] {
  const out = seededShuffle(arr, seed);
  const same = out.every((v, i) => v === arr[i]);
  // All-identical items (or a single item) can't be put out of order.
  if (!same || arr.length < 2 || arr.every((v) => v === arr[0])) return out;
  // Rotate by one: a different order, still deterministic.
  return [...out.slice(1), out[0]];
}

/** Seed for one question within one attempt. */
export function choiceSeed(attemptSeed: string | undefined, questionId: string): string {
  return `${attemptSeed ?? ""}:${questionId}`;
}
