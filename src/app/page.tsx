/**
 * / — the public landing page (#216: B owns the page, A owns plan prices,
 * the enquiry backend, search setup and analytics).
 *
 * Static and almost free of client JavaScript: no animation library, the
 * questions are <details>, and the product pictures are HTML in the app's
 * own tokens (components/landing/snippets.tsx). Photos go through
 * StockPhoto, which data saver switches off. Colours are tokens only, so
 * the page follows Inkwell, the revamp, its themes and dark mode.
 *
 * Copy rules: only what is live in production. Fees and plans stay out
 * until billing is switched on and A's price data is there. Nothing beside
 * a photo may read as that person's words.
 */

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  FileUp,
  GraduationCap,
  IdCard,
  LineChart,
  LogIn,
  Mail,
  PenLine,
  Presentation,
  ShieldCheck,
  Smartphone,
  Type,
  UserPlus,
  Users,
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { ClassSnippet, CoverageSnippet, LessonsSnippet, MarkedSnippet } from "@/components/landing/snippets";
import { StockPhoto, type StockPhotoName } from "@/components/stock-photo";
import { Button } from "@/components/ui/button";
import { APP_CONTACT, APP_NAME, APP_TAGLINE } from "@/lib/branding";

export const metadata = { title: { absolute: APP_NAME }, description: APP_TAGLINE };

/* ─── Getting in ───────────────────────────────────────────────────────── */

/** The same switch as the sign-in page's (components/auth/auth-parts.tsx). */
const signUpOpen = process.env.NEXT_PUBLIC_AUTH_PROVIDER === "better-auth";

const mailto = (subject: string, lines: string[]) =>
  `mailto:${APP_CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;

const accessHref = mailto(`${APP_NAME} access request`, [
  "Hi,",
  "",
  `I would like an account on ${APP_NAME}.`,
  "",
  "  Name:  ",
  "  Role:  (Tutor / Student / Parent)",
  "  Course or class (optional):  ",
  "",
  "Thanks!",
]);

const teamHref = mailto(`${APP_NAME} for our organisation`, [
  "Hi,",
  "",
  `We'd like to know more about ${APP_NAME}.`,
  "",
  "  Organisation:  ",
  "  Number of tutors:  ",
  "  Number of students:  ",
  "",
  "Thanks!",
]);

function StartButton({ size = "lg" }: { size?: "sm" | "lg" }) {
  return (
    <Button asChild variant="brand" size={size}>
      {signUpOpen ? (
        <Link href="/auth/sign-up">
          <UserPlus aria-hidden className="size-4" />
          Create an account
        </Link>
      ) : (
        <a href={accessHref}>
          <Mail aria-hidden className="size-4" />
          Request access
        </a>
      )}
    </Button>
  );
}

/* ─── Content ──────────────────────────────────────────────────────────── */

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#who", label: "Who it's for" },
  { href: "#south-africa", label: "Made for SA" },
  { href: "#questions", label: "Questions" },
] as const;

const HERO_POINTS = [
  { icon: LineChart, label: "CAPS and IEB topics" },
  { icon: Smartphone, label: "Light on mobile data" },
  { icon: ShieldCheck, label: "No ads" },
] as const;

const PRODUCT = [
  {
    icon: BookOpen,
    title: "Teach",
    body: "Build lessons with text, maths, graphs, video and files, in the order you teach them. Students can see what they have done and what comes next.",
    Snippet: LessonsSnippet,
  },
  {
    icon: ClipboardCheck,
    title: "Test and mark",
    body: "Set tests and assignments, mark against a rubric and leave feedback next to each answer. Multiple choice marks itself.",
    Snippet: MarkedSnippet,
  },
  {
    icon: CalendarDays,
    title: "Meet",
    body: "Lessons, due dates and online classes share one calendar. Students join from the session, and you take attendance there.",
    Snippet: ClassSnippet,
  },
] as const;

