"use client";

/** Nexa admin: mark an enquiry contacted, closed or spam, with a short note. */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { adminUpdateEnquiry } from "../enquiry-actions";

type Status = "NEW" | "CONTACTED" | "CLOSED" | "SPAM";

export function EnquiryRowActions({ id, status, note }: { id: string; status: Status; note: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<Status | null>(null);
  const [text, setText] = React.useState(note ?? "");
  const [error, setError] = React.useState<string | null>(null);

  async function set(next: Status) {
    setBusy(next);
    setError(null);
    const r = await adminUpdateEnquiry({ id, status: next, note: text.trim() || null }).catch(() => null);
    setBusy(null);
    if (!r?.data) return setError(r?.serverError ?? "That didn't save. Try again.");
    router.refresh();
  }

  const choices: Array<{ s: Status; label: string }> = [
    { s: "CONTACTED", label: "Replied" },
    { s: "CLOSED", label: "Done" },
    { s: "SPAM", label: "Spam" },
    { s: "NEW", label: "Back to new" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <input
        aria-label="Note for Nexa staff"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        placeholder="Note for Nexa staff (optional)"
        className="border-input bg-background focus-visible:ring-ring/50 h-8 rounded-md border px-2 text-sm outline-none focus-visible:ring-2"
      />
      <div className="flex flex-wrap gap-1">
        {choices.filter((c) => c.s !== status).map((c) => (
          <Button key={c.s} size="sm" variant="outline" disabled={busy !== null} onClick={() => void set(c.s)}>
            {busy === c.s ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {c.label}
          </Button>
        ))}
      </div>
      {error ? <p role="alert" className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
