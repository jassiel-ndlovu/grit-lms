/**
 * Marks a maths answer (TeX) against the tutor's key (TeX), for the
 * MATH_EXPRESSION question type (B design 01, phase 2).
 *
 * SERVER ONLY in practice: Compute Engine is about 1.9 MB gzip, so only
 * server code (the marking actions, scripts) may import this file. No
 * client component should import it.
 *
 * Modes (TestQuestion.mathMode; null means EQUIVALENT):
 *   EQUIVALENT  any form that's mathematically equal: x(x+3) = x^2+3x.
 *   FORM        the key's form after tidying (spaces, order of terms and
 *               factors): x(x+3) = (x+3)x, but not x^2+3x.
 *   MARGIN      a number within the key's margin: key `3.14 \pm 0.01`.
 *               Without a margin the number must equal the key.
 *
 * The verdict is "equal", "not-equal" or "undecided". Undecided answers
 * go to the tutor (owner decision 2), never counted wrong. Every failure
 * (a parse error, a time-out, something Compute Engine can't evaluate)
 * is "undecided" too, so a student's answer can't break marking.
 */

import { ComputeEngine } from "@cortex-js/compute-engine";

export type MathMode = "EQUIVALENT" | "FORM" | "MARGIN";
export type MathsVerdict = "equal" | "not-equal" | "undecided";

/** Longest answer or key we'll parse (design: 200 characters). */
export const MAX_MATHS_LENGTH = 200;

/** Points tried for the numeric check, and how many must be usable. */
const SAMPLES = 8;
const MIN_USABLE = 4;
/** Relative tolerance for the numeric check (floating-point noise). */
const TOLERANCE = 1e-7;

type Boxed = NonNullable<ReturnType<ComputeEngine["parse"]>>;

let engine: ComputeEngine | null = null;
function ce(): ComputeEngine {
  if (!engine) {
    engine = new ComputeEngine();
    // Keep any single check short; a slow check is "undecided".
    const limits = engine as unknown as { timeLimit?: number; iterationLimit?: number };
    limits.timeLimit = 500;
    limits.iterationLimit = 10_000;
  }
  return engine;
}

/** Tidy what MathLive and people type: `y =` prefixes, `\left(`, `\,` spaces. */
function tidy(tex: string): string {
  return tex
    .replace(/\\left|\\right/g, "")
    .replace(/\\[,;:!]|\\ |~/g, " ")
    .replace(/^\s*(?:[a-zA-Z]|f\(x\))\s*=\s*/, "")
    .replace(/\\cdot|\\times/g, "\\times")
    .trim();
}

function parse(tex: string): Boxed | null {
  const t = tidy(tex);
  if (!t || t.length > MAX_MATHS_LENGTH) return null;
  const e = ce().parse(t);
  return e && e.isValid ? e : null;
}

function unknownsOf(e: Boxed): string[] {
  return [...((e as unknown as { unknowns?: readonly string[] }).unknowns ?? [])];
}

/** The real value of a numeric expression, or null when it isn't one. */
function realValue(e: Boxed): number | null {
  const n = e.N() as unknown as { re?: number; im?: number };
  const re = typeof n.re === "number" ? n.re : NaN;
  const im = typeof n.im === "number" ? n.im : 0;
  if (!Number.isFinite(re) || Math.abs(im) > 1e-12) return null;
  return re;
}

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE * Math.max(1, Math.abs(a), Math.abs(b));
}

/** A fixed, spread-out set of sample values, so marking is repeatable. */
function sample(i: number, v: number): number {
  const base = [0.7, -1.3, 2.1, 0.35, -0.6, 1.9, 3.3, -2.45];
  return base[(i + v * 3) % base.length] + v * 0.17;
}

function numericallyEqual(a: Boxed, b: Boxed): MathsVerdict {
  const vars = [...new Set([...unknownsOf(a), ...unknownsOf(b)])];
  if (vars.length > 4) return "undecided";
  let usable = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const subs: Record<string, Boxed> = {};
    vars.forEach((v, k) => (subs[v] = ce().number(sample(i, k)) as Boxed));
    const va = realValue(vars.length ? a.subs(subs) : a);
    const vb = realValue(vars.length ? b.subs(subs) : b);
    if (va === null || vb === null) continue; // outside the domain here (a log of a negative, a pole)
    usable++;
    if (!close(va, vb)) return "not-equal";
  }
  return usable >= MIN_USABLE || (vars.length === 0 && usable > 0) ? "equal" : "undecided";
}

function splitMargin(keyTex: string): { value: string; margin: string | null } {
  const m = tidy(keyTex).split(/\\pm|±|\+\/-/);
  return m.length === 2 ? { value: m[0], margin: m[1] } : { value: keyTex, margin: null };
}

/** Mark one answer. Never throws. */
export function checkMaths(answer: unknown, key: unknown, mode: MathMode | string | null | undefined): MathsVerdict {
  try {
    if (typeof key !== "string" || !key.trim()) return "undecided";
    if (typeof answer !== "string" || !answer.trim()) return "not-equal";

    if (mode === "MARGIN") {
      const { value, margin } = splitMargin(key);
      const k = parse(value);
      const a = parse(answer);
      if (!k || !a) return "undecided";
      const kv = realValue(k);
      const av = realValue(a);
      if (kv === null) return "undecided";
      if (av === null) return unknownsOf(a).length ? "not-equal" : "undecided";
      if (margin === null) return close(av, kv) ? "equal" : "not-equal";
      const mExpr = parse(margin);
      const mv = mExpr ? realValue(mExpr) : null;
      if (mv === null) return "undecided";
      return Math.abs(av - kv) <= Math.abs(mv) + TOLERANCE ? "equal" : "not-equal";
    }

    const a = parse(answer);
    const k = parse(key);
    if (!k) return "undecided";
    if (!a) return "undecided";

    if (mode === "FORM") {
      if (a.isSame(k)) return "equal";
      // Not the same form. If it isn't even equal, it's plainly wrong;
      // if it's equal in another form, it's still not what was asked.
      const eq = numericallyEqual(a, k);
      return eq === "undecided" ? "undecided" : "not-equal";
    }

    // EQUIVALENT (default): exact proof first, then the numeric check.
    const exact = a.isEqual(k);
    if (exact === true) return "equal";
    return numericallyEqual(a, k);
  } catch {
    return "undecided";
  }
}