const AUDIENCES: { photo: StockPhotoName; icon: typeof Users; title: string; points: string[] }[] = [
  {
    photo: "tutor",
    icon: Presentation,
    title: "Tutors",
    points: ["Lessons, marking and the calendar in one place", "A question bank, so you write a good question once", "A list of the students who need attention"],
  },
  {
    photo: "organisation",
    icon: Building2,
    title: "Tutoring organisations",
    points: ["Invite tutors and give them their own courses", "Add students from a spreadsheet, and undo it if it's wrong", "See every course and class"],
  },
  {
    photo: "student",
    icon: GraduationCap,
    title: "Students",
    points: ["Every lesson, test and due date on one page", "Answers save as you type", "Your mark next to the answer it's for"],
  },
  {
    photo: "parent",
    icon: Users,
    title: "Parents",
    points: ["Follow your child's lessons and marks", "See what's due and their attendance", "Your own sign-in"],
  },
];

const LOCAL = [
  { icon: LineChart, title: "CAPS and IEB", body: "Tag lessons and questions by topic and see what your course still has to cover, Grades 10 to 12." },
  { icon: Smartphone, title: "Easy on mobile data", body: "Data saver holds back photos and videos until someone taps them. It follows the phone's own setting." },
  { icon: IdCard, title: "No email needed", body: "Print a sign-in card with a username and a code for students who don't have an email address." },
  { icon: FileUp, title: "From your spreadsheet", body: "Bring in a class from a CSV file. You check every row before anything changes." },
  { icon: PenLine, title: "Maths that looks right", body: "Type maths in lessons, questions and feedback, and draw graphs students can read on a phone." },
  { icon: Type, title: "Easier reading", body: "Larger text, an easier-to-read font and dark mode, for anyone who wants them." },
] as const;

const STEPS = signUpOpen
  ? [
      { icon: UserPlus, title: "Create an account", body: "Sign up with your email address and choose tutor, student or parent." },
      { icon: BookOpen, title: "Set up a course", body: "Name your class, choose its subject and grade, and add the first lesson." },
      { icon: Users, title: "Add your students", body: "Add them one at a time or from a spreadsheet. They sign in and start." },
    ]
  : [
      { icon: Mail, title: "Request access", body: "Send us an email. We set up your account and your course." },
      { icon: LogIn, title: "Sign in", body: "You land on a dashboard made for your role." },
      { icon: Users, title: "Teach or learn", body: "Tutors add lessons and students. Students get started." },
    ];

