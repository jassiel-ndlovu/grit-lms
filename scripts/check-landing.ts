/**
 * Landing-page support (#216): enquiry validation and screening, plan
 * prices from tier rows, and which paths are public (sitemap, robots,
 * analytics). Pure; no database.
 *
 *   npx tsx scripts/check-landing.ts
 */

import { cleanSource, enquirySchema, ENQUIRY_LIMITS, looksLikeSpam, screenEnquiry } from "../src/features/marketing/enquiry-rules";
import { buildPublicPlans, randLabel } from "../src/features/marketing/plans-math";
import { indexable, isPublicPath, siteUrl } from "../src/lib/site";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

// Enquiry validation.
const good = enquirySchema.safeParse({ name: "  Ayanda Zulu ", email: "Ayanda@Example.COM", message: "We run a tutoring centre with 40 learners.", students: "40", phone: "", organisation: "" });
check("valid enquiry parses", good.success, true);
if (good.success) {
  check("name trimmed", good.data.name, "Ayanda Zulu");
  check("email lower-cased", good.data.email, "ayanda@example.com");
  check("kind defaults to ACCESS", good.data.kind, "ACCESS");
  check("students coerced", good.data.students, 40);
  check("empty phone dropped", good.data.phone, undefined);
  check("empty organisation dropped", good.data.organisation, undefined);
}
check("bad email refused", enquirySchema.safeParse({ name: "Ayanda", email: "nope", message: "Hello there, a question." }).success, false);
check("short message refused", enquirySchema.safeParse({ name: "Ayanda", email: "a@b.co", message: "hi" }).success, false);
check("bad phone refused", enquirySchema.safeParse({ name: "Ayanda", email: "a@b.co", message: "Hello there, a question.", phone: "call me" }).success, false);
check("garbage students ignored", enquirySchema.safeParse({ name: "Ayanda", email: "a@b.co", message: "Hello there, a question.", students: "lots" }).success, true);
check("unknown kind refused", enquirySchema.safeParse({ kind: "SALES", name: "Ayanda", email: "a@b.co", message: "Hello there, a question." }).success, false);

// Screening.
const now = 1_800_000_000_000;
check("honeypot is a bot", screenEnquiry({ website: "http://x", startedAt: now - 60_000 }, now), "bot");
check("too fast is a bot", screenEnquiry({ startedAt: now - 1_000 }, now), "bot");
check("normal pace is ok", screenEnquiry({ startedAt: now - 45_000 }, now), "ok");
check("a day-old form is stale", screenEnquiry({ startedAt: now - ENQUIRY_LIMITS.maxFillMs - 1 }, now), "stale");
check("no startedAt is ok", screenEnquiry({}, now), "ok");
check("blank honeypot is ok", screenEnquiry({ website: "  ", startedAt: now - 10_000 }, now), "ok");
check("many links look like spam", looksLikeSpam("see http://a http://b www.c https://d"), true);
check("one link is fine", looksLikeSpam("our site is https://ubuntu.example"), false);
check("source path kept without query", cleanSource("/pricing?utm_source=x#top"), "/pricing");
check("protocol-relative source dropped", cleanSource("//evil.example"), null);
check("campaign source kept", cleanSource("facebook-nov"), "facebook-nov");
check("odd source dropped", cleanSource("<script>"), null);

// Plans.
const tiers = [
  { key: "PRO" as const, name: "Pro", priceCents: 17900 },
  { key: "CORE" as const, name: "Core", priceCents: 9900 },
  { key: "PLUS" as const, name: "Plus", priceCents: 13950 },
];
const plans = buildPublicPlans(tiers, false);
check("plans in tier order", plans.plans.map((p) => p.key), ["CORE", "PLUS", "PRO"]);
check("live follows billing", [plans.live, buildPublicPlans(tiers, true).live], [false, true]);
check("price labels", plans.plans.map((p) => p.priceLabel), ["R99", "R139.50", "R179"]);
check("AI credits per seat", plans.plans.map((p) => p.aiCreditsPerSeat), [0, 150, 500]);
check("Core adds attendance", plans.plans[0].adds.includes("Attendance register"), true);
check("Plus adds visual maths", plans.plans[1].adds.includes("Visual maths input"), true);
check("Pro adds AI marks, not parked services", [plans.plans[2].adds.includes("AI-suggested marks"), plans.plans[2].adds.includes("Coding automarker")], [true, false]);
check("Pro includes Core and Plus", plans.plans[2].includes.length, plans.plans[0].adds.length + plans.plans[1].adds.length + plans.plans[2].adds.length);
check("missing tier row is skipped", buildPublicPlans(tiers.slice(0, 1), true).plans.map((p) => p.key), ["PRO"]);
check("randLabel", [randLabel(0), randLabel(5), randLabel(100000)], ["R0", "R0.05", "R1000"]);

// Site.
check("siteUrl prefers NEXT_PUBLIC_APP_URL", siteUrl({ NEXT_PUBLIC_APP_URL: "https://nexa.example/", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }), "https://nexa.example");
check("siteUrl falls back to Vercel", siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }), "https://x.vercel.app");
check("siteUrl local", siteUrl({}), "http://localhost:3000");
check("only production is indexable", [indexable({ VERCEL_ENV: "production" }), indexable({ VERCEL_ENV: "preview" }), indexable({})], [true, false, false]);
check("public paths", ["/", "/support", "/auth", "/auth/sign-up", "/privacy-policy"].map(isPublicPath), [true, true, true, true, true]);
check("private paths", ["/dashboard", "/dashboard/courses/x", "/api/ba/x", "/auth/invite/tok", "/set-password", "/verify-email"].map(isPublicPath), [false, false, false, false, false, false]);
check("prefix needs a boundary", isPublicPath("/dashboardish"), true);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
