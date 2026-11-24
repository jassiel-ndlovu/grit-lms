/**
 * /design-system/nexus — the owner's UI features of 24 Nov with sample data
 * and no session: the nexus geometry, toned panels, toasts, loaders, the
 * saving indicator, marking, the peek panel, class mode and the topic map.
 * `?view=` picks one, `?theme=bright|ocean|sunset|contrast` and `?dark=1`
 * preview a theme. Buttons that reach the server refuse here.
 * Same gate as /design-system: development, or REVAMP_UI=1.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { PageFrame, PageMessage, PageSection, PageTitle } from "@/components/shell/page-frame";
import { RibbonNav } from "@/components/shell/ribbon";
import { NexusCorner, NexusLoader, TonePanel } from "@/components/ui/nexus";
import { PageSkeleton, RunnerLoading, type SkeletonKind } from "@/components/ui/page-skeleton";
import { ProgressBar } from "@/components/ui/progress-bar";
import { TopicMap } from "@/features/courses/components/topic-map";
import { topicsFor } from "@/features/courses/lib/curriculum";
import { classTopics, learnerTopics, topicCounts } from "@/features/courses/lib/topic-map";
import { ClassMode } from "@/features/events/components/class-mode";
import { TONES } from "@/lib/nexus";
import { canPreviewDesignSystem, mathJaxVersion } from "@/lib/ui-flags";

import { PageTheme } from "../frame/demo-client";
import { MarkingSample, PeekSample, SaveStateSamples, ToastButtons } from "./samples";

export const metadata = { title: "Nexus · Design system", robots: { index: false } };

const VIEWS = ["panels", "loading", "saving", "marking", "peek", "class", "topics"] as const;
type View = (typeof VIEWS)[number];
const TITLE: Record<View, string> = {
  panels: "Geometry, panels and toasts", loading: "Loading", saving: "Saving", marking: "Marking", peek: "Peek", class: "Class mode", topics: "Topic map",
};
const THEMES = ["calm", "bright", "ocean", "sunset", "contrast"];
const SKELETONS: SkeletonKind[] = ["home", "list", "record", "form", "grid", "calendar"];

const TONE_TEXT: Record<(typeof TONES)[number], [string, string]> = {
  neutral: ["Courses this week", "Three sessions, nothing due."],
  accent: ["Finish setting up", "Two steps left."],
  success: ["Everything is marked", "23 of 23 scripts."],
  warning: ["Due tomorrow", "Functions test, 08:00."],
  danger: ["Unpaid renewal", "Pay to keep your workspace open."],
};

interface Props {
  searchParams: Promise<{ view?: string; theme?: string; dark?: string; kind?: string; as?: string }>;
}

export default async function NexusPreviewPage({ searchParams }: Props) {
  if (!canPreviewDesignSystem()) notFound();
  const sp = await searchParams;
  const view = VIEWS.find((v) => v === sp.view) ?? "panels";
  const theme = THEMES.includes(sp.theme ?? "") ? sp.theme! : "calm";
  const dark = sp.dark === "1";
  const q = `${theme === "calm" ? "" : `&theme=${theme}`}${dark ? "&dark=1" : ""}`;
  const now = Date.now();

  const wrap = (children: React.ReactNode) => (
    <div data-ui="revamp" data-theme={theme} data-shell="focus" className="bg-background text-foreground min-h-screen font-sans">
      <PageTheme theme={theme} dark={dark} />
      {children}
    </div>
  );
  if (view === "loading" && sp.kind === "runner") return wrap(<RunnerLoading />);
  if (view === "loading" && sp.kind === "message") return wrap(<PageMessage breadcrumb={[{ label: "Tests" }]}>You don&apos;t own this test.</PageMessage>);
  if (view === "loading" && SKELETONS.some((k) => k === sp.kind)) return wrap(<PageSkeleton kind={sp.kind as SkeletonKind} />);

  return wrap(
    <PageFrame
      type="record"
      breadcrumb={[{ label: "Design system", href: "/design-system" }, { label: "Nexus" }]}
      secondary={
        <RibbonNav
          label="Samples"
          current={`/design-system/nexus?view=${view}${q}`}
          links={VIEWS.map((v) => ({ label: TITLE[v].split(",")[0], href: `/design-system/nexus?view=${v}${q}` }))}
        />
      }
    >
      <PageTitle
        eyebrow="Nexus"
        title={TITLE[view]}
        properties={
          <nav aria-label="Theme" className="flex flex-wrap gap-3 text-sm">
            {THEMES.map((t) => (
              <Link key={t} className="text-link underline" href={`/design-system/nexus?view=${view}&theme=${t}`}>
                {t}
              </Link>
            ))}
            <Link className="text-link underline" href={`/design-system/nexus?view=${view}&theme=${theme}${dark ? "" : "&dark=1"}`}>
              {dark ? "light" : "dark"}
            </Link>
          </nav>
        }
      />

      {view === "panels" ? (
        <>
          <PageSection title="Panels by importance" description="The words say it too; the tone is never the only signal.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TONES.map((t) => (
                <TonePanel key={t} as="section" tone={t} nexus={`sample-${t}`} className="min-h-28 space-y-1 pr-24">
                  <h3 className="text-foreground font-medium">{TONE_TEXT[t][0]}</h3>
                  <p className="text-muted-foreground text-sm">{TONE_TEXT[t][1]}</p>
                </TonePanel>
              ))}
              <div className="border-border relative isolate min-h-28 overflow-hidden rounded-lg border p-4 pr-24">
                <NexusCorner seed="plain" />
                <p className="text-foreground font-medium">A bordered panel</p>
                <p className="text-muted-foreground text-sm">The figure alone, in the theme&apos;s colours.</p>
              </div>
            </div>
          </PageSection>
          <PageSection title="Rows" description="Late and due soon.">
            <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border text-sm">
              <li data-slot="tone-row" data-tone="danger" className="px-4 py-3">Overdue: Worksheet 4</li>
              <li data-slot="tone-row" data-tone="warning" className="px-4 py-3">Due tomorrow: Functions test</li>
              <li data-slot="tone-row" data-tone="neutral" className="px-4 py-3">Due next week: Project</li>
            </ul>
          </PageSection>
          <PageSection title="Toasts">
            <ToastButtons />
          </PageSection>
        </>
      ) : null}

      {view === "loading" ? (
        <>
          <PageSection title="Loader">
            <div className="flex items-center gap-6">
              <NexusLoader size={16} label={null} />
              <NexusLoader size={32} label={null} />
              <NexusLoader size={56} label={null} />
            </div>
          </PageSection>
          <PageSection title="Progress">
            <div className="max-w-sm space-y-3">
              <ProgressBar label="Primary" value={40} />
              <ProgressBar label="Success" value={100} tone="success" />
              <ProgressBar label="Warning" value={70} tone="warning" />
              <ProgressBar label="Danger" value={20} tone="danger" />
              <ProgressBar label="Unknown" />
            </div>
          </PageSection>
          <PageSection title="Page outlines">
            <p className="flex flex-wrap gap-3 text-sm">
              {[...SKELETONS, "runner", "message"].map((k) => (
                <Link key={k} className="text-link underline" href={`/design-system/nexus?view=loading&kind=${k}${q}`}>
                  {k}
                </Link>
              ))}
            </p>
          </PageSection>
        </>
      ) : null}

      {view === "saving" ? <SaveStateSamples /> : null}
      {view === "marking" ? <MarkingSample version={mathJaxVersion()} /> : null}
      {view === "peek" ? <PeekSample /> : null}
      {view === "class" ? <ClassSample now={now} as={sp.as === "learner" ? "learner" : "staff"} q={q} /> : null}
      {view === "topics" ? <TopicSample as={sp.as === "class" ? "class" : "learner"} q={q} /> : null}
    </PageFrame>,
  );
}

function ClassSample({ now, as, q }: { now: number; as: "staff" | "learner"; q: string }) {
  const at = (min: number) => new Date(now + min * 60_000).toISOString();
  const staff = as === "staff";
  return (
    <>
      <p className="text-sm">
        <Link className="text-link underline" href={`/design-system/nexus?view=class&as=${staff ? "learner" : "staff"}${q}`}>
          Show as {staff ? "a learner" : "staff"}
        </Link>
      </p>
      <ClassMode
        session={{
          eventId: "sample", occurrenceStart: at(-20), start: at(-20), end: at(40), cancelled: false,
          link: "https://meet.google.com/abc-defg-hij", location: null, description: "Bring Worksheet 4. We finish inverse functions.",
        }}
        now={now}
        staff={staff ? {
          checkInOpenUntil: null, checkInCodes: true,
          learners: [
            { learnerId: "1", name: "Lwazi Dube", status: "PRESENT", method: "CHECK_IN_CODE", note: null },
            { learnerId: "2", name: "Amahle Nkosi", status: "LATE", method: "TUTOR", note: "Bus was late" },
            { learnerId: "3", name: "Thabo Mokoena", status: null, method: null, note: null },
          ],
        } : null}
        learner={staff ? null : { checkIn: true }}
        lessons={[
          { id: "1", title: "Functions and their inverses", href: "#", done: staff ? null : true },
          { id: "2", title: "The inverse of a parabola", href: "#", done: staff ? null : false },
          { id: "3", title: "Exponential and logarithmic functions", href: "#", done: staff ? null : false },
        ]}
        lessonsHref="#"
        due={[
          { id: "1", kind: "Test", title: "Functions test", at: at(22 * 60), href: "#" },
          { id: "2", kind: "Assignment", title: "Worksheet 5", at: at(6 * 24 * 60), href: "#" },
        ]}
      />
    </>
  );
}

function TopicSample({ as, q }: { as: "learner" | "class"; q: string }) {
  const topics = topicsFor({ curriculum: "CAPS", subject: "mathematics", gradeLevel: 12 });
  const code = (i: number) => topics[i].code;
  const lessons = [0, 0, 1, 1, 2, 3, 4].map((t, i) => ({ id: `l${i}`, topics: [code(t)] }));
  const marks = [
    { topics: [code(0)], score: 8, outOf: 10 }, { topics: [code(1)], score: 14, outOf: 20 }, { topics: [code(2)], score: 3, outOf: 10 },
  ];
  const learner = as === "learner";
  const nodes = learner
    ? learnerTopics(topics, lessons, new Set(["l0", "l1", "l2", "l3", "l5"]), marks)
    : classTopics(topics, lessons, [0, 0, 1, 2, 3].map((t) => ({ topics: [code(t)] })), marks);
  const c = topicCounts(nodes);
  return (
    <>
      <p className="text-sm">
        {c.passed} of {c.total} passed.{" "}
        <Link className="text-link underline" href={`/design-system/nexus?view=topics&as=${learner ? "class" : "learner"}${q}`}>
          Show {learner ? "the class" : "a learner"}
        </Link>
      </p>
      <TopicMap
        nodes={nodes}
        hrefs={learner ? Object.fromEntries(nodes.map((n) => [n.code, n.lessons.total ? "#" : undefined])) : {}}
        labels={learner ? { none: "Not started", started: "Started", passed: "Passed" } : { none: "Not yet", started: "In progress", passed: "Class passing" }}
      />
    </>
  );
}
