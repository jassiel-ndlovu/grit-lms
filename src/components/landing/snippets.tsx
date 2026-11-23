/**
 * Small pictures of the product for the landing page, built from the same
 * tokens as the app, so they follow the theme and weigh nothing. Sample
 * data only. Each one is decorative (the text beside it says the same), so
 * the wrapper is aria-hidden.
 */

import { Check, Clock, FileText, PenLine, Video } from "lucide-react";

import { cn } from "@/lib/utils";

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div aria-hidden className={cn("bg-card text-card-foreground border-border rounded-lg border p-4 text-left shadow-sm", className)}>
      {children}
    </div>
  );
}

/** A marked answer: marks by criterion and a comment. */
export function MarkedSnippet({ className }: { className?: string }) {
  const rows = [
    ["Method", "4/4"],
    ["Working shown", "3/4"],
    ["Answer with units", "2/2"],
  ];
  return (
    <Panel className={className}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Trigonometry test</p>
        <span className="bg-success text-success-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
          <Check className="size-3" /> 9/10
        </span>
      </div>
      <dl className="mt-3 space-y-1.5 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="bg-muted text-muted-foreground mt-3 rounded-md px-3 py-2 text-xs">
        Good diagram. Write down the identity before you use it.
      </p>
    </Panel>
  );
}

/** The next online class with a join button, and what's due after it. */
export function ClassSnippet({ className }: { className?: string }) {
  return (
    <Panel className={className}>
      <div className="flex items-center gap-3">
        <span className="bg-muted text-link grid size-9 shrink-0 place-items-center rounded-md">
          <Video className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Grade 11 Maths</p>
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <Clock className="size-3" /> Today, 16:00 to 17:00
          </p>
        </div>
        <span className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-medium">Join</span>
      </div>
      <div className="border-border mt-3 flex items-center gap-3 border-t pt-3">
        <span className="bg-muted text-link grid size-9 shrink-0 place-items-center rounded-md">
          <PenLine className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Probability assignment</p>
          <p className="text-muted-foreground text-xs">Due Friday, 18:00</p>
        </div>
      </div>
    </Panel>
  );
}

/** A lesson list with progress. */
export function LessonsSnippet({ className }: { className?: string }) {
  const lessons = [
    ["Functions and graphs", true],
    ["Number patterns", true],
    ["Analytical geometry", false],
  ] as const;
  return (
    <Panel className={className}>
      <ul className="space-y-2.5 text-sm">
        {lessons.map(([name, done]) => (
          <li key={name} className="flex items-center gap-2.5">
            <FileText className="text-muted-foreground size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{name}</span>
            {done ? <Check className="text-success size-4" /> : <span className="border-input size-3.5 rounded-full border" />}
          </li>
        ))}
      </ul>
      <div className="bg-muted mt-4 h-1.5 overflow-hidden rounded-full">
        <div className="bg-success h-full w-2/3 rounded-full" />
      </div>
      <p className="text-muted-foreground mt-1.5 text-xs">2 of 3 lessons done</p>
    </Panel>
  );
}

/** The curriculum coverage map. */
export function CoverageSnippet({ className }: { className?: string }) {
  const topics = [
    ["Functions", "Covered", "text-success"],
    ["Trigonometry", "Covered", "text-success"],
    ["Probability", "No questions", "text-warning"],
    ["Statistics", "Not yet", "text-muted-foreground"],
  ];
  return (
    <Panel className={className}>
      <p className="text-sm font-semibold">CAPS Mathematics, Grade 11</p>
      <dl className="divide-border mt-2 divide-y text-xs">
        {topics.map(([t, s, tone]) => (
          <div key={t} className="flex justify-between gap-3 py-2">
            <dt>{t}</dt>
            <dd className={cn("font-medium", tone)}>{s}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
