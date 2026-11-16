/**
 * /design-system/shell — the revamp app shell with sample data: sidebar
 * (tutor nav), mobile drawer, page header, ribbon and Ctrl/⌘K palette.
 * Live search and the notification bell are off: this page has no session.
 * Same gate as /design-system: development, or REVAMP_UI=1.
 */

import { notFound } from "next/navigation";
import { ArrowDownUp, BookOpen, CalendarDays, Clock, Download, Filter, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PropertyList, PropertyRow } from "@/components/ui/property-list";
import { AppShell } from "@/components/shell/app-shell";
import { navSectionsForRole } from "@/components/shell/nav-config";
import { PageHeader } from "@/components/shell/page-header";
import { Ribbon, RibbonButton, RibbonNav, RibbonSeparator, RibbonToolbar } from "@/components/shell/ribbon";
import { StatusChip } from "@/components/shell/status-chip";
import { canPreviewDesignSystem } from "@/lib/ui-flags";

export const metadata = { title: "Shell · Design system", robots: { index: false } };

const HERE = "/design-system/shell";

export default function ShellPreviewPage() {
  if (!canPreviewDesignSystem()) notFound();

  return (
    <div data-ui="revamp" className="font-sans">
      <AppShell
        user={{ name: "Nomsa Mahlangu", email: "tutor@example.test", role: "TUTOR" }}
        sections={navSectionsForRole("TUTOR")}
        search={false}
        notifications={false}
      >
        <PageHeader
          breadcrumb={[
            { label: "Courses", href: "/dashboard/manage-courses" },
            { label: "Grade 12 Mathematics", href: HERE },
            { label: "Unit 3 quiz" },
          ]}
          status={<StatusChip tone="success">Published</StatusChip>}
          actions={
            <>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Preview</Button>
              <Button size="sm">Share</Button>
            </>
          }
        />
        <Ribbon>
          <RibbonNav
            label="Test sections"
            links={[
              { label: "Overview", href: HERE },
              { label: "Questions", href: `${HERE}?view=questions` },
              { label: "Submissions", href: `${HERE}?view=submissions` },
              { label: "Settings", href: `${HERE}?view=settings` },
            ]}
          />
          <RibbonToolbar label="View options" className="hidden md:flex">
            <RibbonButton><Filter /> Filter</RibbonButton>
            <RibbonButton><ArrowDownUp /> Sort</RibbonButton>
            <RibbonSeparator />
            <RibbonButton><Download /> Export</RibbonButton>
          </RibbonToolbar>
        </Ribbon>

        <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">
          <h1 className="font-display text-3xl">Unit 3 quiz</h1>
          <PropertyList>
            <PropertyRow icon={<BookOpen />} label="Course">Grade 12 Mathematics</PropertyRow>
            <PropertyRow icon={<CalendarDays />} label="Due">20 Nov 2026, 08:00</PropertyRow>
            <PropertyRow icon={<Clock />} label="Time limit">60 minutes</PropertyRow>
            <PropertyRow icon={<User />} label="Tutor">N. Mahlangu</PropertyRow>
          </PropertyList>
          <div className="flex flex-wrap gap-2">
            <StatusChip>Draft</StatusChip>
            <StatusChip tone="info">Open</StatusChip>
            <StatusChip tone="success">Graded</StatusChip>
            <StatusChip tone="warning">Late</StatusChip>
            <StatusChip tone="danger">Missing</StatusChip>
          </div>
          {Array.from({ length: 12 }, (_, i) => (
            <p key={i} className="text-muted-foreground">
              Sample paragraph {i + 1}. Scroll to check that the page header stays put and the sidebar does not move.
            </p>
          ))}
        </div>
      </AppShell>
    </div>
  );
}
