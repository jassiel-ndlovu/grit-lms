"use client";

/**
 * The study assistant's switch for each student, on the tutor's side: the
 * course's list, and the button on one student's chat.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";

import { useReadOnly, WriteGuard } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { matchName, switchSummary } from "../../lib/study-ui";
import { setStudentSwitchAction } from "../../study-switch-actions";

type Student = { studentUserId: string; name: string };

/** Switches a student, and says what happened. */
function useSwitch(courseId: string) {
  const router = useRouter();
  const [saving, setSaving] = React.useState<ReadonlySet<string>>(new Set());

  async function set({ studentUserId, name }: Student, on: boolean): Promise<boolean> {
    setSaving((s) => new Set(s).add(studentUserId));
    const r = await setStudentSwitchAction({ courseId, studentUserId, on }).catch(() => null);
    setSaving((s) => new Set([...s].filter((x) => x !== studentUserId)));
    if (!r?.data) {
      toast.error(r?.serverError ?? "That didn't work. Try again.");
      return false;
    }
    toast.success(`The study assistant is ${on ? "on" : "off"} for ${name}.`);
    router.refresh();
    return true;
  }

  return { saving, set };
}

/** Finding a student only helps when the list is longer than a screen. */
const FIND_FROM = 12;

export function StudentSwitches({ courseId, rows }: { courseId: string; rows: Array<Student & { on: boolean }> }) {
  const id = React.useId();
  const readOnly = useReadOnly();
  const { saving, set } = useSwitch(courseId);
  /** Switched here, until the page's own rows catch up. */
  const [changed, setChanged] = React.useState<ReadonlyMap<string, boolean>>(new Map());
  const [query, setQuery] = React.useState("");
  const now = rows.map((r) => ({ ...r, on: changed.get(r.studentUserId) ?? r.on }));
  const shown = now.filter((r) => matchName(r.name, query));

  async function toggle(student: Student, on: boolean) {
    const put = (value: boolean) => setChanged((m) => new Map(m).set(student.studentUserId, value));
    put(on);
    if (!(await set(student, on))) put(!on);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {switchSummary(now.filter((r) => !r.on).length, now.length)}
        </p>
        {rows.length >= FIND_FROM ? (
          <div className="w-full space-y-1.5 sm:w-64">
            <Label htmlFor={`${id}-find`}>Find a student</Label>
            <Input id={`${id}-find`} type="search" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        ) : null}
      </div>
      {shown.length === 0 ? (
        <p className="text-foreground text-sm">No student has that name.</p>
      ) : (
        <ul className="divide-border border-border divide-y border-y">
          {shown.map((r) => (
            <li key={r.studentUserId} className="flex items-center gap-4 px-2 py-3">
              <span className="text-foreground min-w-0 flex-1 text-sm font-medium break-words">{r.name}</span>
              <span aria-hidden className="text-muted-foreground text-xs">
                {r.on ? "On" : "Off"}
              </span>
              <Switch
                aria-label={`Study assistant for ${r.name}`}
                checked={r.on}
                disabled={readOnly || saving.has(r.studentUserId)}
                onCheckedChange={(on) => void toggle(r, on)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** On one student's chat. */
export function StudentSwitchButton({ courseId, student, on }: { courseId: string; student: Student; on: boolean }) {
  const { saving, set } = useSwitch(courseId);
  const label = on ? "Turn off for this student" : "Turn on for this student";
  const Icon = saving.size > 0 ? Loader2 : on ? PowerOff : Power;
  return (
    <WriteGuard label={label}>
      <Button type="button" size="sm" variant="outline" disabled={saving.size > 0} onClick={() => void set(student, !on)}>
        <Icon aria-hidden className={saving.size > 0 ? "size-4 animate-spin" : "size-4"} />
        {label}
      </Button>
    </WriteGuard>
  );
}
