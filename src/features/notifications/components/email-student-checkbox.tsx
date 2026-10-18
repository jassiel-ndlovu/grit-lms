"use client";

/**
 * EmailStudentCheckbox — the "email the student that it's graded" toggle on
 * the tutor grading forms. Unticked, the student still gets the in-app
 * notification, just no email (immediate or digest). Ticked, the email
 * still only goes out if the student has email notifications on and a
 * verified address.
 */

import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface EmailStudentCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** e.g. "Thandi" — falls back to "the student". */
  studentName?: string;
  disabled?: boolean;
  className?: string;
}

export function EmailStudentCheckbox({
  checked,
  onCheckedChange,
  studentName,
  disabled,
  className,
}: EmailStudentCheckboxProps) {
  const id = React.useId();
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <label htmlFor={id} className="cursor-pointer select-none">
        <span className="block text-sm text-foreground">
          Email {studentName || "the student"} that it&apos;s graded
        </span>
        <span className="text-muted-foreground block text-xs">
          They&apos;re always notified in the app.
        </span>
      </label>
    </div>
  );
}
