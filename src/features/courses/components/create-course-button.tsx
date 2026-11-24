"use client";

/**
 * CreateCourseButton — opens a Dialog containing the CourseForm in create
 * mode. Lives on the manage-courses listing page so tutors can create
 * without navigating away.
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

import { WriteGuard } from "@/components/shell/workspace-access";

import { CourseForm } from "./course-form";
import type { StudentListItem } from "@/features/students/queries";

export function CreateCourseButton({
  students,
}: {
  students: StudentListItem[];
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <WriteGuard label="New course" size="default" variant="default">
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New course
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New course</DialogTitle>
          <DialogDescription>
            Give it a name, a cover and a description. You can add students now or later.
          </DialogDescription>
        </DialogHeader>
        <CourseForm
          students={students}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
    </WriteGuard>
  );
}
