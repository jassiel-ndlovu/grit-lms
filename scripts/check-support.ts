/**
 * Help and contact centre: the pure rules and the help text (support.md).
 *   npx tsx scripts/check-support.ts
 */

import { articlesFor, HELP_ARTICLES, searchArticles } from "../src/features/support/help-articles";
import {
  cleanAttachments,
  cleanPagePath,
  defaultRoute,
  formatRef,
  parseRef,
  publicQuerySchema,
  querySchema,
  statusAfterMessage,
  SUPPORT_LIMITS,
  SUPPORT_TOPICS,
  TOPIC_LABEL,
  topicsFor,
} from "../src/features/support/support-rules";

let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.log(`  FAIL ${name}`, detail ?? "");
  }
}

console.log("Routing");
check("a student's class question goes to their organisation", defaultRoute("learner", "CLASSES", true) === "WORKSPACE");
check("a parent's fees question goes to the organisation", defaultRoute("guardian", "PAYMENTS", true) === "WORKSPACE");
check("a student's marks question goes to the organisation", defaultRoute("learner", "TESTS", true) === "WORKSPACE");
check("a student's sign-in question goes to Nexa", defaultRoute("learner", "ACCOUNT", true) === "NEXA");
check("an app problem goes to Nexa", defaultRoute("guardian", "APP", true) === "NEXA");
check("a student with no organisation goes to Nexa", defaultRoute("learner", "CLASSES", false) === "NEXA");
check("staff always go to Nexa", defaultRoute("staff", "CLASSES", true) === "NEXA");
check("the public always go to Nexa", defaultRoute("public", "PAYMENTS", true) === "NEXA");
check("families don't see the Nexa plan topic", !topicsFor("learner").includes("SUBSCRIPTION") && topicsFor("staff").includes("SUBSCRIPTION"));

console.log("References and paths");
check("ref format", formatRef(1042) === "Q-1042");
check("ref parse", parseRef("Q-1042") === 1042 && parseRef("q1042") === 1042 && parseRef(" 1042 ") === 1042 && parseRef("abc") === null);
check("same-site page kept, query kept, hash dropped", cleanPagePath("/dashboard/grades?x=1#top") === "/dashboard/grades?x=1");
check("other sites dropped", cleanPagePath("https://evil.example/x") === null && cleanPagePath("//evil.example") === null && cleanPagePath("/a\\b") === null);

console.log("Status after a message");
const now = new Date("2026-11-24T10:00:00Z");
const days = (n: number) => new Date(now.getTime() - n * 86_400_000);
check("a staff reply answers it", statusAfterMessage({ current: "OPEN", fromStaff: true, internal: false, closedAt: null, now }).status === "ANSWERED");
check("a requester reply reopens an answered query", statusAfterMessage({ current: "ANSWERED", fromStaff: false, internal: false, closedAt: null, now }).status === "OPEN");
check("an internal note changes nothing", statusAfterMessage({ current: "ANSWERED", fromStaff: true, internal: true, closedAt: null, now }).status === "ANSWERED");
check("a reply within 30 days reopens a closed query", statusAfterMessage({ current: "CLOSED", fromStaff: false, internal: false, closedAt: days(10), now }).status === "OPEN");
check("a reply after 30 days is refused", statusAfterMessage({ current: "CLOSED", fromStaff: false, internal: false, closedAt: days(31), now }).allowed === false);

console.log("Attachments");
const mine = "https://abc.public.blob.vercel-storage.com/support/user1/shot-x1.png";
check("own uploads kept", cleanAttachments([mine], "user1").length === 1);
check("someone else's folder dropped", cleanAttachments(["https://abc.public.blob.vercel-storage.com/support/user2/shot.png"], "user1").length === 0);
check("other hosts dropped", cleanAttachments(["https://evil.example/support/user1/x.png"], "user1").length === 0);
check("other folders dropped", cleanAttachments(["https://abc.public.blob.vercel-storage.com/users/user1/avatar/x.png"], "user1").length === 0);
check("at most 3, no repeats", cleanAttachments([mine, mine, mine + "1", mine + "2", mine + "3"], "user1").length === SUPPORT_LIMITS.attachmentsMax);

console.log("Input");
check("a short subject is refused", !querySchema.safeParse({ kind: "QUESTION", topic: "OTHER", subject: "hi", message: "a long enough message" }).success);
check("a good query passes", querySchema.safeParse({ kind: "PROBLEM", topic: "APP", subject: "Grades page empty", message: "The grades page shows nothing since Monday." }).success);
check("the public form needs a real email", !publicQuerySchema.safeParse({ kind: "QUESTION", topic: "OTHER", name: "Ann", email: "nope", subject: "Hello there", message: "A long enough message" }).success);
check("the public form lower-cases the email", publicQuerySchema.parse({ kind: "QUESTION", topic: "OTHER", name: "Ann", email: "Ann@Example.com", subject: "Hello there", message: "A long enough message" }).email === "ann@example.com");

console.log("Help text");
const ids = HELP_ARTICLES.map((a) => a.id);
check("article ids are unique", new Set(ids).size === ids.length);
for (const p of ["learner", "guardian", "staff", "public"] as const) check(`${p}: at least 5 articles`, articlesFor(p).length >= 5, articlesFor(p).length);
check("every article's topic exists", HELP_ARTICLES.every((a) => (SUPPORT_TOPICS as readonly string[]).includes(a.topic)));
const allText = HELP_ARTICLES.flatMap((a) => [a.title, ...a.body]).join("\n");
const banned = ["Paystack", "Resend", "Vercel", "Anthropic", "Neon", "QStash", "workspace", "persona", "click here"];
for (const w of banned) check(`help text never says "${w}"`, !new RegExp(`\\b${w}\\b`, "i").test(allText));
check("topic labels have no jargon", Object.values(TOPIC_LABEL).every((l) => !/workspace|tenant|persona/i.test(l)));
check("search finds the password article", searchArticles(articlesFor("learner"), "password")[0]?.id === "forgot-password");
check("search finds fees for parents", searchArticles(articlesFor("guardian"), "pay")[0]?.id === "pay-fees");

if (failed) {
  console.log(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
