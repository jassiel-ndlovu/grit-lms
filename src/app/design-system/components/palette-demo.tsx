"use client";

import * as React from "react";
import { BookOpen, CalendarDays, FileText, GraduationCap, Plus, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CommandPalette, useCommandPaletteShortcut, type CommandGroup } from "@/components/ui/command-palette";
import { Kbd } from "@/components/ui/kbd";

const GROUPS: CommandGroup[] = [
  {
    label: "Pages",
    items: [
      { id: "courses", label: "Courses", icon: <BookOpen />, href: "/design-system/components#courses" },
      { id: "calendar", label: "Calendar", icon: <CalendarDays />, href: "/design-system/components#calendar" },
      { id: "grades", label: "Grades", icon: <GraduationCap />, keywords: ["marks", "results"], href: "/design-system/components#grades" },
      { id: "settings", label: "Settings", icon: <Settings />, keywords: ["preferences", "meeting"], href: "/design-system/components#settings" },
    ],
  },
  {
    label: "Actions",
    items: [
      { id: "new-test", label: "New test", hint: "Grade 12 Mathematics", icon: <Plus />, onSelect: () => {} },
      { id: "new-lesson", label: "New lesson", hint: "Grade 12 Mathematics", icon: <FileText />, onSelect: () => {} },
    ],
  },
];

/** Demo only: static groups, no server search. */
export function PaletteDemo() {
  const [open, setOpen] = React.useState(false);
  useCommandPaletteShortcut(setOpen);
  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open command palette
      </Button>
      <span className="text-muted-foreground text-xs">
        or press <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>
      </span>
      <CommandPalette open={open} onOpenChange={setOpen} groups={GROUPS} />
    </div>
  );
}