const FAQ = [
  signUpOpen
    ? {
        q: "Can anyone sign up?",
        a: "Yes. Tutors, students and parents each create their own account. Students and parents see a course once its tutor adds them or accepts their request to join.",
      }
    : {
        q: "Can I sign up myself?",
        a: "Not yet. Accounts are created for you by a tutor or by us. Send a request and we'll set you up.",
      },
  {
    q: "Do students need their own email address?",
    a: "No. A tutor can create a student's account and print a sign-in card with a username and a code.",
  },
  {
    q: "Which meeting apps work for online classes?",
    a: "Any app that gives you a link, including Google Meet, Zoom and Microsoft Teams. Paste the link into the session and students get a Join button 15 minutes before it starts.",
  },
  {
    q: "What kinds of questions can a test have?",
    a: "Multiple choice, true or false, short answer, essay, numeric, fill in the blank, matching, reorder, code and file upload. Questions can be grouped under a shared passage or diagram.",
  },
  {
    q: "Does it work on a phone?",
    a: "Yes. It runs in the phone's browser, and there's nothing to install.",
  },
];

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="bg-background text-foreground min-h-screen antialiased">
      <a
        href="#main"
        className="bg-background text-foreground focus:ring-ring sr-only z-50 rounded-md px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:ring-2"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <Product />
        <Audiences />
        <MadeForSouthAfrica />
        <Steps />
        <Faq />
        <Closing />
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-border/60 bg-background/90 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark />
          <span className="font-display text-lg leading-none tracking-tight whitespace-nowrap">{APP_NAME}</span>
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-6 text-sm lg:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-muted-foreground hover:text-foreground transition-colors">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/auth">
              <LogIn aria-hidden className="size-4" />
              Sign in
            </Link>
          </Button>
          <span className="hidden sm:block">
            <StartButton size="sm" />
          </span>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="border-border/60 border-b">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:pb-28">
        <div>
          <h1 className="font-display text-4xl leading-[1.08] tracking-tight text-balance sm:text-6xl">
            Run your tutoring from one place
          </h1>
          <p className="text-muted-foreground mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
            Lessons, tests, marking, online classes and the calendar, for South African tutors and the students and parents they
            work with.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <StartButton />
            <Button asChild variant="outline" size="lg">
              <a href="#product">
                See how it works
                <ArrowRight aria-hidden className="size-4" />
              </a>
            </Button>
          </div>
          <ul className="text-muted-foreground mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {HERO_POINTS.map((f) => (
              <li key={f.label} className="flex items-center gap-2">
                <f.icon aria-hidden className="text-link size-4" />
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="bg-muted relative aspect-[4/3] overflow-hidden rounded-2xl">
            <StockPhoto name="hero" sizes="(max-width: 1023px) 100vw, 560px" />
          </div>
          <div className="relative -mt-14 ml-auto w-[min(18rem,85%)] lg:absolute lg:-bottom-24 lg:-left-16 lg:mt-0 lg:ml-0">
            <MarkedSnippet className="shadow-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ id, title, lead }: { id: string; title: string; lead: string }) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="font-display text-3xl leading-tight tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      <p className="text-muted-foreground mt-3 text-base leading-relaxed">{lead}</p>
    </div>
  );
}

const SECTION = "border-border/60 scroll-mt-16 border-b py-16 sm:py-24";
const INNER = "mx-auto max-w-6xl px-4 sm:px-6";
const ICON_TILE = "bg-muted text-link grid size-10 place-items-center rounded-lg";

