/**
 * /design-system/components — the Phase 0 component library in the revamp
 * tokens: table, property list, sidebar, empty state, command palette, kbd.
 * Same gate as /design-system: development, or REVAMP_UI=1. Sample data only.
 */

import { notFound } from "next/navigation";
import { BookOpen, CalendarDays, Clock, GraduationCap, Home, Inbox, Settings, Tag, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Scene } from "@/components/ui/empty-state";
import { PropertyList, PropertyRow } from "@/components/ui/property-list";
import { Sidebar, SidebarItem, SidebarSection } from "@/components/ui/sidebar";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canPreviewDesignSystem } from "@/lib/ui-flags";

import { PaletteDemo } from "./palette-demo";

export const metadata = { title: "Components · Design system", robots: { index: false } };

const ROWS = [
  { name: "Thandi Mokoena", status: "Graded", score: "42 / 50", submitted: "18 Nov, 09:12" },
  { name: "Pieter van Wyk", status: "Submitted", score: "—", submitted: "18 Nov, 10:47" },
  { name: "Ayesha Patel", status: "Late", score: "—", submitted: "19 Nov, 21:03" },
  { name: "Sipho Dlamini", status: "Missing", score: "—", submitted: "—" },
];

function StatusBadge({ status }: { status: string }) {
  if (status === "Graded") return <Badge className="bg-success text-success-foreground border-transparent">Graded</Badge>;
  if (status === "Late") return <Badge className="bg-warning text-warning-foreground border-transparent">Late</Badge>;
  if (status === "Missing") return <Badge variant="destructive">Missing</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg">{title}</h2>
      {children}
    </section>
  );
}

export default function ComponentsPage() {
  if (!canPreviewDesignSystem()) notFound();

  return (
    <div data-ui="revamp" className="bg-background text-foreground font-sans min-h-screen">
      <main className="mx-auto max-w-5xl space-y-10 p-6">
        <header className="space-y-1">
          <h1 className="font-display text-3xl">Components</h1>
          <p className="text-muted-foreground">Phase 0 library in the revamp tokens. Sample data only.</p>
        </header>

        <Section title="Table">
          <Table>
            <TableCaption>Unit 3 quiz · 4 of 31 learners shown</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Learner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{r.score}</TableCell>
                  <TableCell className="text-muted-foreground">{r.submitted}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>

        <Section title="Property list">
          <PropertyList className="max-w-lg">
            <PropertyRow icon={<BookOpen />} label="Course">Grade 12 Mathematics</PropertyRow>
            <PropertyRow icon={<CalendarDays />} label="Due">20 Nov 2026, 08:00</PropertyRow>
            <PropertyRow icon={<Clock />} label="Time limit">60 minutes</PropertyRow>
            <PropertyRow icon={<Tag />} label="Status"><Badge variant="secondary">Draft</Badge></PropertyRow>
            <PropertyRow icon={<User />} label="Tutor">N. Mahlangu</PropertyRow>
          </PropertyList>
        </Section>

        <Section title="Sidebar">
          <div className="border-border h-80 w-fit overflow-hidden rounded-lg border">
            <Sidebar aria-label="Sample navigation">
              <SidebarSection>
                <SidebarItem href="#" icon={<Home />} active>Home</SidebarItem>
                <SidebarItem href="#" icon={<Inbox />} trailing="3">Inbox</SidebarItem>
              </SidebarSection>
              <SidebarSection label="Teaching">
                <SidebarItem href="#" icon={<BookOpen />}>Courses</SidebarItem>
                <SidebarItem href="#" icon={<CalendarDays />}>Calendar</SidebarItem>
                <SidebarItem href="#" icon={<GraduationCap />} trailing="12">Grading</SidebarItem>
              </SidebarSection>
              <SidebarSection label="Workspace">
                <SidebarItem href="#" icon={<Settings />}>Settings</SidebarItem>
              </SidebarSection>
            </Sidebar>
          </div>
        </Section>

        <Section title="Empty state">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border-border rounded-lg border">
              <EmptyState
                illustration={<Scene name="empty-tests" />}
                title="No tests yet"
                description="Create a test for this course, or copy one from another course."
                action={<Button>New test</Button>}
              />
            </div>
            <div className="border-border rounded-lg border">
              <EmptyState
                compact
                illustration={<Scene name="nothing-to-grade" />}
                title="Nothing to grade"
                description="New submissions will show up here."
              />
            </div>
          </div>
        </Section>

        <Section title="Command palette">
          <PaletteDemo />
        </Section>
      </main>
    </div>
  );
}
