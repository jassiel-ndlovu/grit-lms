/**
 * API keys and webhooks (#216 phase 3): key format and hashing, bearer
 * parsing, scopes, webhook URL safety, private addresses, signatures, retry
 * timing, cursors and the rate limit. Pure.
 *
 *   npx tsx scripts/check-api.ts
 */

import {
  bearerKey, decodeCursor, encodeCursor, hashKey, isPrivateAddress, newApiKey, newWebhookSecret, rateStep, signPayload,
  validScopes, verifySignature, webhookRetryMinutes, webhookUrlProblem,
} from "../src/features/api/api-math";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

// Keys.
const k = newApiKey();
check("key format", /^nexa_live_[0-9A-Za-z]{32}$/.test(k.key), true);
check("prefix is the start of the key", k.key.startsWith(k.prefix) && k.prefix.length === 14, true);
check("hash is sha256 hex of the key", [k.hash.length, k.hash === hashKey(k.key)], [64, true]);
check("keys differ", newApiKey().key !== k.key, true);
check("bearer parsed", bearerKey(`Bearer ${k.key}`), k.key);
check("bearer with spaces", bearerKey(`  Bearer   ${k.key} `), k.key);
check("no scheme refused", bearerKey(k.key), null);
check("wrong shape refused", bearerKey("Bearer nexa_live_short"), null);
check("empty refused", bearerKey(null), null);
check("scopes filtered and deduped", validScopes(["grades.read", "admin.all", "grades.read", "courses.read"]), ["grades.read", "courses.read"]);

// Webhook URLs.
check("https public host is fine", webhookUrlProblem("https://hooks.example.com/nexa"), null);
check("http refused", webhookUrlProblem("http://hooks.example.com/"), "Webhook addresses must start with https://.");
check("credentials refused", webhookUrlProblem("https://a:b@hooks.example.com/"), "Leave the user name and password out of the address.");
check("odd port refused", webhookUrlProblem("https://hooks.example.com:8443/"), "Use the standard https port.");
check("private IP refused", webhookUrlProblem("https://10.0.0.5/"), "That address is on a private network.");
check("public IP refused (use a name)", webhookUrlProblem("https://8.8.8.8/"), "Use a host name, not an IP address.");
check("localhost refused", webhookUrlProblem("https://localhost/x"), "That address isn't reachable from the internet.");
check(".internal refused", webhookUrlProblem("https://db.internal/x"), "That address isn't reachable from the internet.");
check("Nexa's own host refused", webhookUrlProblem("https://www.nexa-lms.co.za/api"), "Point webhooks at your own server.");
check("garbage refused", webhookUrlProblem("not a url"), "Enter a full https:// address.");

// Private addresses.
check("private v4", ["10.1.2.3", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1", "100.64.0.1", "0.0.0.0", "224.0.0.1"].map(isPrivateAddress).every(Boolean), true);
check("public v4", ["8.8.8.8", "172.32.0.1", "100.128.0.1", "41.0.0.1"].map(isPrivateAddress).some(Boolean), false);
check("private v6", ["::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"].map(isPrivateAddress).every(Boolean), true);
check("public v6", isPrivateAddress("2001:4860:4860::8888"), false);
check("not an IP counts as unsafe", isPrivateAddress("example.com"), true);

// Signatures.
const s = newWebhookSecret();
check("secret format", /^whsec_[0-9A-Za-z]{32}$/.test(s.secret), true);
const body = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
const sig = signPayload(s.secret, body, 1_800_000_000);
check("signature header shape", /^t=1800000000,v1=[0-9a-f]{64}$/.test(sig), true);
check("verifies", verifySignature(s.secret, body, sig, 1_800_000_100), true);
check("tampered body fails", verifySignature(s.secret, body + " ", sig, 1_800_000_100), false);
check("wrong secret fails", verifySignature(newWebhookSecret().secret, body, sig, 1_800_000_100), false);
check("old timestamp fails", verifySignature(s.secret, body, sig, 1_800_000_000 + 301), false);

// Retries.
check("retry schedule", [1, 2, 3, 4, 5, 6, 7].map(webhookRetryMinutes), [1, 5, 30, 120, 720, 1440, null]);

// Cursors.
const at = new Date("2026-11-24T08:00:00Z");
check("cursor round trip", decodeCursor(encodeCursor(at, "abc")), { at: at.toISOString(), id: "abc" });
check("bad cursor is null", decodeCursor("!!!"), null);
check("no cursor is null", decodeCursor(null), null);

// Rate limit.
const now = new Date("2026-11-24T08:00:30Z");
const first = rateStep({ minuteStart: null, minuteCount: 0 }, now, 3);
check("first request", [first.ok, first.minuteCount, first.resetSeconds], [true, 1, 30]);
const third = rateStep({ minuteStart: first.minuteStart, minuteCount: 2 }, now, 3);
check("at the limit still ok", [third.ok, third.minuteCount], [true, 3]);
check("over the limit refused", rateStep({ minuteStart: first.minuteStart, minuteCount: 3 }, now, 3).ok, false);
check("a new minute resets", rateStep({ minuteStart: first.minuteStart, minuteCount: 99 }, new Date("2026-11-24T08:01:05Z"), 3).minuteCount, 1);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
