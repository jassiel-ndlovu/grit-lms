/**
 * Check the study assistant and credits screens' pure helpers:
 *   npx tsx scripts/check-study-ui.ts
 */
import { safeReturnPath } from "../src/features/payments/settlement-rules";
import {
  answersLabel, citationsOf, closedNote, concernChip, leftLabel, messageView, nextExpiry, number, reasonOf, studyRoutes, validityLabel,
} from "../src/features/courses/lib/study-ui";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

// Routes
check("assistant", [studyRoutes.assistant("c1"), studyRoutes.assistant("c1", null), studyRoutes.assistant("c1", "a b")], [
  "/dashboard/courses/c1/assistant", "/dashboard/courses/c1/assistant", "/dashboard/courses/c1/assistant?chat=a%20b",
]);
check("tutor chats", [studyRoutes.chats("c1"), studyRoutes.chats("c1", "x")], ["/dashboard/manage-courses/c1/study-chats", "/dashboard/manage-courses/c1/study-chats/x"]);
check("a parent's chats", [studyRoutes.childChats("u 1"), studyRoutes.childChats("u1", "x")], ["/dashboard/children/u%201/study-chats", "/dashboard/children/u1/study-chats/x"]);
check("Paystack may return to us", safeReturnPath(studyRoutes.creditsReturn), studyRoutes.creditsReturn);

// Messages
check("citations: one per lesson, bad ones dropped", citationsOf([{ ref: "L1", lessonId: "a", title: "A" }, { lessonId: "a", title: "A again" }, { lessonId: 3, title: "x" }, { title: "y" }, null, { lessonId: "b", title: "" }]), [{ lessonId: "a", title: "A" }]);
check("citations: not a list", [citationsOf(null), citationsOf("x"), citationsOf({})], [[], [], []]);
check("message", messageView({ id: "m", role: "ASSISTANT", content: "Hi", citations: [{ lessonId: "a", title: "A" }] }), { id: "m", role: "ASSISTANT", content: "Hi", citations: [{ lessonId: "a", title: "A" }], concern: null });
check("concerns", [concernChip("wellbeing")?.tone, concernChip("safety")?.tone, concernChip("integrity")?.tone, concernChip("none"), concernChip(null), concernChip("other")], ["danger", "danger", "warning", null, null, null]);

// Numbers
check("numbers", [number(0), number(999), number(13392), number(1234567)], ["0", "999", "13 392", "1 234 567"]);
check("answers round down", [answersLabel(0), answersLabel(39), answersLabel(40), answersLabel(13392), answersLabel(-5)], ["No answers", "No answers", "About 1 answer", "About 334 answers", "No answers"]);
check("left", leftLabel(23, 25, 800), "23 of 25 questions left today. Your credits cover about 20 answers.");
check("validity", [validityLabel(30), validityLabel(365), validityLabel(1095)], ["30 days", "1 year", "3 years"]);
const d = (s: string) => new Date(`${s}T00:00:00Z`);
check("next expiry: the soonest that hasn't gone", nextExpiry([{ expiresAt: d("2026-12-20"), expired: false }, { expiresAt: d("2026-10-01"), expired: true }, { expiresAt: d("2026-12-05"), expired: false }, { expiresAt: null, expired: false }]), d("2026-12-05"));
check("next expiry: none", [nextExpiry([]), nextExpiry([{ expiresAt: d("2026-10-01"), expired: true }])], [null, null]);

// When the box is open
check("reasons", [reasonOf(null), reasonOf("NO_CREDITS"), reasonOf("SOMETHING_NEW")], [null, "NO_CREDITS", "NOT_ON_PLAN"]);
const note = (reason: Parameters<typeof closedNote>[0]["reason"], leftToday = 5) => closedNote({ reason, leftToday, perDay: 25 });
check("open", note(null), null);
check("closed for each reason", [note("NOT_ON_PLAN"), note("COMING_SOON"), note("NO_CREDITS"), note(null, 0)].every((n) => n && n.title && n.text), true);
check("credits come before the daily limit", note("NO_CREDITS", 0)?.title, note("NO_CREDITS")?.title);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
