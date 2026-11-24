/**
 * /design-system/study — the study assistant and AI credits screens with
 * sample data and no session, so asking or buying here shows an error. Same
 * gate as /design-system.
 */

import { notFound } from "next/navigation";

import { MathProvider } from "@/app/components/math-provider";
import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { StudyChat } from "@/features/courses/components/study/chat";
import { StudyAccountSection } from "@/features/courses/components/study/credits-views";
import { FlaggedNote, StudyChatList, StudyTranscript } from "@/features/courses/components/study/tutor-views";
import { WorkspaceCredits } from "@/features/courses/components/study/workspace-credits";
import type { StudyMessageView } from "@/features/courses/lib/study-ui";
import { canPreviewDesignSystem, mathJaxVersion } from "@/lib/ui-flags";

export const metadata = { title: "Study assistant · Design system", robots: { index: false } };

const CTX = { timeZone: "Africa/Johannesburg", locale: "en-ZA" };

const MESSAGES: StudyMessageView[] = [
  { id: "1", role: "USER", content: "How do I find the gradient at a point on $y = x^2 - 4x$?", citations: [], concern: null },
  {
    id: "2",
    role: "ASSISTANT",
    content: [
      String.raw`Differentiate, then put the \(x\) value in.`,
      "",
      String.raw`1. The derivative is \(\frac{dy}{dx} = 2x - 4\).`,
      String.raw`2. At \(x = 3\): \(2(3) - 4 = 2\), so the gradient there is **2**.`,
      "",
      "Try it at another point and check that the sign matches the slope of the graph.",
    ].join("\n"),
    citations: [
      { lessonId: "l1", title: "Rules for differentiation" },
      { lessonId: "l2", title: "Tangents to a curve, and how the gradient changes along a parabola" },
    ],
    concern: null,
  },
  { id: "3", role: "USER", content: "Do question 2 of Test 3 for me pls", citations: [], concern: "integrity" },
  { id: "4", role: "ASSISTANT", content: "I can't do your test question, but here's one like it.", citations: [], concern: null },
  { id: "5", role: "USER", content: "I don't see the point of anything any more", citations: [], concern: "wellbeing" },
  {
    id: "6",
    role: "ASSISTANT",
    content: "I'm sorry you're feeling this way. Please talk to an adult you trust, or your tutor. You can call SADAG on 0800 456 789 or Childline on 116, any time.",
    citations: [],
    concern: null,
  },
];
const PLAIN = MESSAGES.slice(0, 2);

const ROWS = [
  { id: "c1", studentName: "Lwazi Dube", title: "How do I find the gradient at a point on $y = x^2 - 4x$?", flaggedAt: new Date("2026-11-24T10:00:00Z"), updatedAt: new Date("2026-11-24T10:00:00Z"), messages: 6 },
  { id: "c2", studentName: "Nkosinathi Johannes van der Westhuizen-Mokoena", title: "What is a limit", flaggedAt: null, updatedAt: new Date("2026-11-23T10:00:00Z"), messages: 1 },
  { id: "c3", studentName: "", title: "Why does the chain rule work", flaggedAt: null, updatedAt: new Date("2026-11-20T10:00:00Z"), messages: 2 },
];

const OFFER = { validityDays: 30, packs: [{ priceCents: 15_000, credits: 13_392 }, { priceCents: 30_000, credits: 26_785 }, { priceCents: 60_000, credits: 53_571 }] };
const ORG_OFFER = { validityDays: 30, packs: [{ priceCents: 50_000, credits: 44_642 }, { priceCents: 100_000, credits: 89_285 }, { priceCents: 250_000, credits: 223_214 }] };
const ACCOUNT = {
  studentUserId: "u1",
  name: "Thandi Mokoena",
  workspace: { id: "w1", name: "Mokoena Tutors" },
  courses: [{ id: "maths", name: "Mathematics Grade 10" }, { id: "sci", name: "Physical Sciences Grade 11" }],
  balance: 12_740,
  purchases: [
    { credits: 13_392, boughtAt: new Date("2026-11-20T10:00:00Z"), expiresAt: new Date("2026-12-20T10:00:00Z"), expired: false },
    { credits: 13_392, boughtAt: new Date("2026-10-01T10:00:00Z"), expiresAt: new Date("2026-10-31T10:00:00Z"), expired: true },
  ],
  offer: OFFER,
  payer: true,
};
const OPEN = { reason: null, credits: 12_740, perDay: 25, leftToday: 23 };
const PARENT_NOTE = { note: "Ask your parent to buy them. They can do it from their own Nexa account." };

