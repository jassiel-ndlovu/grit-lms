"use client";

import Link from "next/link";
import { BookOpen, CalendarPlus, ChevronDown, Pencil, Plus, Target } from "lucide-react";

import { WriteGuard } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface NewMenuItem {
  label: string;
  href: string;
  icon: "course" | "test" | "assignment" | "event";
}

const ICONS = { course: BookOpen, test: Target, assignment: Pencil, event: CalendarPlus } as const;

/**
 * The tutor home's one primary action: "New ▾" (navigation.md, tutor home).
 * Every item creates something, so a read-only workspace gets the locked button.
 */
export function NewMenu({ items }: { items: NewMenuItem[] }) {
  return (
    <WriteGuard label="New" variant="brand">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="brand">
            <Plus className="size-4" /> New <ChevronDown className="size-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <DropdownMenuItem key={item.href} asChild>
                <Link href={item.href}>
                  <Icon className="size-4" /> {item.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </WriteGuard>
  );
}
