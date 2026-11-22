"use client";

/**
 * Course settings › Curriculum (#216, contracts/curriculum.md): curriculum,
 * subject and grade. They choose the topic list the course's lessons and
 * questions are tagged from, and the coverage map's rows.
 */

import * as React from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { CURRICULA, CURRICULUM_LABEL, SUBJECT_OPTIONS, type CourseCurriculum, type Curriculum } from "../lib/curriculum";

const NONE = "none";

export function CurriculumFields({
  value,
  onChange,
  disabled,
}: {
  value: CourseCurriculum;
  onChange: (next: CourseCurriculum) => void;
  disabled?: boolean;
}) {
  const id = React.useId();
  const hasCatalogue = value.curriculum === "CAPS" || value.curriculum === "IEB";
  const subject = SUBJECT_OPTIONS.find((s) => s.key === value.subject) ?? null;

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor={`${id}-curriculum`} className="text-foreground text-sm font-medium">
            Curriculum
          </label>
          <Select
            value={value.curriculum ?? NONE}
            disabled={disabled}
            onValueChange={(v) => {
              const curriculum = v === NONE ? null : (v as Curriculum);
              const keep = curriculum === "CAPS" || curriculum === "IEB";
              onChange({ curriculum, subject: keep ? value.subject : null, gradeLevel: keep ? value.gradeLevel : null });
            }}
          >
            <SelectTrigger id={`${id}-curriculum`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Not set</SelectItem>
              {CURRICULA.map((c) => (
                <SelectItem key={c} value={c}>
                  {CURRICULUM_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasCatalogue ? (
          <>
            <div className="space-y-1.5">
              <label htmlFor={`${id}-subject`} className="text-foreground text-sm font-medium">
                Subject
              </label>
              <Select
                value={value.subject ?? NONE}
                disabled={disabled}
                onValueChange={(v) => {
                  const next = SUBJECT_OPTIONS.find((s) => s.key === v) ?? null;
                  onChange({
                    ...value,
                    subject: next?.key ?? null,
                    gradeLevel: next && value.gradeLevel != null && next.grades.includes(value.gradeLevel) ? value.gradeLevel : null,
                  });
                }}
              >
                <SelectTrigger id={`${id}-subject`} className="w-full">
                  <SelectValue placeholder="Choose a subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  {SUBJECT_OPTIONS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${id}-grade`} className="text-foreground text-sm font-medium">
                Grade
              </label>
              <Select
                value={value.gradeLevel != null ? String(value.gradeLevel) : NONE}
                disabled={disabled || !subject}
                onValueChange={(v) => onChange({ ...value, gradeLevel: v === NONE ? null : Number(v) })}
              >
                <SelectTrigger id={`${id}-grade`} className="w-full">
                  <SelectValue placeholder="Choose a grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  {(subject?.grades ?? []).map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      Grade {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        {value.curriculum === "OTHER"
          ? "Topic tagging covers CAPS and IEB subjects for now."
          : "Lessons and questions can then be tagged with the curriculum's topics, and the course shows which topics are covered. IEB courses use the CAPS topics. Mathematics, Grades 10 to 12, for now."}
      </p>
    </div>
  );
}
