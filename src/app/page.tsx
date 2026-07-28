/**
 * / — public marketing landing.
 *
 * Server Component. Marketing hero with texture, animated hero content,
 * a feature grid, three-step "how it works", a mock dashboard, FAQ, and
 * CTAs. Textures use inline SVG data URIs so no image assets are needed.
 * Animations are pure CSS (a scoped <style> tag scopes keyframes to the
 * page) so no client bundle is required.
 */

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Bell,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Mail,
  Pencil,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

/* ─── App name + mailto helpers ───────────────────────────────────────── */

const APP_NAME = "Nexa LMS";
const APP_TAGLINE = "A calm learning space for tutors and their students.";

const SIGNUP_EMAIL = "nkosijassiel@gmail.com";
const SIGNUP_SUBJECT = "Nexa LMS access request";
const SIGNUP_BODY = [
  "Hi,",
  "",
  "I would like an account on Nexa LMS.",
  "",
  "  Name:  ",
  "  Role:  (Student / Tutor)",
  "  Course / class (optional):  ",
  "",
  "Please let me know the next steps.",
  "",
  "Thanks!",
].join("\n");

const mailtoHref = `mailto:${SIGNUP_EMAIL}?subject=${encodeURIComponent(
  SIGNUP_SUBJECT,
)}&body=${encodeURIComponent(SIGNUP_BODY)}`;

export const metadata = { title: APP_NAME };

/* ─── Texture tokens (kept as CSS custom properties so sections can    */
/*     re-use them consistently)                                        */

const DOT_GRID_BG =
  "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.08) 1px, transparent 0)";
const NOISE_GRAIN_BG =
  // Inline SVG turbulence noise → adds a subtle paper-like grain over solid fills
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='4'/><feColorMatrix values='0 0 0 0 0.02 0 0 0 0 0.02 0 0 0 0 0.02 0 0 0 0.55 0'/></filter><rect width='140' height='140' filter='url(%23n)' opacity='0.6'/></svg>\")";

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <PageStyles />
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <ScreenshotBlock />
        <Faq />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}

/* ─── Scoped keyframes + prefers-reduced-motion opt-out ──────────────── */

function PageStyles() {
  return (
    <style>{`
      @keyframes rise {
        from { opacity: 0; transform: translateY(14px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes drift {
        0%, 100% { transform: translateY(0) translateX(0); }
        50%      { transform: translateY(-14px) translateX(8px); }
      }
      @keyframes shimmer {
        0%   { background-position: 0% 50%; }
        100% { background-position: 200% 50%; }
      }
      @keyframes marquee {
        from { transform: translateX(0); }
        to   { transform: translateX(-50%); }
      }
      @keyframes pulseRing {
        0%   { box-shadow: 0 0 0 0 rgba(234,88,12,0.35); }
        70%  { box-shadow: 0 0 0 14px rgba(234,88,12,0); }
        100% { box-shadow: 0 0 0 0 rgba(234,88,12,0); }
      }
      .rise-in       { animation: rise 700ms ease-out both; }
      .rise-in-2     { animation: rise 700ms ease-out 120ms both; }
      .rise-in-3     { animation: rise 700ms ease-out 240ms both; }
      .rise-in-4     { animation: rise 700ms ease-out 360ms both; }
      .drift-slow    { animation: drift 9s ease-in-out infinite; }
      .drift-slower  { animation: drift 14s ease-in-out infinite; }
      .shimmer-text {
        background-image: linear-gradient(90deg,#0f172a 0%,#ea580c 45%,#0f172a 90%);
        background-size: 200% 100%;
        background-clip: text;
        -webkit-background-clip: text;
        color: transparent;
        animation: shimmer 6s ease-in-out infinite;
      }
      .cta-pulse::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        animation: pulseRing 2.4s ease-out infinite;
        pointer-events: none;
      }
      .marquee-track { animation: marquee 40s linear infinite; }
      @media (prefers-reduced-motion: reduce) {
        .rise-in, .rise-in-2, .rise-in-3, .rise-in-4,
        .drift-slow, .drift-slower, .shimmer-text,
        .cta-pulse::after, .marquee-track {
          animation: none !important;
        }
      }
    `}</style>
  );
}

