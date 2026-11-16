/**
 * /design-system — preview of the revamp tokens (Phase 0).
 *
 * Renders the colour tokens, type scale and today's UI primitives twice,
 * light and dark, each inside its own `data-ui="revamp"` scope, so the new
 * look can be reviewed without turning REVAMP_UI on for the whole app.
 * Available in development, or anywhere REVAMP_UI is "1". No data, no login.
 */

import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { canPreviewDesignSystem } from "@/lib/ui-flags";
import { cn } from "@/lib/utils";

export const metadata = { title: "Design system", robots: { index: false } };

const SWATCHES: Array<{ token: string; label: string; text?: string }> = [
  { token: "background", label: "Canvas", text: "foreground" },
  { token: "sidebar", label: "Sidebar", text: "sidebar-foreground" },
  { token: "muted", label: "Muted surface", text: "muted-foreground" },
  { token: "accent", label: "Hover fill", text: "accent-foreground" },
  { token: "primary", label: "Accent", text: "primary-foreground" },
  { token: "success", label: "Success", text: "success-foreground" },
  { token: "warning", label: "Warning", text: "warning-foreground" },
  { token: "destructive", label: "Danger", text: "destructive-foreground" },
  { token: "border", label: "Divider" },
  { token: "input", label: "Input outline" },
];

const TYPE_SCALE = [
  { label: "Page title", className: "font-display text-3xl", sample: "Grade 12 Mathematics" },
  { label: "Section", className: "font-display text-xl", sample: "Calculus: first principles" },
  { label: "Body", className: "text-sm", sample: "Find the derivative of f(x) = 3x² − 2x from first principles." },
  { label: "Muted", className: "text-sm text-muted-foreground", sample: "Due 20 Nov 2026, 08:00 · 12 questions · 60 minutes" },
  { label: "Mono", className: "font-mono text-sm", sample: "f'(x) = 6x - 2   0123456789" },
];

function Panel({ dark }: { dark: boolean }) {
  return (
    <section
      data-ui="revamp"
      className={cn(
        "bg-background text-foreground font-sans flex-1 space-y-8 rounded-lg border border-border p-6",
        dark && "dark",
      )}
    >
      <h2 className="font-display text-xl">{dark ? "Dark" : "Light"}</h2>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {SWATCHES.map((s) => (
          <div
            key={s.token}
            className="flex h-20 flex-col justify-end rounded-md border border-border p-2 text-xs"
            style={{
              background: `var(--${s.token})`,
              color: s.text ? `var(--${s.text})` : undefined,
            }}
          >
            <span className="font-medium">{s.label}</span>
            <span className="font-mono opacity-80">--{s.token}</span>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {TYPE_SCALE.map((t) => (
          <div key={t.label} className="grid grid-cols-[6rem_1fr] items-baseline gap-3">
            <span className="text-muted-foreground text-xs">{t.label}</span>
            <span className={t.className}>{t.sample}</span>
          </div>
        ))}
        <p className="text-sm">
          Links use the <a href="#" className="text-link underline underline-offset-2">link colour</a>.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button>Publish</Button>
        <Button variant="brand">Brand</Button>
        <Button variant="secondary">Save draft</Button>
        <Button variant="outline">Preview</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="destructive">Delete</Button>
        <Button variant="link">Learn more</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge>Default</Badge>
        <Badge variant="soft">Soft</Badge>
        <Badge variant="secondary">Draft</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge className="bg-success text-success-foreground border-transparent">Graded</Badge>
        <Badge className="bg-warning text-warning-foreground border-transparent">Late</Badge>
        <Badge variant="destructive">Missing</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Search courses" aria-label="Search courses" />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox defaultChecked /> Release marks to students
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Unit 3 quiz</CardTitle>
            <CardDescription>Grade 11 Physical Sciences</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">24 of 31 submitted</CardContent>
        </Card>
        <div className="bg-sidebar text-sidebar-foreground rounded-md border border-sidebar-border p-3 text-sm">
          <p className="text-muted-foreground mb-2 text-xs font-medium">Sidebar</p>
          <p className="bg-sidebar-accent rounded px-2 py-1">Courses</p>
          <p className="px-2 py-1">Calendar</p>
          <p className="px-2 py-1">Grades</p>
        </div>
      </div>
    </section>
  );
}

export default function DesignSystemPage() {
  if (!canPreviewDesignSystem()) notFound();

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Design system preview</h1>
        <p className="text-muted-foreground text-sm">
          Revamp tokens (REVAMP_UI). Each panel sets its own scope, so this page shows the new look even with the flag off.
        </p>
      </header>
      <div className="flex flex-col gap-6 lg:flex-row">
        <Panel dark={false} />
        <Panel dark />
      </div>
    </main>
  );
}
