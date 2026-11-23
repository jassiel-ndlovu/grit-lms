"use client";

/**
 * Settings › Online classes (#211): the workspace's meeting provider. It
 * picks the "New … meeting" button in the session form; pasted links of any
 * provider keep working. Owners and admins (`workspace.settings`), saved
 * with A's setMeetingProvider. Locked while the workspace is read-only.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { READ_ONLY_REASON, useReadOnly } from "@/components/shell/workspace-access";
import { Card } from "@/components/ui/card";
import { setMeetingProvider } from "@/features/workspaces/actions";
import { MEETING_PROVIDERS, type MeetingProvider } from "@/lib/viewer-core";
import { cn } from "@/lib/utils";

import { MEETING_PROVIDER_INFO } from "../lib/calendar-ui";
import { MeetingAppMark } from "./meeting-app-mark";

export function MeetingProviderSetting({ initial }: { initial: MeetingProvider }) {
  const router = useRouter();
  const readOnly = useReadOnly();
  const [value, setValue] = React.useState<MeetingProvider>(initial);
  const [pending, start] = React.useTransition();

  const pick = (next: MeetingProvider) => {
    if (next === value || readOnly) return;
    const before = value;
    setValue(next);
    start(async () => {
      const res = await setMeetingProvider({ meetingProvider: next });
      if (res?.data) {
        toast.success(`New sessions offer ${MEETING_PROVIDER_INFO[next].label}.`);
        router.refresh();
        return;
      }
      setValue(before);
      toast.error(res?.serverError ?? "Couldn't change the meeting app. Try again.");
    });
  };

  return (
    <Card className="space-y-3 p-6">
      <div>
        <h2 id="meeting-provider-label" className="text-foreground text-sm font-medium">
          Online classes
        </h2>
        <p className="text-muted-foreground text-xs">
          The meeting app your tutors use. The session form gets a button that starts one; links from any app still work.
        </p>
      </div>
      <div role="radiogroup" aria-labelledby="meeting-provider-label" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MEETING_PROVIDERS.map((p) => {
          const on = value === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={readOnly || pending}
              onClick={() => pick(p)}
              className={cn(
                "focus-visible:ring-ring flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
                on ? "border-primary ring-primary/30 ring-2" : "border-border hover:border-input",
              )}
            >
              <MeetingAppMark provider={p} />
              {MEETING_PROVIDER_INFO[p].label}
            </button>
          );
        })}
      </div>
      {readOnly ? <p className="text-muted-foreground text-xs">{READ_ONLY_REASON}</p> : null}
    </Card>
  );
}