/* ─── Header ────────────────────────────────────────────────────────── */

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="relative flex size-8 items-center justify-center overflow-hidden rounded-md bg-slate-900 text-white">
            <GraduationCap className="size-4" />
            <span className="pointer-events-none absolute -inset-1 bg-gradient-to-br from-orange-500/30 via-transparent to-transparent" />
          </div>
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </Link>
        <nav className="flex items-center gap-2">
          <a
            href={mailtoHref}
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 sm:inline-flex"
          >
            Request access
          </a>
          <Link
            href="/auth"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

/* ─── Hero ─────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200/70">
      {/* Warm radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 500px at 50% -20%, rgba(251,146,60,0.18), transparent 70%)",
        }}
      />
      {/* Dot grid overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage: DOT_GRID_BG,
          backgroundSize: "22px 22px",
          maskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
      />
      {/* Floating decorative shapes */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-24 left-8 hidden size-24 rounded-3xl border border-orange-200/70 bg-orange-100/40 shadow-inner drift-slow md:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-16 right-10 hidden size-32 rounded-full border border-slate-200/70 bg-white/60 shadow-inner drift-slower md:block"
      />

      <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="rise-in mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-100/70 px-3 py-1 text-xs font-medium text-orange-700 shadow-sm">
            <ShieldCheck className="size-3" />
            Invite-only · onboarded by your tutor
          </p>
          <h1 className="rise-in-2 text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
            <span className="shimmer-text">{APP_TAGLINE}</span>
          </h1>
          <p className="rise-in-3 mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            {APP_NAME} keeps courses, lessons, assessments, and grades in
            one calm interface. No feature bloat — just the shape of a
            good class.
          </p>
          <div className="rise-in-4 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={mailtoHref}
              className="cta-pulse relative inline-flex items-center gap-2 rounded-md bg-orange-600 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-orange-600/20 transition-transform hover:-translate-y-0.5 hover:bg-orange-700"
            >
              <Mail className="size-4" />
              Request access
            </a>
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white/80 px-5 py-3 text-sm font-medium text-slate-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white"
            >
              Sign in
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <p className="rise-in-4 mt-4 text-xs text-slate-500">
            Requesting access opens your email app with a short message pre-filled.
          </p>
        </div>

        {/* Trust marquee — courses/subjects a small tutoring practice might teach.
            Purely decorative texture; duplicates content once so the loop is seamless. */}
        <div
          className="relative mt-16 overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
          }}
        >
          <div className="marquee-track flex gap-8 whitespace-nowrap text-xs font-medium text-slate-500">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((label, i) => (
              <span
                key={`${label}-${i}`}
                className="inline-flex items-center gap-2"
              >
                <span className="size-1.5 rounded-full bg-orange-400" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const MARQUEE_ITEMS = [
  "Grade 11 Maths",
  "IEB Physics",
  "Cambridge English",
  "IGCSE History",
  "Introductory Economics",
  "AP Calculus",
  "Grade 12 Life Sciences",
  "SAT Prep",
];

/* ─── Features ─────────────────────────────────────────────────────── */

const FEATURES: {
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    icon: BookOpen,
    title: "Courses & lessons",
    body: "Tutors publish structured lessons with markdown, LaTeX (MathJax), embedded videos, and downloadable resources.",
  },
  {
    icon: Target,
    title: "Tests & quizzes",
    body: "12 question types including matching, reorder, fill-in-the-blank, and file upload — with sub-questions and context blocks.",
  },
  {
    icon: Pencil,
    title: "Assignments",
    body: "File-drop submissions with attempt tracking, deadlines, and per-file feedback for the tutor.",
  },
  {
    icon: GraduationCap,
    title: "Per-question grading",
    body: "Grade every answer individually with markdown feedback. Students see their own answer next to each grade.",
  },
  {
    icon: CalendarDays,
    title: "Shared schedule",
    body: "Lectures, exams, meetings, and due dates all land on one calendar. Toggle between month and list views.",
  },
  {
    icon: Bell,
    title: "Notifications",
    body: "Grades, assignments, and test releases fan out automatically. No inbox archaeology.",
  },
];

function Features() {
  return (
    <section className="relative border-b border-slate-200 py-20 sm:py-24">
      {/* Subtle paper grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ backgroundImage: NOISE_GRAIN_BG }}
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
            <Sparkles className="size-3 text-orange-600" />
            Built for small tutoring practices
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            What&apos;s inside
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Everything a small tutoring practice needs. Nothing it doesn&apos;t.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} feature={f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  feature,
}: {
  feature: (typeof FEATURES)[number];
}) {
  const Icon = feature.icon;
  return (
    <div className="group relative rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 rounded-t-lg bg-gradient-to-r from-orange-400/0 via-orange-400/70 to-orange-400/0 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="mb-4 flex size-11 items-center justify-center rounded-md bg-gradient-to-br from-orange-100 to-orange-50 text-orange-700 ring-1 ring-orange-200/60 transition-transform group-hover:scale-110">
        <Icon className="size-5" />
      </div>
      <h3 className="text-lg font-medium tracking-tight text-slate-900">
        {feature.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {feature.body}
      </p>
    </div>
  );
}

/* ─── How it works ──────────────────────────────────────────────────── */

const STEPS: { title: string; body: string }[] = [
  {
    title: "Request access",
    body: "Send us an email. We create your account (student or tutor) and add you to the right course.",
  },
  {
    title: "Sign in",
    body: "You get an email with your credentials. Sign in and you land on a personal dashboard for your role.",
  },
  {
    title: "Learn or teach",
    body: "Students see courses, tests, and grades. Tutors author lessons and assessments, then grade student work.",
  },
];

function HowItWorks() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 py-20 sm:py-24">
      {/* Warm tinted band with dot grid */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-orange-50/50 via-slate-50/70 to-white"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{ backgroundImage: DOT_GRID_BG, backgroundSize: "24px 24px" }}
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            How it works
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Three steps from &ldquo;interested&rdquo; to &ldquo;in class.&rdquo;
          </p>
        </div>
        {/* Steps + a connecting line on md+ */}
        <div className="relative mt-14">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-6 hidden h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-orange-300 to-transparent md:block"
          />
          <ol className="relative grid grid-cols-1 gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className="relative rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-transform hover:-translate-y-1"
              >
                <div className="cta-pulse relative mb-3 inline-flex size-10 items-center justify-center rounded-full bg-orange-600 text-sm font-semibold text-white shadow-md">
                  {i + 1}
                </div>
                <h3 className="text-lg font-medium tracking-tight text-slate-900">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ─── Screenshot mock ───────────────────────────────────────────────── */

function ScreenshotBlock() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 py-20 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 400px at 80% 20%, rgba(251,146,60,0.10), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            A dashboard that stays out of the way
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Your day &mdash; up-next deadlines, in-progress lessons, and recent
            grades &mdash; all on one screen.
          </p>
        </div>
        <div className="mt-12">
          <MockDashboard />
        </div>
      </div>
    </section>
  );
}

function MockDashboard() {
  return (
    <div className="relative mx-auto max-w-4xl">
      {/* Glow behind the card */}
      <div
        aria-hidden
        className="absolute -inset-4 rounded-2xl bg-gradient-to-r from-orange-300/30 via-orange-100/40 to-slate-200/40 blur-2xl"
      />
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-yellow-400/70" />
          <span className="size-2.5 rounded-full bg-green-400/70" />
          <span className="ml-3 text-xs text-slate-500">
            {APP_NAME} · Dashboard
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-green-500" />
            </span>
            Live
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
          <MockCard title="Progress" value="72%" hint="8 of 11 lessons" />
          <MockCard title="Up next" value="3" hint="2 tests · 1 assignment" />
          <MockCard title="Average" value="86%" hint="across 12 grades" />
          <div className="col-span-full rounded-lg border border-slate-200 bg-slate-50/40 p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
              Up next
            </p>
            <ul className="space-y-2 text-sm">
              {[
                { label: "Calculus quiz", meta: "Due Fri · 45 min", tag: "Test" },
                { label: "Essay: causes of WWI", meta: "Due Mon · Draft", tag: "Assignment" },
                { label: "Lab session", meta: "Wed 3:00pm", tag: "Event" },
              ].map((r) => (
                <li
                  key={r.label}
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 transition-transform hover:-translate-y-0.5 hover:shadow"
                >
                  <span className="flex items-center gap-2 text-slate-800">
                    <span className="size-1.5 rounded-full bg-orange-500" />
                    {r.label}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{r.meta}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                      {r.tag}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

/* ─── FAQ ──────────────────────────────────────────────────────────── */

const FAQ: { q: string; a: string }[] = [
  {
    q: "Can I sign up myself?",
    a: "Not directly — accounts are created for you by a tutor or the platform admin. That keeps course rosters tidy and prevents random signups. Click 'Request access' and we'll set you up.",
  },
  {
    q: "What kinds of questions do the tests support?",
    a: "Multiple choice, multi-select, true/false, short answer, essay, numeric, fill-in-the-blank, matching, reorder, code, file upload — plus 'context' parent blocks that group sub-questions.",
  },
  {
    q: "Can tutors write math?",
    a: "Yes. Lesson descriptions, question prompts, and tutor feedback all render with MathJax — inline math with $…$ and display math with $$…$$.",
  },
  {
    q: "Can I bulk-create tests?",
    a: "Yes — the tutor test editor supports JSON import. Copy the built-in LLM prompt, ask ChatGPT/Claude to generate the JSON, and paste it back in.",
  },
];

function Faq() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 py-20 sm:py-24">
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-white via-slate-50/60 to-white"
      />
      <div className="relative mx-auto max-w-3xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Common questions
          </h2>
        </div>
        <dl className="mt-12 space-y-6">
          {FAQ.map((item) => (
            <div
              key={item.q}
              className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1 origin-top scale-y-0 bg-orange-500 transition-transform group-hover:scale-y-100"
              />
              <dt className="text-base font-medium text-slate-900">{item.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-slate-600">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ─── Closing CTA ──────────────────────────────────────────────────── */

function ClosingCta() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 py-24">
      {/* Big warm gradient with dot grid overlay */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1000px 500px at 50% 0%, rgba(251,146,60,0.18), transparent 70%), linear-gradient(to bottom, #fff, #fff)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ backgroundImage: DOT_GRID_BG, backgroundSize: "22px 22px" }}
      />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Ready when you are.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-slate-600">
          Send us a note — we&apos;ll set up your account, add you to your
          course, and send credentials.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={mailtoHref}
            className="cta-pulse relative inline-flex items-center gap-2 rounded-md bg-orange-600 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-orange-600/20 transition-transform hover:-translate-y-0.5 hover:bg-orange-700"
          >
            <Mail className="size-4" />
            Request access
          </a>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white"
          >
            <CheckCircle2 className="size-4" />
            I already have an account
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ───────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-xs text-slate-500 sm:flex-row">
        <p>
          © {new Date().getFullYear()} {APP_NAME}. Learning, well composed.
        </p>
        <div className="flex items-center gap-4">
          <a href={mailtoHref} className="hover:text-slate-800">
            Contact
          </a>
          <Link href="/privacy-policy" className="hover:text-slate-800">
            Privacy
          </Link>
          <Link href="/terms-of-service" className="hover:text-slate-800">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
