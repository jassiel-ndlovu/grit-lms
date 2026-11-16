/**
 * npx tsx scripts/check-avatar-index.ts
 *
 * Default avatars must be stable (same id, same bust, on server and client),
 * in range, and spread evenly enough that a class does not all look alike.
 */

import { avatarIndexFor } from "../src/components/illustrations/avatar-index";
import { AVATAR_COUNT } from "../src/components/illustrations/generated/registry";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok || !detail ? "" : `\n     ${detail}`}`);
}

check("set has 24 to 32 busts", AVATAR_COUNT >= 24 && AVATAR_COUNT <= 32, `AVATAR_COUNT = ${AVATAR_COUNT}`);

// Pinned values: if these change, every user's default avatar changes.
check("pinned cuid", avatarIndexFor("clx0a1b2c0000abcd1234efgh", 32) === 21);
check("pinned short id", avatarIndexFor("user-1", 32) === 20);
check("empty id hashes to the FNV offset basis", avatarIndexFor("", 32) === 0x811c9dc5 % 32);
check("a (FNV-1a reference 0xe40c292c)", avatarIndexFor("a", 0x100000000 - 1) === 0xe40c292c % (0x100000000 - 1));
check("foobar (FNV-1a reference 0xbf9cf968)", avatarIndexFor("foobar", 1000) === 0xbf9cf968 % 1000);

const ids = Array.from({ length: 20000 }, (_, i) => `user-${i}-${(i * 2654435761) >>> 0}`);
check(
  "deterministic",
  ids.every((id) => avatarIndexFor(id) === avatarIndexFor(id)),
);
check(
  "in range",
  ids.every((id) => {
    const n = avatarIndexFor(id);
    return Number.isInteger(n) && n >= 0 && n < AVATAR_COUNT;
  }),
);

const buckets = new Array(AVATAR_COUNT).fill(0);
for (const id of ids) buckets[avatarIndexFor(id)]++;
const expected = ids.length / AVATAR_COUNT;
const worst = Math.max(...buckets.map((b) => Math.abs(b - expected) / expected));
check("every bust used, none off by more than 15%", worst < 0.15, `worst deviation ${(worst * 100).toFixed(1)}%`);

check("non-ASCII ids work", avatarIndexFor("Thandiwe Ndlovu-Müller") >= 0);
let threw = false;
try {
  avatarIndexFor("x", 0);
} catch {
  threw = true;
}
check("count 0 throws", threw);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall avatar index checks passed");