function Product() {
  return (
    <section id="product" aria-labelledby="product-title" className={SECTION}>
      <div className={INNER}>
        <SectionHeading id="product-title" title="Teach, mark and meet" lead="What a class needs through the week, in one app." />
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {PRODUCT.map(({ icon: Icon, title, body, Snippet }) => (
            <li key={title} className="bg-card border-border flex flex-col rounded-2xl border p-6">
              <span aria-hidden className={ICON_TILE}>
                <Icon className="size-5" />
              </span>
              <h3 className="font-display mt-4 text-xl leading-tight">{title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{body}</p>
              <div className="mt-6 flex flex-1 flex-col justify-end">
                <Snippet />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Audiences() {
  return (
    <section id="who" aria-labelledby="who-title" className={`${SECTION} bg-muted/40`}>
      <div className={INNER}>
        <SectionHeading id="who-title" title="For everyone in the class" lead="Each person signs in to the same class and sees what they need." />
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {AUDIENCES.map((a) => (
            <li key={a.title} className="bg-card border-border overflow-hidden rounded-2xl border">
              <div data-photo-box="" className="bg-muted relative aspect-[3/2]">
                <StockPhoto name={a.photo} sizes="(max-width: 639px) 100vw, 560px" className={a.photo === "organisation" ? "object-top" : undefined} />
              </div>
              <div className="p-6">
                <h3 className="font-display flex items-center gap-2.5 text-xl leading-tight">
                  <a.icon aria-hidden className="text-link size-5" />
                  {a.title}
                </h3>
                <ul className="text-muted-foreground mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                  {a.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function MadeForSouthAfrica() {
  return (
    <section id="south-africa" aria-labelledby="sa-title" className={SECTION}>
      <div className={`${INNER} grid gap-12 lg:grid-cols-[1fr_20rem] lg:items-center`}>
        <div>
          <SectionHeading
            id="sa-title"
            title="Made for South African classes"
            lead="Built around the curriculum you teach, and the phones and data your students have."
          />
          <ul className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {LOCAL.map((l) => (
              <li key={l.title} className="flex gap-3.5">
                <l.icon aria-hidden className="text-link mt-0.5 size-5 shrink-0" />
                <div>
                  <h3 className="font-semibold">{l.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{l.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <CoverageSnippet className="p-5 shadow-md" />
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section aria-labelledby="start-title" className={`${SECTION} bg-muted/40`}>
      <div className={INNER}>
        <SectionHeading id="start-title" title="Getting started" lead="Three steps from signing up to your first class." />
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="bg-card border-border rounded-2xl border p-6">
              <div className="flex items-center justify-between">
                <span aria-hidden className={ICON_TILE}>
                  <s.icon className="size-5" />
                </span>
                <span aria-hidden className="text-muted-foreground font-display text-2xl tabular-nums">
                  {i + 1}
                </span>
              </div>
              <h3 className="font-display mt-4 text-xl leading-tight">{s.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="questions" aria-labelledby="faq-title" className={SECTION}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 id="faq-title" className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
          Questions
        </h2>
        <div className="divide-border border-border mt-8 divide-y border-y">
          {FAQ.map((f) => (
            <details key={f.q} className="group">
              <summary className="focus-visible:ring-ring flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-4 text-base font-medium outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown
                  aria-hidden
                  className="text-muted-foreground size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                />
              </summary>
              <p className="text-muted-foreground pb-5 text-sm leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Text on a photo: the dark layer is fixed, so contrast holds in every theme and with the photo off. */
function Closing() {
  return (
    <section aria-labelledby="closing-title" className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl bg-neutral-900 text-white">
        <StockPhoto name="johannesburg" alt="" sizes="(max-width: 1152px) 100vw, 1152px" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/75 to-black/50" />
        <div className="relative px-6 py-14 sm:px-14 sm:py-20">
          <h2 id="closing-title" className="font-display max-w-xl text-3xl leading-tight tracking-tight text-balance sm:text-4xl">
            Start your next class here
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-white/85">
            {signUpOpen ? "Create an account and set up your first course." : "Tell us who you are and we'll set you up."} If you run a
            centre with several tutors, write to us first.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <StartButton />
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="border border-white/40 text-white hover:bg-white/10 hover:text-white dark:hover:bg-white/10"
            >
              <a href={teamHref}>
                <Building2 aria-hidden className="size-4" />
                Ask about your organisation
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const link = "text-muted-foreground hover:text-foreground transition-colors";
  return (
    <footer className="border-border/60 border-t">
      <div className={`${INNER} py-10`}>
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandMark className="size-7 text-xs" />
              <span className="font-display leading-none tracking-tight">{APP_NAME}</span>
            </div>
            <p className="text-muted-foreground mt-3 max-w-xs text-sm">{APP_TAGLINE}</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-12 gap-y-6 text-sm">
            <ul className="space-y-2">
              <li>
                <Link href="/auth" className={link}>
                  Sign in
                </Link>
              </li>
              <li>
                {signUpOpen ? (
                  <Link href="/auth/sign-up" className={link}>
                    Create an account
                  </Link>
                ) : (
                  <a href={accessHref} className={link}>
                    Request access
                  </a>
                )}
              </li>
              <li>
                <Link href="/support" className={link}>
                  Support
                </Link>
              </li>
            </ul>
            <ul className="space-y-2">
              <li>
                <Link href="/privacy-policy" className={link}>
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms-of-service" className={link}>
                  Terms
                </Link>
              </li>
              <li>
                <a href={`mailto:${APP_CONTACT.email}`} className={link}>
                  Email us
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <p className="text-muted-foreground border-border mt-8 border-t pt-6 text-xs">
          © {new Date().getFullYear()} {APP_NAME}. {APP_CONTACT.location}. Photos from Unsplash.
        </p>
      </div>
    </footer>
  );
}
