/**
 * / — public marketing landing.
 *
 * Server Component. The page is built from the same Inkwell tokens as the
 * dashboard — parchment background, Fraunces display serif, terracotta as
 * the single accent — so someone signing in doesn't cross a visual border
 * between the marketing site and the product.
 *
 * Illustrations come from /public/illustrations. Motion lives in small
 * client islands (app/components/motion.tsx) so only the wrappers ship
 * framer-motion; all copy stays server-rendered, and every animation is a
 * no-op under `prefers-reduced-motion`.
 */

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Bell,
  CalendarDays,
  CheckCircle2,
  FileText,
  GraduationCap,
  Mail,
  PenTool,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { APP_CONTACT, APP_NAME, APP_TAGLINE } from "@/lib/branding";

import { Float, HeroIn, Reveal, Stagger, StaggerItem } from "./components/motion";

/* ─── Access-request mailto ────────────────────────────────────────────── */

const SIGNUP_SUBJECT = `${APP_NAME} access request`;
const SIGNUP_BODY = [
  "Hi,",
  "",
  `I would like an account on ${APP_NAME}.`,
  "",
  "  Name:  ",
  "  Role:  (Student / Tutor)",
  "  Course / class (optional):  ",
  "",
  "Please let me know the next steps.",
  "",
  "Thanks!",
].join("\n");

const mailtoHref = `mailto:${APP_CONTACT.email}?subject=${encodeURIComponent(
  SIGNUP_SUBJECT,
)}&body=${encodeURIComponent(SIGNUP_BODY)}`;

export const metadata = { title: APP_NAME, description: APP_TAGLINE };

/* ─── Content ──────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: BookOpen,
    title: "Courses & lessons",
    body: "Structured lessons with markdown, LaTeX via MathJax, embedded video, and downloadable resources.",
  },
  {
    icon: FileText,
    title: "Tests & quizzes",
    body: "Twelve question types — matching, reorder, fill-in-the-blank, file upload — with sub-questions and context blocks.",
  },
  {
    icon: PenTool,
    title: "Assignments",
    body: "File-drop submissions with attempt tracking, deadlines, per-section marks and memo files.",
  },
  {
    icon: CheckCircle2,
    title: "Grading that explains itself",
    body: "Mark every answer individually with markdown feedback. Students see their answer next to the comment.",
  },
  {
    icon: CalendarDays,
    title: "One shared schedule",
    body: "Lectures, exams, meetings and due dates on a single calendar, with repeating events for anything weekly.",
  },
  {
    icon: Bell,
    title: "Notifications",
    body: "Grades, assignments and test releases fan out automatically. No inbox archaeology.",
  },
] as const;

const STEPS = [
  {
    title: "Request access",
    body: "Send an email. We create your account — student or tutor — and add you to the right course.",
    art: "/illustrations/planning.svg",
  },
  {
    title: "Sign in",
    body: "Your credentials arrive by email. Signing in drops you on a dashboard built for your role.",
    art: "/illustrations/research-paper.svg",
  },
  {
    title: "Learn or teach",
    body: "Students work through courses, tests and grades. Tutors author material, then mark what comes back.",
    art: "/illustrations/success-factors.svg",
  },
] as const;

const FAQ = [
  {
    q: "Can I sign up myself?",
    a: "Not directly — accounts are created for you by a tutor or the platform admin. That keeps course rosters tidy and prevents random signups. Request access and we'll set you up.",
  },
  {
    q: "What kinds of questions do the tests support?",
    a: "Multiple choice, multi-select, true/false, short answer, essay, numeric, fill-in-the-blank, matching, reorder, code and file upload — plus 'context' parent blocks that group sub-questions.",
  },
  {
    q: "Can tutors write maths?",
    a: "Yes. Lesson text, question prompts and tutor feedback all render through MathJax — inline maths with $…$ and display maths with $$…$$.",
  },
  {
    q: "Can I bulk-create tests?",
    a: "Yes — the test editor imports JSON. Copy the built-in prompt, have an LLM generate the JSON, and paste it back. Exported tests re-import unchanged.",
  },
] as const;

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="bg-background text-foreground min-h-screen antialiased">
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Audiences />
        <Faq />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}

/* ─── Header ───────────────────────────────────────────────────────────── */

