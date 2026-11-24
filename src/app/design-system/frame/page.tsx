/**
 * /design-system/frame — the page frame (#205, step 1) for every page type:
 * home, list, record, editor, runner and settings. `?type=` picks one,
 * `?lockdown=1` hides the runner's header (Pro lockdown tests) and
 * `?theme=bright|ocean|sunset|contrast` previews a colour theme (#206) and
 * `?dark=1` its dark mode.
 *
 * The shell's sidebar shows an organisation owner who teaches, so the
 * Organisation / Tutor switch sits under the workspace switcher. It calls
 * switchViewerMode, which refuses without a session (an error toast).
 * Same gate as /design-system: development, or REVAMP_UI=1.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowDownUp, BookOpen, CalendarDays, Clock, Download, Filter, Home, Plus, Save, Settings, Timer, User, Users,
} from "lucide-react";

import { AppShell } from "@/components/shell/app-shell";
import { navSectionsFor } from "@/components/shell/nav-config";
import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { RibbonButton, RibbonNav, RibbonSeparator, RibbonToolbar } from "@/components/shell/ribbon";
import { StatusChip } from "@/components/shell/status-chip";
import { Button } from "@/components/ui/button";
import { PropertyList, PropertyRow } from "@/components/ui/property-list";
import { canPreviewDesignSystem } from "@/lib/ui-flags";
import { PAGE_TYPES, type PageType } from "@/lib/ui-layout";
import { COLOR_THEMES, THEME_INFO, themeAttr, themeFromAttr } from "@/lib/ui-themes";
import { buildLegacyViewer } from "@/lib/viewer-core";

import { PageTheme, ThemePickerDemo, TypeSwitcher } from "./demo-client";

export const metadata = { title: "Page frame · Design system", robots: { index: false } };

const HERE = "/design-system/frame";

const SAMPLE_OWNER = buildLegacyViewer({
  user: { id: "sample", name: "Nomsa Mahlangu", email: "owner@example.test", role: "TUTOR", emailVerified: true, imageUrl: null },
  profileId: null,
});

const ROWS = [
  ["Grade 10 Mathematics", "Ayanda Zulu", "28 students", "Active"],
  ["Grade 11 Physical Sciences", "Bongani Nkosi", "19 students", "Active"],
  ["Grade 12 Mathematics", "Nomsa Mahlangu", "31 students", "Active"],
  ["Grade 9 Natural Sciences", "Thandi Mokoena", "22 students", "Draft"],
  ["Grade 12 Accounting", "Sipho Dlamini", "17 students", "Active"],
  ["Grade 8 English", "Lerato Khumalo", "25 students", "Archived"],
] as const;

export default async function FramePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; lockdown?: string; theme?: string; dark?: string }>;
}) {
  if (!canPreviewDesignSystem()) notFound();
  const sp = await searchParams;
  const type: PageType = (PAGE_TYPES as readonly string[]).includes(sp.type ?? "") ? (sp.type as PageType) : "record";
  const colour = themeFromAttr(sp.theme) ?? "CALM";
  const theme = themeAttr(colour);
  const dark = sp.dark === "1";
  const query = (c: string, d: boolean) => `${c === "calm" ? "" : `&theme=${c}`}${d ? "&dark=1" : ""}`;
  const q = query(theme, dark);
  const href = (t: string) => `${HERE}?type=${t}${q}`;
  const switcher = <TypeSwitcher types={PAGE_TYPES} current={type} base={HERE} query={q} />;

  // The runner has no shell: the page alone, like AppShell's focus mode.
  if (type === "runner") {
    const lockdown = sp.lockdown === "1";
    return (
      <div data-ui="revamp" data-theme={theme} data-shell="focus" className="bg-background text-foreground min-h-screen font-sans">
        <PageTheme theme={theme} dark={dark} />
        <PageFrame
          type="runner"
          lockdown={lockdown}
          breadcrumb={[{ label: "Grade 12 Mathematics" }, { label: "Unit 3 quiz" }]}
          status={<StatusChip tone="info"><Timer className="size-3" /> 41:20 left</StatusChip>}
        >
          {switcher}
          <p className="text-muted-foreground text-xs">
            {lockdown ? "Pro lockdown: no header at all." : "Runner: the header shrinks to a 28 px strip."}{" "}
            <Link className="text-link underline" href={`${href("runner")}${lockdown ? "" : "&lockdown=1"}`}>
              {lockdown ? "Show the strip" : "Try lockdown"}
            </Link>
          </p>
          <PageTitle eyebrow="Question 3 of 10" title="Solve for x: 2x² − 8 = 0" />
          <div className="space-y-2">
            {["x = 2 or x = −2", "x = 4", "x = ±√8", "No real solution"].map((o) => (
              <label key={o} className="border-border hover:bg-muted/60 flex items-center gap-3 rounded-md border p-3 text-sm">
                <input type="radio" name="q3" /> {o}
              </label>
            ))}
          </div>
          <div className="flex justify-between">
            <Button variant="outline">Previous</Button>
            <Button>Next question</Button>
          </div>
        </PageFrame>
      </div>
    );
  }

  return (
    <div data-ui="revamp" data-theme={theme} className="font-sans">
      <PageTheme theme={theme} dark={dark} />
      <AppShell
        user={{
          name: "Nomsa Mahlangu",
          email: "owner@example.test",
          role: "TUTOR",
          workspaces: [
            { id: "ws_sample_1", name: "Riverside Maths Academy", as: "staff" },
            { id: "ws_sample_2", name: "Evening Coding Club", as: "learner" },
          ],
          workspaceId: "ws_sample_1",
          mode: "organisation",
        }}
        sections={navSectionsFor(SAMPLE_OWNER)}
        search={false}
        notifications={false}
      >
        {type === "home" ? (
          <PageFrame type="home" breadcrumb={[{ label: "Home" }]}>
            {switcher}
            <PageTitle icon={<Home />} eyebrow="Saturday 22 November" title="Good morning, Nomsa" description="Three things need you today." />
            <PageSection title="Needs you">
              <div className="grid gap-3 sm:grid-cols-3">
                {["4 tests to mark", "2 join requests", "Lesson due tomorrow"].map((c) => (
                  <div key={c} className="border-border rounded-lg border p-4 text-sm font-medium">{c}</div>
                ))}
              </div>
            </PageSection>
            <PageSection title="Your courses">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ROWS.slice(0, 3).map(([name, tutor]) => (
                  <div key={name} className="border-border rounded-lg border p-4">
                    <p className="font-medium">{name}</p>
                    <p className="text-muted-foreground text-xs">with {tutor}</p>
                  </div>
                ))}
              </div>
            </PageSection>
          </PageFrame>
        ) : null}

        {type === "list" ? (
          <PageFrame
            type="list"
            breadcrumb={[{ label: "Courses" }]}
            actions={<Button size="sm"><Plus className="size-4" /> New course</Button>}
            secondary={
              <>
                <RibbonNav
                  label="Course views"
                  current={HERE}
                  links={[
                    { label: "All", href: HERE },
                    { label: "Active", href: `${HERE}/active` },
                    { label: "Archived", href: `${HERE}/archived` },
                  ]}
                />
                <RibbonToolbar label="View options">
                  <RibbonButton><Filter /> <span className="hidden sm:inline">Filter</span></RibbonButton>
                  <RibbonButton><ArrowDownUp /> <span className="hidden sm:inline">Sort</span></RibbonButton>
                </RibbonToolbar>
              </>
            }
          >
            {switcher}
            <PageTitle icon={<BookOpen />} title="Courses" description="Every course in Riverside Maths Academy." />
            <PageSection>
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead className="text-muted-foreground border-border border-b text-left text-xs">
                    <tr><th className="py-2 pr-3 font-medium">Course</th><th className="py-2 pr-3 font-medium">Tutor</th><th className="py-2 pr-3 font-medium">Students</th><th className="py-2 font-medium">State</th></tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {[...ROWS, ...ROWS, ...ROWS].map(([name, tutor, n, state], i) => (
                      <tr key={i}>
                        <td className="py-2.5 pr-3 font-medium">{name}</td>
                        <td className="py-2.5 pr-3">{tutor}</td>
                        <td className="py-2.5 pr-3 tabular-nums">{n}</td>
                        <td className="py-2.5"><StatusChip tone={state === "Active" ? "success" : "neutral"}>{state}</StatusChip></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PageSection>
          </PageFrame>
        ) : null}

        {type === "record" ? (
          <PageFrame
            type="record"
            breadcrumb={[{ label: "Courses", href: `${HERE}?type=list` }, { label: "Grade 12 Mathematics" }]}
            status={<StatusChip tone="success">Active</StatusChip>}
            actions={<Button size="sm" variant="outline">Share</Button>}
            secondary={
              <RibbonNav
                label="Course sections"
                current={HERE}
                links={[
                  { label: "Overview", href: HERE },
                  { label: "Lessons", href: `${HERE}/lessons` },
                  { label: "Tests", href: `${HERE}/tests` },
                  { label: "People", href: `${HERE}/people` },
                  { label: "Settings", href: `${HERE}/settings` },
                ]}
              />
            }
          >
            {switcher}
            <PageTitle
              icon={<BookOpen />}
              eyebrow="Course"
              title="Grade 12 Mathematics"
              description="Algebra, calculus and probability for the final year, with weekly tests."
              properties={
                <PropertyList>
                  <PropertyRow icon={<User />} label="Taught by">Nomsa Mahlangu</PropertyRow>
                  <PropertyRow icon={<Users />} label="Students">31 enrolled</PropertyRow>
                  <PropertyRow icon={<CalendarDays />} label="Next lesson">Mon 24 Nov, 15:00</PropertyRow>
                </PropertyList>
              }
            />
            <PageSection title="Lessons" description="12 published, 2 drafts.">
              <ol className="divide-border divide-y text-sm">
                {["Functions and graphs", "Sequences and series", "Differential calculus", "Probability"].map((l, i) => (
                  <li key={l} className="flex justify-between py-2"><span>{i + 1}. {l}</span><span className="text-muted-foreground">Published</span></li>
                ))}
              </ol>
            </PageSection>
            <PageSection title="Tests and assignments">
              {Array.from({ length: 10 }, (_, i) => (
                <p key={i} className="text-muted-foreground text-sm">
                  Sample row {i + 1}. Scroll down on a phone: the secondary header slides away, and comes back on scroll up.
                </p>
              ))}
            </PageSection>
          </PageFrame>
        ) : null}

        {type === "editor" ? (
          <PageFrame
            type="editor"
            breadcrumb={[{ label: "Tests", href: `${HERE}?type=list` }, { label: "Unit 3 quiz", href: `${HERE}?type=record` }, { label: "Edit" }]}
            status={<StatusChip>Draft</StatusChip>}
            actions={<Button size="sm"><Save className="size-4" /> Save</Button>}
            secondary={
              <RibbonToolbar label="Editor tools" className="flex-1">
                <RibbonButton><Plus /> Question</RibbonButton>
                <RibbonSeparator />
                <RibbonButton><Clock /> <span className="hidden sm:inline">Time limit</span></RibbonButton>
                <RibbonButton><Download /> <span className="hidden sm:inline">Export</span></RibbonButton>
              </RibbonToolbar>
            }
          >
            {switcher}
            <PageTitle eyebrow="Test" title="Unit 3 quiz" description="Full width: the editor uses the whole column." />
            <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
              <ol className="border-border space-y-1 rounded-lg border p-2 text-sm">
                {Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className={i === 2 ? "bg-accent rounded px-2 py-1.5 font-medium" : "px-2 py-1.5"}>Question {i + 1}</li>
                ))}
              </ol>
              <div className="border-border min-h-80 rounded-lg border p-4 text-sm">
                <p className="font-medium">Question 3</p>
                <p className="text-muted-foreground mt-2">Solve for x: 2x² − 8 = 0</p>
              </div>
            </div>
          </PageFrame>
        ) : null}

        {type === "settings" ? (
          <PageFrame type="settings" breadcrumb={[{ label: "Settings" }]}>
            {switcher}
            <PageTitle icon={<Settings />} title="Settings" description="Reading width: forms and prose stay at 720 px." />
            <PageSection id="appearance" title="Appearance">
              <ThemePickerDemo initial={colour} />
              <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <span>Preview the whole page:</span>
                {COLOR_THEMES.map((c) => (
                  <Link
                    key={c}
                    className="text-link underline"
                    aria-current={c === colour ? "page" : undefined}
                    href={`${HERE}?type=settings${query(themeAttr(c), dark)}`}
                  >
                    {THEME_INFO[c].label}
                  </Link>
                ))}
                <Link className="text-link underline" href={`${HERE}?type=settings${query(theme, !dark)}`}>
                  {dark ? "Light" : "Dark"}
                </Link>
              </p>
            </PageSection>
            <PageSection id="email" title="Email">
              <PropertyList>
                <PropertyRow label="Address">owner@example.test</PropertyRow>
                <PropertyRow label="Digest">Daily</PropertyRow>
              </PropertyList>
            </PageSection>
          </PageFrame>
        ) : null}
      </AppShell>
    </div>
  );
}
