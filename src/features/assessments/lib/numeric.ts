/**
 * Numeric answers: parse what a South African student or tutor types and
 * compare it to the key. Pure, no I/O; safe on server and client.
 *
 * Accepted forms (student answer and key):
 *   - Decimal point or decimal comma: "0.5", "0,5" (CAPS writes a comma).
 *   - Thousands grouped with spaces, or with commas when a point is also
 *     present: "1 000 000", "1,000.5".
 *   - Fractions and mixed numbers: "1/2", "-3/4", "1 1/2".
 *   - Scientific notation: "6.02e23".
 *
 * A key may carry a margin: "3.14 ± 0.01" or "3.14 +/- 0.01". Without one,
 * the answer must equal the key up to floating-point noise, so "0.5" and
 * "1/2" match but "0.33" and "1/3" do not.
 */

/** Relative slack for floating-point noise only, never a marking margin. */
const FLOAT_EPSILON = 1e-9;

const SPACE = /[\s  ]/;

/** A plain decimal number with any digit grouping already removed. */
function parseDecimal(raw: string): number | null {
  let s = raw;
  const hasPoint = s.includes(".");
  const commas = (s.match(/,/g) ?? []).length;
  if (hasPoint) {
    // "1,000.5": commas group thousands.
    s = s.replace(/,/g, "");
  } else if (commas === 1) {
    // "0,5": decimal comma.
    s = s.replace(",", ".");
  } else if (commas > 1) {
    // "1,000,000": grouping only.
    s = s.replace(/,/g, "");
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Remove spaces used to group digits in threes ("1 000 000"). */
function ungroupSpaces(s: string): string {
  return s.replace(
    new RegExp(`(\\d)${SPACE.source}(?=\\d{3}(?!\\d))`, "g"),
    "$1",
  );
}

/**
 * Parse one number. Returns null for anything that is not a number, so the
 * caller marks it wrong instead of guessing.
 */
export function parseNumber(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (s === "") return null;

  // Mixed number: "1 1/2", "-2 3/4".
  const mixed = s.match(/^([-+]?)(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const [, sign, whole, num, den] = mixed;
    if (Number(den) === 0) return null;
    const v = Number(whole) + Number(num) / Number(den);
    return sign === "-" ? -v : v;
  }

  // Fraction: "1/2", "-3/4", "1.5/3".
  const frac = s.match(/^([^/]+)\/([^/]+)$/);
  if (frac) {
    const num = parseDecimal(ungroupSpaces(frac[1].trim()));
    const den = parseDecimal(ungroupSpaces(frac[2].trim()));
    if (num == null || den == null || den === 0) return null;
    return num / den;
  }

  return parseDecimal(ungroupSpaces(s));
}

export interface NumericKey {
  value: number;
  /** Absolute margin either side of `value`; 0 = exact. */
  margin: number;
}

/** Parse a tutor's key, with an optional "± margin". */
export function parseNumericKey(input: unknown): NumericKey | null {
  if (typeof input === "number") {
    return Number.isFinite(input) ? { value: input, margin: 0 } : null;
  }
  if (typeof input !== "string") return null;
  const parts = input.split(/±|\+\s*\/\s*-|\+\s*-/);
  if (parts.length > 2) return null;
  const value = parseNumber(parts[0]);
  if (value == null) return null;
  if (parts.length === 1) return { value, margin: 0 };
  const margin = parseNumber(parts[1]);
  if (margin == null || margin < 0) return null;
  return { value, margin };
}

/** True when `answer` falls within the key's margin. */
export function numericMatches(answer: unknown, key: unknown): boolean {
  const a = parseNumber(answer);
  const k = parseNumericKey(key);
  if (a == null || k == null) return false;
  const noise = FLOAT_EPSILON * Math.max(1, Math.abs(k.value));
  return Math.abs(a - k.value) <= k.margin + noise;
}