function Header() {
  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
            <GraduationCap className="size-4" />
          </span>
          <span className="font-display text-lg leading-none tracking-tight">
            {APP_NAME}
          </span>
        </Link>
        <nav className="flex items-center gap-1.5">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <a href={mailtoHref}>Request access</a>
          </Button>
          <Button asChild size="sm">
            <Link href="/auth">Sign in</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

/* ─── Hero ─────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="border-border/60 relative overflow-hidden border-b">
      {/* A single warm bloom behind the headline, plus a faint dot grid.
          Both are decorative and inert to screen readers. */}
      <div
        aria-hidden
        className="bg-brand-terracotta/10 pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, var(--muted-foreground) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 sm:py-28 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <HeroIn>
            <Badge variant="soft" className="mb-5">
              <Sparkles className="mr-1 size-3" />
              Built for small classes
            </Badge>
          </HeroIn>

          <HeroIn delay={0.08}>
            <h1 className="font-display text-4xl leading-[1.08] tracking-tight text-foreground sm:text-6xl">
              A calm place to
              <span className="text-brand-terracotta"> teach</span> and
              <span className="text-brand-terracotta"> learn</span>.
            </h1>
          </HeroIn>

          <HeroIn delay={0.16}>
            <p className="text-muted-foreground mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
              Lessons, assessments, grading and the schedule in one place —
              without the noise of a university-scale platform. {APP_NAME} is
              built for a tutor and the students they actually know.
            </p>
          </HeroIn>

          <HeroIn delay={0.24}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild variant="brand" size="lg">
                <a href={mailtoHref}>
                  <Mail className="size-4" />
                  Request access
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth">
                  Sign in
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </HeroIn>

          <HeroIn delay={0.32}>
            <dl className="border-border/60 mt-10 grid max-w-md grid-cols-3 gap-4 border-t pt-6">
              {[
                { k: "12", v: "question types" },
                { k: "MathJax", v: "in every field" },
                { k: "0", v: "ads, ever" },
              ].map((s) => (
                <div key={s.v}>
                  <dt className="font-display text-xl leading-none text-foreground">
                    {s.k}
                  </dt>
                  <dd className="text-muted-foreground mt-1 text-xs">{s.v}</dd>
                </div>
              ))}
            </dl>
          </HeroIn>
        </div>

        <HeroIn delay={0.2} className="relative">
          <Float>
            <div className="relative mx-auto aspect-square w-full max-w-lg">
              <Image
                src="/illustrations/teacher-student.svg"
                alt=""
                fill
                priority
                className="object-contain"
                sizes="(max-width: 1024px) 80vw, 480px"
              />
            </div>
          </Float>
        </HeroIn>
      </div>
    </section>
  );
}

/* ─── Features ─────────────────────────────────────────────────────────── */

