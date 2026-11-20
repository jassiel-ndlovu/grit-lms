"use client";

/**
 * "Extra time on timed tests" on a course's Settings page (owner decision
 * 7, WCAG 2.2.1): one picker per enrolled student. A change saves at once
 * and reaches any test the student has open on the course.
 */

import * as React from "react";
import { Hourglass } from "lucide-react";
import { toast } from "sonner";

import { setExtraTime } from "../accommodation-actions";
import { EXTRA_TIME_CHOICES, EXTRA_TIME_LABEL, type ExtraTimeChoice } from "../lib/extra-time";

export function ExtraTimeCard({
  courseId,
  students,
  initial,
}: {
  courseId: string;
  students: Array<{ id: string; name: string }>;
  /** Current choice by student id; missing means None. */
  initial: Record<string, ExtraTimeChoice>;
}) {
  const [values, setValues] = React.useState<Record<string, ExtraTimeChoice>>(initial);
  const [pending, setPending] = React.useState<string | null>(null);

  async function change(student: { id: string; name: string }, choice: ExtraTimeChoice) {
    const before = values[student.id] ?? "0";
    setValues((v) => ({ ...v, [student.id]: choice }));
    setPending(student.id);
    try {
      const res = await setExtraTime({ courseId, studentId: student.id, choice });
      if (res?.serverError || res?.validationErrors) throw new Error(res.serverError ?? "Choose one of the options.");
      const open = res?.data?.openAttempts ?? 0;
      toast.success(
        choice === "0"
          ? `${student.name} has no extra time now.`
          : `${student.name}: ${EXTRA_TIME_LABEL[choice]} on timed tests.${open > 0 ? " Their open test has it too." : ""}`,
      );
    } catch (e) {
      setValues((v) => ({ ...v, [student.id]: before }));
      toast.error(e instanceof Error ? e.message : "Couldn't save the extra time.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section aria-labelledby="extra-time-heading" className="space-y-4">
      <div>
        <h2 id="extra-time-heading" className="font-display text-foreground flex items-center gap-2 text-lg leading-tight tracking-tight">
          <Hourglass className="text-muted-foreground size-4" aria-hidden />
          Extra time on timed tests
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          For a student who needs longer, such as an exam accommodation. It stretches the time limit
          of every timed test on this course; the due date still closes the test.
        </p>
      </div>
      {students.length === 0 ? (
        <p className="text-muted-foreground text-sm">No students are enrolled yet.</p>
      ) : (
        <ul className="divide-border divide-y">
          {students.map((s) => {
            const id = `extra-time-${s.id}`;
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <label htmlFor={id} className="text-foreground min-w-0 truncate text-sm">
                  {s.name}
                </label>
                <select
                  id={id}
                  value={values[s.id] ?? "0"}
                  disabled={pending === s.id}
                  onChange={(e) => void change(s, e.target.value as ExtraTimeChoice)}
                  className="border-input bg-background h-9 rounded-md border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                >
                  {EXTRA_TIME_CHOICES.map((c) => (
                    <option key={c} value={c}>
                      {EXTRA_TIME_LABEL[c]}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
