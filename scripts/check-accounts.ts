/**
 * Checks the sign-in code and username rules (src/features/auth/codes.ts)
 * and that placeholder addresses are never mailed.
 *
 *   npx tsx scripts/check-accounts.ts
 */

import { looksLikeCode, newSignInCode, normaliseCode, pickUsername, placeholderEmail, usernameBase } from "../src/features/auth/codes";
import { recipientAllowed } from "../src/lib/email/send";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const code = newSignInCode();
check("code shape XXXX-XXXX-XX without look-alikes", /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{2}$/.test(code), true);
check("normalised: upper case, no dashes", normaliseCode("kq4m-2xd7 pa"), "KQ4M2XD7PA");
check("typed with dashes looks like a code", looksLikeCode("KQ4M-2XD7-PA"), true);
check("typed lower case looks like a code", looksLikeCode("kq4m2xd7pa"), true);
check("already normalised is not retried", looksLikeCode("KQ4M2XD7PA"), false);
check("an ordinary password is not a code", looksLikeCode("correct horse battery"), false);

check("username from two names", usernameBase("Thandi Mokoena"), "thandi.mokoena");
check("accents and extra names", usernameBase("Zoë  van der Merwe"), "zoe.merwe");
check("single name", usernameBase("Sipho"), "sipho");
check("free base is used", pickUsername("sipho", new Set()), "sipho");
check("taken base gets digits", pickUsername("sipho", new Set(["sipho"]), () => 42), "sipho42");
check("too-short base gets digits", pickUsername("al", new Set(), () => 7), "al7");

check("placeholder email shape", placeholderEmail("abc"), "abc@students.nexa-lms.invalid");
check("placeholder never mailed, even in production", recipientAllowed("abc@students.nexa-lms.invalid", { VERCEL_ENV: "production" }), false);
check("real address in production still mailed", recipientAllowed("a@example.com", { VERCEL_ENV: "production" }), true);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
