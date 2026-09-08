/**
 * Tabs — minimal shadcn-compatible tabs primitive.
 *
 * Mirrors the shadcn/Radix Tabs API (`<Tabs value onValueChange>` +
 * `<TabsList>` + `<TabsTrigger value>` + `<TabsContent value>`) but is
 * built on plain React state so we don't need to add `@radix-ui/react-tabs`
 * to the dependency tree. If you later install Radix, swap this file for
 * `pnpm dlx shadcn@latest add tabs` and every caller keeps working.
 *
 * Supports controlled OR uncontrolled use. Keyboard: left/right arrows
 * move between triggers inside a TabsList; Home/End jump to first/last.
 */

"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs.* used outside <Tabs>");
  return ctx;
}

export interface TabsProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  className,
  children,
  ...rest
}: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value! : internal;

  const setValue = React.useCallback(
    (next: string) => {
      if (!isControlled) setInternal(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const ctx = React.useMemo(
    () => ({ value: current, setValue }),
    [current, setValue],
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div className={cn("space-y-3", className)} {...rest}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn(
        "bg-muted/50 text-muted-foreground inline-flex flex-wrap items-center rounded-md p-1",
        className,
      )}
      {...rest}
    />
  );
}

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({
  value,
  className,
  onClick,
  ...rest
}: TabsTriggerProps) {
  const ctx = useTabsContext();
  const isActive = ctx.value === value;

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const list = e.currentTarget.parentElement;
    if (!list) return;
    const triggers = Array.from(
      list.querySelectorAll<HTMLButtonElement>("[role='tab']:not([disabled])"),
    );
    const currentIndex = triggers.indexOf(e.currentTarget);
    if (currentIndex === -1) return;
    let next = currentIndex;
    if (e.key === "ArrowLeft") next = (currentIndex - 1 + triggers.length) % triggers.length;
    if (e.key === "ArrowRight") next = (currentIndex + 1) % triggers.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = triggers.length - 1;
    triggers[next].focus();
    triggers[next].click();
  }

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? "active" : "inactive"}
      tabIndex={isActive ? 0 : -1}
      onClick={(e) => {
        ctx.setValue(value);
        onClick?.(e);
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium",
        "ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        isActive
          ? "bg-background text-foreground shadow-sm"
          : "hover:text-foreground",
        className,
      )}
      {...rest}
    />
  );
}

export interface TabsContentProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent({
  value,
  className,
  ...rest
}: TabsContentProps) {
  const ctx = useTabsContext();
  if (ctx.value !== value) return null;
  return (
    <div
      role="tabpanel"
      data-state="active"
      className={cn(
        "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      {...rest}
    />
  );
}
