/**
 * Checks the business dashboard's period and labels.
 *
 *   npx tsx scripts/check-business-ui.ts
 */

import { addDays, dayIn, daysBetween, isDay, monthLabel, periodHref, PERIODS, ratePercent, resolvePeriod } from "../src/components/business/period";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const ZA = "Africa/Johannesburg";
// 00:30 on 1 March in Johannesburg, still 28 February in UTC.
const EARLY = new Date("2026-02-28T22:30:00Z");
const NOW = new Date("2026-11-23T10:00:00Z");
const days = (sp: Parameters<typeof resolvePeriod>[0], now = NOW, tz = ZA) => {
  const p = resolvePeriod(sp, tz, now);
  return [p.key, p.fromDay, p.toDay];
};

check("the viewer's day, not the server's", [dayIn(EARLY, ZA), dayIn(EARLY, "UTC")], ["2026-03-01", "2026-02-28"]);
check("add days over a month end", [addDays("2026-02-28", 1), addDays("2026-03-01", -1)], ["2026-03-01", "2026-02-28"]);
check("both days counted", [daysBetween("2026-11-01", "2026-11-01"), daysBetween("2026-11-01", "2026-11-30")], [1, 30]);
check("real days only", [isDay("2026-02-28"), isDay("2026-02-30"), isDay("2026-2-3"), isDay(undefined)], [true, false, false, false]);

check("default: 30 days, today counted", days({}), ["30-days", "2026-10-25", "2026-11-23"]);
check("an unknown period is the default", days({ period: "forever" })[0], "30-days");
check("this month", days({ period: "this-month" }), ["this-month", "2026-11-01", "2026-11-23"]);
check("last month, in the viewer's zone", days({ period: "last-month" }, EARLY), ["last-month", "2026-02-01", "2026-02-28"]);
check("last month in January", days({ period: "last-month" }, new Date("2027-01-10T10:00:00Z")), ["last-month", "2026-12-01", "2026-12-31"]);
check("every period is at most A's year", PERIODS.map((p) => resolvePeriod({ period: p.key }, ZA, NOW)).every((p) => p.to > p.from && p.to.getTime() - p.from.getTime() <= 366 * 86_400_000), true);

const own = resolvePeriod({ from: "2026-11-01", to: "2026-11-05" }, ZA, NOW);
check("own dates: whole days in the viewer's zone", [own.key, own.from.toISOString(), own.to.toISOString(), own.error], [null, "2026-10-31T22:00:00.000Z", "2026-11-05T22:00:00.000Z", null]);
check("a period up to today ends now", resolvePeriod({ from: "2026-11-01", to: "2026-11-23" }, ZA, NOW).to.toISOString(), NOW.toISOString());
check("a last day in the future is today", days({ from: "2026-11-01", to: "2026-12-31" }), [null, "2026-11-01", "2026-11-23"]);
check("the wrong way round", resolvePeriod({ from: "2026-11-05", to: "2026-11-01" }, ZA, NOW).error, "The last day is before the first.");
check("one date missing", resolvePeriod({ from: "2026-11-05" }, ZA, NOW).error, "Choose a first and a last day.");
check("in the future", resolvePeriod({ from: "2026-12-01", to: "2026-12-05" }, ZA, NOW).error, "Choose days up to today.");
check("over a year", resolvePeriod({ from: "2025-11-01", to: "2026-11-05" }, ZA, NOW).error, "Choose up to a year.");
check("exactly a year", resolvePeriod({ from: "2025-11-24", to: "2026-11-23" }, ZA, NOW).error, null);
check("an error still shows 30 days", days({ from: "x", to: "y" }), ["30-days", "2026-10-25", "2026-11-23"]);

check("the default has the plain address", [periodHref("30-days"), periodHref("this-month")], ["/dashboard/business", "/dashboard/business?period=this-month"]);
check("month labels", [monthLabel("2026-06", "en-ZA"), monthLabel("2026-06", "en-ZA", true)], ["Jun", "June 2026"]);
check("rates", [0, 40, 8640, 9950, 10000].map(ratePercent), ["0%", "under 1%", "86%", "over 99%", "100%"]);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
