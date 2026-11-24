"use client";

/** Choosing what the booking pages show. Everything is in the URL. */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as ToolbarPrimitive from "@radix-ui/react-toolbar";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { RibbonToolbar } from "@/components/shell/ribbon";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type LinkOption = { value: string; label: string; href: string };

/** A select that opens the chosen option's page. */
export function LinkSelect({ label, value, options, placeholder }: { label: string; value: string | null; options: LinkOption[]; placeholder?: string }) {
  const router = useRouter();
  const id = React.useId();
  const [pending, start] = React.useTransition();
  return (
    <div className="w-full min-w-0 space-y-1.5 sm:w-64">
      <Label htmlFor={id} className="flex items-center gap-1.5">
        {label}
        {pending ? <Loader2 aria-hidden className="text-muted-foreground size-3.5 animate-spin" /> : null}
      </Label>
      <Select
        value={value ?? ""}
        onValueChange={(v) => {
          const to = options.find((o) => o.value === v);
          if (to && v !== value) start(() => router.push(to.href, { scroll: false }));
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const STEP =
  "text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring inline-flex h-7 items-center gap-1.5 rounded-md px-1 text-sm outline-none focus-visible:ring-2 sm:px-2 [&_svg]:size-4";

/** Previous, today and next in the ribbon. A null link is off. */
export function WeekStepper({
  label, previous, today, next, isToday, todayLabel = "Today",
}: {
  label: string;
  previous: string | null;
  today: string;
  next: string | null;
  isToday: boolean;
  todayLabel?: string;
}) {
  const step = (href: string | null, name: string, icon: React.ReactNode) =>
    href ? (
      <ToolbarPrimitive.Link asChild>
        <Link href={href} scroll={false} className={STEP} aria-label={name}>
          {icon}
        </Link>
      </ToolbarPrimitive.Link>
    ) : (
      <span role="link" aria-disabled="true" aria-label={name} className={cn(STEP, "pointer-events-none opacity-40")}>
        {icon}
      </span>
    );
  return (
    <RibbonToolbar label="Dates" className="-mr-2 ml-auto sm:mr-0">
      <span className="text-foreground hidden pr-2 text-sm font-medium lg:inline" aria-live="polite">
        {label}
      </span>
      {step(previous, "Previous week", <ChevronLeft aria-hidden />)}
      <ToolbarPrimitive.Link asChild>
        <Link href={today} scroll={false} className={cn(STEP, isToday && "text-foreground font-medium")} aria-current={isToday ? "date" : undefined}>
          {todayLabel}
        </Link>
      </ToolbarPrimitive.Link>
      {step(next, "Next week", <ChevronRight aria-hidden />)}
    </RibbonToolbar>
  );
}
