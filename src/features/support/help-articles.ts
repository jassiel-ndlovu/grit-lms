/**
 * Help articles for /dashboard/help and /support (owner 24 Nov).
 * Client-safe data. Plain words: say where to go and what happens next;
 * no provider names; one task per article. docs/revamp/copy.md has the rules.
 *
 * `who`: which people see it. `topic`: the contact-form topic it relates to,
 * so "Still need help?" can prefill the form.
 */

import type { SupportTopic } from "./support-rules";

export type HelpAudience = "learner" | "guardian" | "staff" | "public";

export type HelpArticle = {
  id: string;
  title: string;
  who: readonly HelpAudience[];
  topic: SupportTopic;
  /** Paragraphs; a paragraph starting with "1." etc. is shown as a step. */
  body: readonly string[];
  keywords?: readonly string[];
};

const FAMILY = ["learner", "guardian"] as const;
const EVERYONE_SIGNED_IN = ["learner", "guardian", "staff"] as const;

export const HELP_ARTICLES: readonly HelpArticle[] = [
  /* --------------------------- Signing in --------------------------- */
  {
    id: "forgot-password",
    title: "I forgot my password",
    who: ["learner", "guardian", "staff", "public"],
    topic: "ACCOUNT",
    keywords: ["password", "reset", "locked out", "can't sign in", "login"],
    body: [
      "1. On the sign-in page, choose Forgot password.",
      "2. Enter the email address you use for Nexa. We'll email you a link to set a new password.",
      "3. The link works for a short time. If it has run out, ask for a new one.",
      "If your tutor gave you a sign-in code instead of an email address, ask them for a new code. They can make one from your page on their Students list.",
    ],
  },
  {
    id: "no-email",
    title: "The email from Nexa hasn't arrived",
    who: ["learner", "guardian", "staff", "public"],
    topic: "ACCOUNT",
    keywords: ["email", "spam", "junk", "verification", "confirm"],
    body: [
      "Check your spam or junk folder first, and search your inbox for \"Nexa\".",
      "Make sure the address on your account is right: open Settings and look under your profile.",
      "Emails can take a few minutes. If nothing comes after 15 minutes, send us a query and say which email you were expecting.",
    ],
  },
  {
    id: "two-step",
    title: "Why am I asked to set up two-step sign-in?",
    who: ["staff"],
    topic: "ACCOUNT",
    keywords: ["two-factor", "2fa", "authenticator", "security code"],
    body: [
      "Owners of an organisation, and Nexa's own team, must sign in with a password and a code from an authenticator app. It keeps your students' details and your payments safe if your password is ever stolen.",
      "Install an authenticator app on your phone (for example Google Authenticator or Microsoft Authenticator), then follow the steps on the screen. Keep the backup codes somewhere safe: they get you in if you lose your phone.",
    ],
  },
  {
    id: "change-email",
    title: "Change my name, email or password",
    who: EVERYONE_SIGNED_IN,
    topic: "ACCOUNT",
    keywords: ["profile", "rename", "email address"],
    body: [
      "Open Settings (bottom of the menu) and choose your account.",
      "If you change your email address, we send a link to the new address. The change happens once you open it, and we tell the old address too.",
    ],
  },

  /* ----------------------------- Students ----------------------------- */
  {
    id: "join-course",
    title: "Join a course",
    who: FAMILY,
    topic: "CLASSES",
    keywords: ["enrol", "find courses", "sign up for a class"],
    body: [
      "1. Choose Find courses in the menu.",
      "2. Open a course and ask to join. Parents choose which child it's for.",
      "3. The tutor sees your request and accepts it. You'll get a notification when they do, and the course appears under Courses.",
      "If your tutor gave you a link or a code, use that instead: it adds you straight away.",
    ],
  },
  {
    id: "take-test",
    title: "Take a test",
    who: ["learner"],
    topic: "TESTS",
    keywords: ["quiz", "exam", "start test", "timer"],
    body: [
      "1. Choose Tests in the menu. Tests you can take now are at the top, with their due dates.",
      "2. Read the instructions, then start. If the test has a time limit, the timer starts now.",
      "3. Your answers are saved as you go. If your connection drops or the page closes, open the test again and carry on.",
      "4. Submit when you're done. You can't change your answers after that.",
    ],
  },
  {
    id: "see-marks",
    title: "When will I see my marks?",
    who: FAMILY,
    topic: "TESTS",
    keywords: ["results", "grades", "feedback", "marked"],
    body: [
      "Questions with a set answer can be marked straight away, if your tutor chose that. The rest show once your tutor has marked your work. Until then, it shows as waiting to be marked.",
      "When your mark is in, you'll get a notification. Open Grades to see your mark, each answer and your tutor's comments.",
      "If it has been more than a week, ask your tutor through Help: choose \"Tests, assignments and marks\".",
    ],
  },
  {
    id: "hand-in",
    title: "Hand in an assignment",
    who: ["learner"],
    topic: "TESTS",
    keywords: ["upload", "submit", "homework", "file"],
    body: [
      "1. Choose Assignments in the menu and open the assignment.",
      "2. Add your files, then choose Hand in.",
      "3. You'll see a receipt, and your tutor is told. You can hand in again before the due date if your tutor allows it.",
    ],
  },
  {
    id: "offline",
    title: "Read lessons without internet",
    who: ["learner"],
    topic: "CLASSES",
    keywords: ["offline", "data", "no connection", "download lesson"],
    body: [
      "Open a lesson and choose Save for offline. Saved lessons open even when you have no connection.",
      "To use less mobile data, turn on Data saver in Settings: pictures and videos load only when you tap them.",
    ],
  },
  {
    id: "book-lesson",
    title: "Book or cancel a lesson",
    who: FAMILY,
    topic: "CLASSES",
    keywords: ["booking", "session", "one-to-one", "reschedule"],
    body: [
      "1. Choose Bookings in the menu, then Book a lesson.",
      "2. Pick a time your tutor has free. Each booking uses one lesson from your pack.",
      "To cancel, open the booking under Bookings. If you cancel early enough (usually 24 hours before), you get the lesson back. Later than that, it counts as used.",
    ],
  },
  {
    id: "study-assistant",
    title: "Use the study assistant",
    who: FAMILY,
    topic: "CLASSES",
    keywords: ["ai", "assistant", "questions", "credits", "chat"],
    body: [
      "Some courses have a study assistant that answers questions about the course's own lessons. Open the course and choose Study assistant.",
      "Each answer uses study credits, which students or parents buy under Study credits. Credits last for the time shown before you buy.",
      "Your tutors can read your chats, to help you with anything you're stuck on.",
    ],
  },

  /* ------------------------------ Parents ------------------------------ */
  {
    id: "link-child",
    title: "See my child's work",
    who: ["guardian"],
    topic: "CLASSES",
    keywords: ["child", "parent", "link", "son", "daughter"],
    body: [
      "Your child's tutor or school links your account to your child. You'll get an email when they do.",
      "Then your home page shows each child: their courses, what's due, marks they've been given, attendance, and any notes from their tutors.",
      "If you can't see a child, ask their tutor to link you, using the email address you sign in with.",
    ],
  },
  {
    id: "pay-fees",
    title: "Pay fees",
    who: FAMILY,
    topic: "PAYMENTS",
    keywords: ["invoice", "card", "payment", "school fees", "pay"],
    body: [
      "1. Choose Fees in the menu. Fees you owe are ticked; untick any you want to pay later.",
      "2. If you have a discount code, add it before you pay.",
      "3. Choose Pay. You'll enter your card details on a secure payment page, then come back to Nexa.",
      "Your fees show as paid as soon as the payment goes through, usually within a minute. You'll get a receipt by email.",
      "Paying in cash or by bank transfer? Pay your tutor or school as usual. They'll mark the fee as paid.",
    ],
  },
  {
    id: "payment-failed",
    title: "My payment didn't go through",
    who: ["learner", "guardian", "staff"],
    topic: "PAYMENTS",
    keywords: ["declined", "failed", "card", "charged twice", "pending"],
    body: [
      "If the payment page said it was declined, no money was taken. Check the card details and your available balance, or try another card.",
      "If money left your account but Nexa still shows the fee or invoice as unpaid, wait 15 minutes and reload the page: some banks confirm slowly.",
      "Still unpaid after an hour? Send us a query under \"Fees and payments\" with the date, the amount and the last four digits of the card. Don't pay again in the meantime.",
    ],
  },

  /* ------------------------------- Staff ------------------------------- */
  {
    id: "add-students",
    title: "Add students",
    who: ["staff"],
    topic: "CLASSES",
    keywords: ["invite", "enrol", "sign-in card", "learners", "import"],
    body: [
      "One at a time: open Students and choose Add student. Students without an email get a sign-in code; print their sign-in cards from the same page.",
      "Many at once: choose Import from a spreadsheet. You'll see what will be added before anything changes, and you can undo an import afterwards.",
      "To link a parent, open the student and choose Link a parent.",
    ],
  },
  {
    id: "create-course",
    title: "Create a course and add lessons",
    who: ["staff"],
    topic: "CLASSES",
    keywords: ["course", "lesson", "content", "publish"],
    body: [
      "1. Open Courses and choose New course.",
      "2. Add lessons in the order students should take them. Students see a lesson once it's published.",
      "3. Add students yourself, or list the course in Find courses (in the course's settings) so families can ask to join.",
    ],
  },
  {
    id: "create-test",
    title: "Set and mark a test",
    who: ["staff"],
    topic: "TESTS",
    keywords: ["quiz", "assessment", "marking", "grading", "answer key"],
    body: [
      "1. Open Tests and choose New test. Add questions and the correct answers: questions with set answers are marked for you.",
      "2. Choose when it opens and when it's due, then publish it. Students are told.",
      "3. When students hand in, open the test's submissions to mark written answers and add comments.",
      "4. Choose Save and share mark for each student. The student gets a notification, and they and their parents can see the mark.",
    ],
  },
  {
    id: "register",
    title: "Take attendance",
    who: ["staff"],
    topic: "CLASSES",
    keywords: ["register", "attendance", "absent", "late"],
    body: [
      "Open Calendar and choose the class. Mark each student present, late or absent.",
      "When you mark a student absent, their parents get an email straight away.",
    ],
  },
  {
    id: "fees-staff",
    title: "Send fees and record payments",
    who: ["staff"],
    topic: "PAYMENTS",
    keywords: ["invoice", "fees", "cash", "eft", "bank transfer", "payouts"],
    body: [
      "Open Fees to send a fee to a student or a whole course. Families pay by card from their own Fees page.",
      "If a family pays you in cash or by bank transfer, open the fee and mark it as paid, so it stops showing as owed.",
      "Card payments go to the bank account you set up under Settings, Payouts. The first payment to a new bank account can take a few extra days while the account is checked.",
    ],
  },
  {
    id: "plan-billing",
    title: "Your Nexa plan and invoices",
    who: ["staff"],
    topic: "SUBSCRIPTION",
    keywords: ["plan", "subscription", "billing", "invoice", "card", "pro", "plus"],
    body: [
      "Open Billing to see your plan for each course, what your next payment will be, and past invoices.",
      "You pay for each active student on a course, every 30 days. A student who joins partway through is added to the next payment for the days they were there.",
      "If a payment fails, we try again and tell you. If it stays unpaid, your organisation is locked: students can still see their work, but you can't make changes until it's paid.",
    ],
  },
  {
    id: "members-roles",
    title: "Invite staff and choose what they can do",
    who: ["staff"],
    topic: "ACCOUNT",
    keywords: ["members", "admin", "tutor", "roles", "permissions", "branch"],
    body: [
      "Open Members and invite people by email. Choose a role: Admin runs the whole organisation; Tutor teaches their own courses.",
      "Need something in between, such as finance or a branch manager? Open Settings, Roles. Start from one of the ready-made roles and tick what they may do.",
    ],
  },

  /* ------------------------------ Everyone ------------------------------ */
  {
    id: "notifications",
    title: "Choose which emails you get",
    who: EVERYONE_SIGNED_IN,
    topic: "ACCOUNT",
    keywords: ["emails", "notifications", "too many", "unsubscribe", "digest"],
    body: [
      "Open Settings, Notifications. Choose whether updates are emailed straight away, or gathered into one email a day or a week.",
      "Everything also appears under Notifications in the menu, so you won't miss it if you turn emails off.",
    ],
  },
  {
    id: "report-problem",
    title: "Something isn't working",
    who: ["learner", "guardian", "staff", "public"],
    topic: "APP",
    keywords: ["bug", "error", "broken", "slow", "crash", "not loading"],
    body: [
      "First, reload the page. If you're on a phone, check your connection.",
      "Still broken? Report a problem from Help. Tell us what you were trying to do, what happened instead, and add a screenshot if you can. We'll see which page you came from.",
    ],
  },
  {
    id: "delete-account",
    title: "Delete my account",
    who: EVERYONE_SIGNED_IN,
    topic: "ACCOUNT",
    keywords: ["close account", "remove", "privacy", "my data", "export"],
    body: [
      "Open Settings, then your account, and choose to delete it. You have a few days to change your mind; after that your personal details and work are removed.",
      "You can download a copy of your data from the same page first.",
    ],
  },
  {
    id: "family-access",
    title: "My child's tutor or school uses Nexa. How do I get in?",
    who: ["public"],
    topic: "ACCOUNT",
    keywords: ["parent", "student", "invite", "access", "sign up", "code"],
    body: [
      "Your tutor or school adds you. Students get an invitation email or a sign-in card with a code; parents get an email once they're linked to their child.",
      "Haven't had anything? Ask the tutor or school which email address they used for you, and check your spam folder.",
      "You can also create an account from the home page and then ask to join their course under Find courses.",
    ],
  },
  {
    id: "start-on-nexa",
    title: "Start using Nexa as a tutor or school",
    who: ["public"],
    topic: "SUBSCRIPTION",
    keywords: ["sign up", "pricing", "trial", "organisation", "school"],
    body: [
      "Create an account from the home page and choose that you teach. Your first weeks are free while you set up; you only pay for students on your courses after that.",
      "Running a school or a team of tutors? Send us a query: we'll help you move your students and staff across.",
    ],
  },
];

/** Articles for a persona, most useful first (the list order). */
export function articlesFor(persona: HelpAudience): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.who.includes(persona));
}

/** A simple search over titles, keywords and text. */
export function searchArticles(articles: readonly HelpArticle[], query: string): HelpArticle[] {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return [...articles];
  const scored = articles.map((a) => {
    const title = a.title.toLowerCase();
    const keys = (a.keywords ?? []).join(" ").toLowerCase();
    const text = a.body.join(" ").toLowerCase();
    let score = 0;
    for (const w of words) score += (title.includes(w) ? 5 : 0) + (keys.includes(w) ? 3 : 0) + (text.includes(w) ? 1 : 0);
    return { a, score };
  });
  return scored.filter((s) => s.score > 0).sort((x, y) => y.score - x.score).map((s) => s.a);
}
