/**
 * Sign-in codes and usernames for accounts tutors create (design 02,
 * section 5.1). Pure; checked by scripts/check-accounts.ts.
 *
 * A sign-in code is the account's first password: 10 characters shown as
 * KQ4M-2XD7-PA, with no look-alike characters. It is stored normalised
 * (upper case, no dashes or spaces), and sign-in accepts it typed either
 * way.
 */

import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** The code as shown to the tutor, e.g. "KQ4M-2XD7-PA". */
export function newSignInCode(): string {
  let s = "";
  for (let i = 0; i < 10; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

/** What is hashed and compared: upper case, letters and digits only. */
export function normaliseCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** True when `typed` could be a sign-in code written another way (lower case, dashes, spaces). */
export function looksLikeCode(typed: string): boolean {
  const n = normaliseCode(typed);
  return n.length === 10 && n !== typed && [...n].every((c) => ALPHABET.includes(c));
}

/** "thandi.mokoena" from "Thandi Mokoena"; ASCII, lower case, at most 24 characters. */
export function usernameBase(fullName: string): string {
  const parts = fullName.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\s.-]/g, "").split(/[\s.-]+/).filter(Boolean);
  const base = parts.length > 1 ? `${parts[0]}.${parts[parts.length - 1]}` : parts[0] ?? "student";
  return base.slice(0, 24);
}

export const USERNAME_RE = /^[a-z0-9][a-z0-9._]{2,29}$/;

/** A username not in `taken`: the base, then base plus 2 to 4 digits. */
export function pickUsername(base: string, taken: Set<string>, rand: () => number = () => randomInt(10, 10_000)): string {
  if (USERNAME_RE.test(base) && !taken.has(base)) return base;
  for (let i = 0; i < 50; i++) {
    const u = `${base.slice(0, 24)}${rand()}`;
    if (USERNAME_RE.test(u) && !taken.has(u)) return u;
  }
  throw new Error("No free username");
}

/** Placeholder email for a student without one; nothing is ever sent to this domain. */
export const PLACEHOLDER_DOMAIN = "students.nexa-lms.invalid";
export const placeholderEmail = (id: string) => `${id}@${PLACEHOLDER_DOMAIN}`;