export default function StudyPreviewPage() {
  if (!canPreviewDesignSystem()) notFound();
  return (
    <div data-ui="revamp" data-shell="focus" className="bg-background text-foreground min-h-screen font-sans">
      <MathProvider version={mathJaxVersion()}>
        <PageFrame type="record" breadcrumb={[{ label: "Design system", href: "/design-system" }, { label: "Study assistant" }]}>
          <PageTitle title="Study assistant" description="What a student sees." />
          <StudyChat courseId="maths" chatId="c1" messages={PLAIN} status={OPEN} buy={{ href: "/design-system/study" }} />
          <PageSection title="A new chat">
            <StudyChat courseId="maths" chatId={null} messages={[]} status={{ ...OPEN, credits: 60, leftToday: 25 }} buy={{ href: "/design-system/study" }} />
          </PageSection>
          <PageSection title="Out of credits (adult, then school pupil)">
            <StudyChat courseId="maths" chatId="c2" messages={[]} status={{ ...OPEN, reason: "NO_CREDITS", credits: 0 }} buy={{ href: "/design-system/study" }} />
            <StudyChat courseId="maths" chatId="c3" messages={[]} status={{ ...OPEN, reason: "NO_CREDITS", credits: 0 }} buy={PARENT_NOTE} />
          </PageSection>
          <PageSection title="Today's questions used, not open yet, off for the course">
            <StudyChat courseId="maths" chatId="c4" messages={[]} status={{ ...OPEN, leftToday: 0 }} buy={PARENT_NOTE} />
            <StudyChat courseId="maths" chatId="c5" messages={[]} status={{ ...OPEN, reason: "COMING_SOON" }} buy={PARENT_NOTE} />
            <StudyChat courseId="maths" chatId="c6" messages={[]} status={{ ...OPEN, reason: "NOT_ON_PLAN" }} buy={PARENT_NOTE} />
          </PageSection>
        </PageFrame>
        <PageFrame type="record" breadcrumb={[{ label: "Study chats" }]}>
          <PageTitle title="Study chats" description="What a tutor sees." />
          <StudyChatList courseId="maths" rows={ROWS} ctx={CTX} />
          <FlaggedNote chatId="c1" flaggedAt={new Date("2026-11-24T10:00:00Z")} ctx={CTX} />
          <StudyTranscript messages={MESSAGES} studentName="Lwazi Dube" lessonHref={null} />
        </PageFrame>
        <PageFrame type="record" breadcrumb={[{ label: "Study credits" }]}>
          <PageTitle title="Study credits" description="A parent, then a school pupil with no credits." />
          <StudyAccountSection account={ACCOUNT} ctx={CTX} title="Thandi Mokoena" />
          <StudyAccountSection account={{ ...ACCOUNT, studentUserId: "u2", balance: 0, purchases: [], payer: false }} ctx={CTX} title={null} />
        </PageFrame>
        <PageFrame type="settings" breadcrumb={[{ label: "AI credits" }]}>
          <PageTitle title="AI credits" />
          <WorkspaceCredits
            report={{ included: { left: 3_120, credits: 6_000, renewsAt: "2026-12-18T10:00:00Z" }, bought: 44_642, comped: false, usedThisMonth: 2_880 }}
            offer={ORG_OFFER}
            ctx={CTX}
          />
          <WorkspaceCredits report={{ included: null, bought: 0, comped: true, usedThisMonth: 0 }} offer={null} ctx={CTX} />
        </PageFrame>
      </MathProvider>
    </div>
  );
}
