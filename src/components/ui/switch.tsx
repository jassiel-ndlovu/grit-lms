/**
 * Switch — lightweight toggle (no Radix dep).
 *
 * Renders as a segmented pill via a real `<input type="checkbox">` so
 * screen readers see the standard checked-state and keyboard users can
 * space-toggle it. Compatible with shadcn's `<Switch checked onCheckedChange>`
 * API for easy migration later.
 */

"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  function Switch({ className, checked, defaultChecked, onCheckedChange, disabled, ...rest }, ref) {
    return (
      <label
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors",
          "border-input bg-muted",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.currentTarget.checked)}
          {...rest}
        />
        <span
          className={cn(
            "peer-checked:bg-brand-terracotta pointer-events-none absolute inset-0 rounded-full transition-colors",
          )}
        />
        <span
          className={cn(
            "pointer-events-none relative ml-0.5 inline-block size-4 rounded-full bg-background shadow-sm transition-transform",
            "peer-checked:translate-x-4",
          )}
        />
      </label>
    );
  },
);
