"use client";

/** The peek panel on the Students page: who they are, alerts and latest marks. */

import * as React from "react";

import { useDateContext } from "@/components/preferences-provider";
import { StatusChip } from "@/components/shell/status-chip";
import { TonePanel } from "@/components/ui/nexus";
import { PeekProvider, type PeekItem } from "@/components/ui/peek-panel";
import { PropertyList, PropertyRow } from "@/components/ui/property-list";
import { formatDate } from "@/lib/datetime";

import { peekStudent, type StudentPeek } from "../peek-actions";

async function load(id: string): Promise<StudentPeek | null> {
  const r = await peekStudent({ learnerId: id });
  return r?.data ?? null;
}

export function StudentPeeks({ items, children, load: loadWith = load }: {
  items: PeekItem[];
  children: React.ReactNode;
  /** For samples. */
  load?: (id: string) => Promise<StudentPeek | null>;
}) {
  return (
    <PeekProvider items={items} load={loadWith} render={(d) => <StudentPeekBody d={d} />}>
      {children}
    </PeekProvider>
  );
}

export function StudentPeekBody({ d }: { d: StudentPeek }) {
  const ctx = useDateContext();
  const day = (iso: string) => formatDate(new Date(iso), ctx, { day: "numeric", month: "short" });
  return (
    <>
      {d.deleteOn || d.awaitingFirstSignIn || d.isMinor ? (
        <div className="flex flex-wrap gap-1.5">
          {d.deleteOn ? <StatusChip tone="danger">Deletion pending</StatusChip> : null}
          {d.awaitingFirstSignIn ? <StatusChip tone="warning">Hasn&apos;t signed in yet</StatusChip> : null}
          {d.isMinor ? <StatusChip tone="neutral">Under 18</StatusChip> : null}
        </div>
      ) : null}
      <PropertyList className="[&_[data-slot=property-row]]:grid-cols-[5.5rem_1fr]">
        {d.username ? <PropertyRow label="Username">{d.username}</PropertyRow> : null}
        <PropertyRow label="Email">{d.email ?? "No email"}</PropertyRow>
        <PropertyRow label="Courses">{d.courses.length ? d.courses.map((c) => c.name).join(", ") : "Not on a course"}</PropertyRow>
      </PropertyList>

      {d.alerts.map((a) => (
        <TonePanel key={a.id} tone={a.tone} className="space-y-1 p-3 text-sm">
          <p className="text-foreground font-medium">
            {a.level} · {a.course}
          </p>
          <p className="text-muted-foreground">{a.summary}</p>
        </TonePanel>
      ))}

      {d.marks ? (
        <section aria-labelledby="peek-marks" className="space-y-1">
          <h3 id="peek-marks" className="text-foreground text-sm font-semibold">
            Latest marks
          </h3>
          {d.marks.length === 0 ? (
            <p className="text-muted-foreground text-sm">No marks yet.</p>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {d.marks.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground block truncate">{m.title}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {m.course} · {day(m.at)}
                    </span>
                  </span>
                  <span className="text-foreground shrink-0 tabular-nums">
                    {m.score}
                    <span className="text-muted-foreground"> / {m.outOf}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}
