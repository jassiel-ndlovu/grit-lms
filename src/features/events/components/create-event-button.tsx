"use client";

/**
 * CreateEventButton — "New session" for staff (#149). Opens EventForm in a
 * dialog, with a course picker when there is more than one course. The
 * new event repeats in the tutor's zone (`timeZone`).
 */

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WriteGuard } from "@/components/shell/workspace-access";

import { EventForm } from "./event-form";

export interface CreateEventButtonProps {
  /** Courses the viewer may add events to. */
  courses: { id: string; name: string }[];
  /** The tutor's zone; the series repeats at the same local time in it. */
  timeZone: string;
  /** The day the form starts on (`YYYY-MM-DD`). */
  initialDate?: string;
}

export function CreateEventButton({ courses, timeZone, initialDate }: CreateEventButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [courseId, setCourseId] = React.useState<string>(courses[0]?.id ?? "");

  if (courses.length === 0) return null;

  return (
    <WriteGuard label="New session" size="sm" variant="default">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="size-4" />
            New session
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New session</DialogTitle>
            <DialogDescription>It shows on the calendar of everyone on the course.</DialogDescription>
          </DialogHeader>

          {courses.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="new-session-course">Course</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger id="new-session-course">
                  <SelectValue placeholder="Pick a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <EventForm key={courseId} courseId={courseId} timeZone={timeZone} initialDate={initialDate} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </WriteGuard>
  );
}
