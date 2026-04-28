"use client";

/**
 * StudentPicker — multi-select dropdown for enrolling students on a course.
 *
 * Controlled component: parent owns the selected ID list and supplies the
 * full student catalogue. Renders selected students as removable chips.
 */

import * as React from "react";
import Image from "next/image";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StudentListItem } from "@/features/students/queries";

export interface StudentPickerProps {
  students: StudentListItem[];
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

export function StudentPicker({
  students,
  value,
  onChange,
  className,
}: StudentPickerProps) {
  const selectedSet = new Set(value);
  const available = students.filter((s) => !selectedSet.has(s.id));
  const selected = students.filter((s) => selectedSet.has(s.id));

  return (
    <div className={cn("space-y-3", className)}>
      <Select
        value=""
        onValueChange={(id) => {
          if (id && !selectedSet.has(id)) {
            onChange([...value, id]);
          }
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a student to enrol" />
        </SelectTrigger>
        <SelectContent>
          {available.length === 0 ? (
            <div className="text-muted-foreground px-2 py-1.5 text-sm">
              All students enrolled
            </div>
          ) : (
            available.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.fullName}
                <span className="text-muted-foreground ml-2 text-xs">
                  {s.email}
                </span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((s) => (
            <span
              key={s.id}
              className="bg-secondary text-secondary-foreground inline-flex items-center gap-2 rounded-full py-1 pr-1 pl-2 text-xs"
            >
              {s.imageUrl ? (
                <Image
                  src={s.imageUrl}
                  alt={s.fullName}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              ) : (
                <span className="bg-primary/20 text-primary flex size-5 items-center justify-center rounded-full text-[10px] font-medium">
                  {s.fullName.charAt(0)}
                </span>
              )}
              {s.fullName}
              <button
                type="button"
                onClick={() => onChange(value.filter((id) => id !== s.id))}
                className="hover:bg-destructive/10 hover:text-destructive rounded-full p-0.5"
                aria-label={`Remove ${s.fullName}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
