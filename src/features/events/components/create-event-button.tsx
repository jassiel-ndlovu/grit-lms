"use client";

/**
 * CreateEventButton — tutor-only entry point for adding a course event.
 *
 * Opens a Dialog containing the EventForm in create mode. After save the
 * dialog closes and the parent route re-fetches via router.refresh().
 *
 * If the tutor owns multiple courses we surface a course picker; if they
 * only own one, we lock to it.
 */

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { EventForm } from "./event-form";

export interface CreateEventButtonProps {
  /** Courses the tutor owns; required so the dialog can scope the new event. */
  courses: { id: string; name: string }[];
}

export function CreateEventButton({ courses }: CreateEventButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [courseId, setCourseId] = React.useState<string>(
    courses[0]?.id ?? "",
  );

  if (courses.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="brand">
          <Plus className="size-4" />
          New event
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a new event</DialogTitle>
          <DialogDescription>
            Lectures, exams, and reminders show up on the calendar for
            students enrolled in the chosen course.
          </DialogDescription>
        </DialogHeader>

        {courses.length > 1 && (
          <div className="space-y-1.5">
            <label className="text-foreground text-sm font-medium">
              Course
            </label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
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

        <EventForm
          courseId={courseId}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
