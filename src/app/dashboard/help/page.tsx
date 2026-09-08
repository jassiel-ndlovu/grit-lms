/**
 * /dashboard/help — role-aware help centre.
 *
 * Server Component. Renders:
 *   - Quick-start guide (three cards, role-branched)
 *   - Frequently asked questions in an <details> accordion (native, no
 *     JS needed for expand/collapse)
 *   - Contact card that opens a mailto to the tutor's address from
 *     branding.ts, with the sender's account details pre-filled.
 *
 * The page is intentionally static + accessible — no data fetches beyond
 * the session, so it loads instantly even on flaky connections.
 */

import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  FileText,
  Mail,
  MessageCircleQuestion,
  Phone,
  Settings,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { APP_CONTACT, APP_NAME } from "@/lib/branding";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata = { title: "Help" };

interface Faq {
  q: string;
  a: string;
}

const STUDENT_FAQS: Faq[] = [
  {
    q: "How do I take a test?",
    a: "Open Tests from the sidebar, pick a test in the Upcoming tab, and click through the pre-test instructions. You have a live timer, autosave every few seconds, and a Save and a Submit button pinned at the top.",
  },
  {
    q: "I started a test and got kicked out. Are my answers lost?",
    a: "No. Your answers autosave to the server every few seconds and again when you hide the tab or close the browser. Re-open the test to keep going.",
  },
  {
    q: "How do I see feedback on a graded item?",
    a: "Open Grades, click the row you want. You'll see the per-question breakdown, your answer, the correct answer, and your tutor's feedback.",
  },
  {
    q: "My grade shows a percentage but not the tutor's comments yet.",
    a: "The tutor may have released the auto-marked portion first and is still finalising written feedback. Ping them via the address at the bottom of this page if it's been a while.",
  },
  {
    q: "I forgot my password.",
    a: "Ask your tutor to reset it — they can generate a fresh one for you from the Users page.",
  },
  {
    q: "Where do I upload an assignment?",
    a: "Open Assignments, pick the item, and use the upload control on that page. Supported file types are listed above the drop zone.",
  },
];

const TUTOR_FAQS: Faq[] = [
  {
    q: "How do I add a new student?",
    a: "Go to Users in the sidebar, fill in the create-student form, click Generate for a strong password, and share it with the student out-of-band. You can reset any user's password later from the same page.",
  },
  {
    q: "What's the difference between auto-marks and released marks?",
    a: "Auto-marks are generated at submission time from the answer keys you provided. If Release auto-marks to student is off (default), students see nothing until you finalise. If on, they see the auto portion immediately and you fill in the qualitative pieces later.",
  },
  {
    q: "How do I import a test in bulk?",
    a: "On the Tests page, click Import test. Paste JSON following the schema documented in the dialog — you can feed the schema to any LLM to generate a whole test at once.",
  },
  {
    q: "Can I edit a test after students have started?",
    a: "Yes. Editing preserves stable question IDs via a diff-upsert — so student answers stay linked to the questions they wrote them for, even if you re-order or add sub-questions.",
  },
  {
    q: "Where's my class-wide performance view?",
    a: "Analytics in the sidebar. You get timelines, class averages, and a distribution histogram per graded item so you can spot what needs re-teaching.",
  },
  {
    q: "How do I organise my courses?",
    a: "Manage Courses lets you edit each course, publish or draft, and open the lesson editor. Every course you own is listed there.",
  },
];

interface QuickCard {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const STUDENT_QUICK: QuickCard[] = [
  {
    href: "/dashboard/courses",
    icon: <BookOpen className="size-5" />,
    title: "Continue a course",
    description: "Pick up from your last lesson.",
  },
  {
    href: "/dashboard/tests",
    icon: <FileText className="size-5" />,
    title: "See upcoming tests",
    description: "What's due, and when.",
  },
  {
    href: "/dashboard/settings",
    icon: <Settings className="size-5" />,
    title: "Adjust notifications",
    description: "Choose what pings you and how often.",
  },
];

const TUTOR_QUICK: QuickCard[] = [
  {
    href: "/dashboard/manage-users",
    icon: <BookOpen className="size-5" />,
    title: "Add a student",
    description: "Create a sign-in account in one submit.",
  },
  {
    href: "/dashboard/tutor-tests",
    icon: <FileText className="size-5" />,
    title: "Publish a test",
    description: "Author, import, or edit assessments.",
  },
  {
    href: "/dashboard/analytics",
    icon: <Settings className="size-5" />,
    title: "Check class performance",
    description: "Timelines, averages, distributions.",
  },
];

export default async function HelpPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const isTutor = session.user.role === "TUTOR";
  const quick = isTutor ? TUTOR_QUICK : STUDENT_QUICK;
  const faqs = isTutor ? TUTOR_FAQS : STUDENT_FAQS;