function Features() {
  return (
    <section className="border-border/60 border-b py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="max-w-2xl">
          <p className="text-brand-terracotta text-xs font-medium uppercase tracking-wider">
            What&apos;s inside
          </p>
          <h2 className="font-display mt-2 text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
            Everything a course needs, nothing it doesn&apos;t
          </h2>
        </Reveal>

        <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <StaggerItem key={f.title}>
              <Card className="hover:border-brand-terracotta/40 h-full p-6 transition-colors">
                <span className="bg-brand-terracotta/12 text-brand-terracotta flex size-9 items-center justify-center rounded-md">
                  <f.icon className="size-4" />
                </span>
                <h3 className="font-display mt-4 text-lg leading-tight text-foreground">
                  {f.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {f.body}
                </p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ─── How it works ─────────────────────────────────────────────────────── */

function HowItWorks() {
  return (
    <section className="border-border/60 bg-muted/30 border-b py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="max-w-2xl">
          <p className="text-brand-terracotta text-xs font-medium uppercase tracking-wider">
            Getting started
          </p>
          <h2 className="font-display mt-2 text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
            Three steps, one email
          </h2>
        </Reveal>

        <ol className="mt-14 space-y-16">
          {STEPS.map((step, i) => {
            const flip = i % 2 === 1;
            return (
              <li key={step.title}>
                <div className="grid items-center gap-8 md:grid-cols-2">
                  <Reveal
                    from={flip ? "right" : "left"}
                    className={flip ? "md:order-2" : undefined}
                  >
                    <div className="flex items-baseline gap-4">
                      <span className="font-display text-brand-terracotta/40 text-5xl leading-none tabular-nums">
                        {i + 1}
                      </span>
                      <div>
                        <h3 className="font-display text-2xl leading-tight text-foreground">
                          {step.title}
                        </h3>
                        <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
                          {step.body}
                        </p>
                      </div>
                    </div>
                  </Reveal>

                  <Reveal
                    from={flip ? "left" : "right"}
                    delay={0.1}
                    className={flip ? "md:order-1" : undefined}
                  >
                    <div className="relative mx-auto aspect-[4/3] w-full max-w-sm">
                      <Image
                        src={step.art}
                        alt=""
                        fill
                        className="object-contain"
                        sizes="(max-width: 768px) 80vw, 360px"
                      />
                    </div>
                  </Reveal>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ─── Audiences ────────────────────────────────────────────────────────── */

function Audiences() {
  const panels = [
    {
      art: "/illustrations/mathematics-tutor.svg",
      eyebrow: "For tutors",
      title: "Author once, mark faster",
      points: [
        "Write lessons and tests with markdown and maths",
        "Import a whole test from JSON, export it back out",
        "Grade per section, attach a memo, release when ready",
        "Weight assessments however your course actually works",
      ],
    },
    {
      art: "/illustrations/curious.svg",
      eyebrow: "For students",
      title: "Know where you stand",
      points: [
        "Every course, test and deadline on one dashboard",
        "Drafts save as you work — a refresh costs nothing",
        "See the mark next to the answer that earned it",
        "Model answers and memos once they're released",
      ],
    },
  ];

  return (
    <section className="border-border/60 border-b py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-6 px-6 md:grid-cols-2">
        {panels.map((p, i) => (
          <Reveal key={p.eyebrow} delay={i * 0.1}>
            <Card className="flex h-full flex-col p-8">
              <div className="relative mx-auto aspect-[4/3] w-full max-w-64">
                <Image
                  src={p.art}
                  alt=""
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 70vw, 256px"
                />
              </div>
              <p className="text-brand-terracotta mt-6 text-xs font-medium uppercase tracking-wider">
                {p.eyebrow}
              </p>
              <h3 className="font-display mt-2 text-2xl leading-tight text-foreground">
                {p.title}
              </h3>
              <ul className="mt-5 space-y-2.5">
                {p.points.map((point) => (
                  <li key={point} className="flex gap-2.5 text-sm">
                    <CheckCircle2 className="text-brand-terracotta mt-0.5 size-4 shrink-0" />
                    <span className="text-muted-foreground leading-relaxed">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─── FAQ ──────────────────────────────────────────────────────────────── */

function Faq() {
  return (
    <section className="border-border/60 bg-muted/30 border-b py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal>
          <h2 className="font-display text-center text-3xl leading-tight tracking-tight text-foreground sm:text-4xl">
            Common questions
          </h2>
        </Reveal>

        <Stagger className="mt-12 space-y-3">
          {FAQ.map((item) => (
            <StaggerItem key={item.q}>
              <Card className="group border-l-brand-terracotta/0 hover:border-l-brand-terracotta border-l-2 p-6 transition-colors">
                <h3 className="font-medium text-foreground">{item.q}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {item.a}
                </p>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ─── Closing CTA ──────────────────────────────────────────────────────── */

function ClosingCta() {
  return (
    <section className="px-6 py-20 sm:py-24">
      <Reveal className="mx-auto max-w-5xl">
        <div className="border-b-2 border-brand-terracotta bg-primary text-primary-foreground relative overflow-hidden rounded-lg">
          <div
            aria-hidden
            className="bg-brand-terracotta/20 pointer-events-none absolute -right-20 -top-20 size-72 rounded-full blur-3xl"
          />
          <div className="relative grid items-center gap-8 p-10 md:grid-cols-[1.2fr_1fr] sm:p-14">
            <div>
              <h2 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
                Ready when you are
              </h2>
              <p className="text-primary-foreground/70 mt-4 max-w-md text-sm leading-relaxed sm:text-base">
                Accounts are created by hand so rosters stay tidy. Tell us who
                you are and which course you&apos;re joining, and we&apos;ll do
                the rest.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="brand" size="lg">
                  <a href={mailtoHref}>
                    <Mail className="size-4" />
                    Request access
                  </a>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="lg"
                  className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                >
                  <Link href="/auth">
                    I already have an account
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <Float distance={8} duration={8}>
              <div className="relative mx-auto aspect-square w-full max-w-64">
                <Image
                  src="/illustrations/launching.svg"
                  alt=""
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 60vw, 256px"
                />
              </div>
            </Float>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ─── Footer ───────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-border/60 border-t">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
                <GraduationCap className="size-3.5" />
              </span>
              <span className="font-display leading-none tracking-tight">
                {APP_NAME}
              </span>
            </div>
            <p className="text-muted-foreground mt-3 max-w-xs text-sm">
              {APP_TAGLINE}
            </p>
          </div>

          <div className="flex gap-12">
            <div>
              <p className="text-foreground text-xs font-medium uppercase tracking-wider">
                Product
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link
                    href="/auth"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Sign in
                  </Link>
                </li>
                <li>
                  <a
                    href={mailtoHref}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Request access
                  </a>
                </li>
                <li>
                  <Link
                    href="/support"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Support
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-foreground text-xs font-medium uppercase tracking-wider">
                Legal
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link
                    href="/privacy-policy"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms-of-service"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-xs">
          <p>
            © {new Date().getFullYear()} {APP_NAME}. {APP_CONTACT.location}.
          </p>
          <a
            href={`mailto:${APP_CONTACT.email}`}
            className="hover:text-foreground transition-colors"
          >
            {APP_CONTACT.email}
          </a>
        </div>
      </div>
    </footer>
  );
}
