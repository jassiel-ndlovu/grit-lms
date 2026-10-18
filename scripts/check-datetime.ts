/**
 * npx tsx scripts/check-datetime.ts
 *
 * Notification timestamps must read the same wherever the code runs: the
 * output below may only depend on the instant and the explicit zone/locale,
 * never on the machine's own zone. Run with TZ=UTC and TZ=Asia/Tokyo to
 * confirm.
 */

import {
  formatDateTime,
  formatRelativeTime,
  greetingFor,
  resolveLocale,
} from "../src/lib/datetime";

let failures = 0;
function check(name: string, got: string, want: string) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `\n     got:  ${got}\n     want: ${want}`}`);
}

const SAST = { timeZone: "Africa/Johannesburg", locale: "en-GB" };
const now = Date.parse("2026-10-18T19:17:00Z"); // 21:17 in Johannesburg

check("seconds ago", formatRelativeTime("2026-10-18T19:16:40Z", now, SAST), "now");
check("future (clock skew)", formatRelativeTime("2026-10-18T19:20:00Z", now, SAST), "now");
check("minutes", formatRelativeTime("2026-10-18T19:05:00Z", now, SAST), "12 minutes ago");
check("hours, same day", formatRelativeTime("2026-10-18T16:58:07Z", now, SAST), "2 hours ago");
// 23:30 SAST yesterday is 21:30 UTC — under 24h ago, but a different day.
check("yesterday by calendar", formatRelativeTime("2026-10-17T21:30:00Z", now, SAST), "yesterday");
// 00:30 SAST today is 22:30 UTC yesterday: same local day, so hours.
check("same local day across UTC midnight", formatRelativeTime("2026-10-17T22:30:00Z", now, SAST), "21 hours ago");
check("days", formatRelativeTime("2026-10-14T10:00:00Z", now, SAST), "4 days ago");
check("older -> date", formatRelativeTime("2026-10-01T10:00:00Z", now, SAST), "1 Oct 2026");

check(
  "absolute in SAST",
  formatDateTime("2026-10-18T16:58:07Z", SAST),
  "18 Oct 2026, 18:58",
);
check(
  "absolute in New York",
  formatDateTime("2026-10-18T16:58:07Z", { timeZone: "America/New_York", locale: "en-GB" }),
  "18 Oct 2026, 12:58",
);
check("greeting uses the zone", greetingFor(new Date(now), "Africa/Johannesburg"), "Good evening");
check("greeting elsewhere", greetingFor(new Date(now), "Asia/Tokyo"), "Good morning");
check("legacy EN locale", resolveLocale("EN"), "en-ZA");
check("unknown locale", resolveLocale("xx-YY"), "en-ZA");

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall passed");