  const mailSubject = encodeURIComponent(
    `[${APP_NAME}] Help request from ${session.user.name}`,
  );
  const mailBody = encodeURIComponent(
    [
      `Hi,`,
      ``,
      `I need help with:`,
      ``,
      `— ${session.user.name} (${session.user.email})`,
    ].join("\n"),
  );
  const mailtoHref = `mailto:${APP_CONTACT.email}?subject=${mailSubject}&body=${mailBody}`;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <section className="border-b-2 border-brand-terracotta bg-primary text-primary-foreground overflow-hidden rounded-lg">
        <div className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <p className="text-primary-foreground/70 text-sm">Support</p>
            <h1 className="font-display mt-1 text-3xl leading-tight tracking-tight">
              How can we help?
            </h1>
            <p className="text-primary-foreground/70 mt-3 text-sm">
              Common questions, quick shortcuts, and a way to reach a human
              when the docs don&apos;t cut it.
            </p>
          </div>
          <div className="relative hidden h-32 w-40 shrink-0 md:block">
            <Image
              src="/illustrations/curious.svg"
              alt=""
              fill
              priority
              className="object-contain"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl leading-tight">Quick starts</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {quick.map((c) => (
            <Link key={c.href} href={c.href} className="block">
              <Card className="group h-full p-5 transition-shadow hover:shadow-md">
                <div className="bg-brand-terracotta/12 text-brand-terracotta mb-3 flex size-10 items-center justify-center rounded-md">
                  {c.icon}
                </div>
                <h3 className="font-display text-base leading-tight">
                  {c.title}
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  {c.description}
                </p>
                <div className="text-brand-terracotta mt-3 inline-flex items-center gap-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                  Go there <ArrowRight className="size-3" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <div className="mb-3 flex items-center gap-2">
            <MessageCircleQuestion className="text-brand-terracotta size-5" />
            <h2 className="font-display text-xl leading-tight">
              Frequently asked
            </h2>
          </div>
          <Separator className="mb-2" />
          <div className="divide-border divide-y">
            {faqs.map((f, i) => (
              <details key={i} className="group py-3">
                <summary className="text-foreground flex cursor-pointer list-none items-center justify-between text-sm font-medium marker:hidden">
                  <span>{f.q}</span>
                  <span className="text-muted-foreground ml-4 shrink-0 text-xs transition-transform group-open:rotate-90">
                    ▸
                  </span>
                </summary>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <div className="mb-2 flex items-center gap-2">
            <Mail className="text-brand-terracotta size-5" />
            <h2 className="font-display text-xl leading-tight">
              Still stuck?
            </h2>
          </div>
          <p className="text-muted-foreground text-sm">
            {isTutor
              ? "Reach the platform maintainer with any bugs, feature ideas, or account questions."
              : "Send your tutor a note. They usually reply within a day."}
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="text-muted-foreground size-4" />
              <a
                href={mailtoHref}
                className="text-brand-terracotta underline underline-offset-2"
              >
                {APP_CONTACT.email}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="text-muted-foreground size-4" />
              <a
                href={`tel:${APP_CONTACT.phone.replace(/\s+/g, "")}`}
                className="text-foreground"
              >
                {APP_CONTACT.phone}
              </a>
            </div>
            <div className="text-muted-foreground text-xs">
              {APP_CONTACT.location}
            </div>
          </div>
          <Separator className="my-5" />
          <p className="text-muted-foreground text-xs">
            When you write in, include what page you were on and what you
            expected to happen — it speeds up the reply.
          </p>
        </Card>
      </section>
    </div>
  );
}
