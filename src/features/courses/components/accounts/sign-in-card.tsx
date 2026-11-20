"use client";

/**
 * The printable sign-in card a tutor hands a student or parent (a/ux/01,
 * section 6). The code is shown once: it isn't stored in plain text, so
 * closing the card loses it, and a new one means issuing a new code.
 *
 * Printing prints only the card (the style block below hides the rest).
 */

import * as React from "react";
import { Copy, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/datetime";

export interface SignInCardData {
  name: string;
  /** Who it's for, e.g. "Student" or "Parent of Thandi". */
  role: string;
  workspaceName: string;
  username: string | null;
  email: string | null;
  code: string;
  expiresAt: string;
}

const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  [data-sign-in-card], [data-sign-in-card] * { visibility: visible !important; }
  [data-sign-in-card] { position: absolute; left: 0; top: 0; width: 100%; border: 1px solid #000; }
  [data-sign-in-card-actions] { display: none !important; }
}`;

export function SignInCard({ card, onDone }: { card: SignInCardData; onDone?: () => void }) {
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);
  const signInWith = card.username ?? card.email ?? "";

  async function copy() {
    const text = `${card.workspaceName} on Nexa\nSign in at ${origin}/auth\nUsername: ${signInWith}\nCode: ${card.code}\nThe code works until ${formatDate(card.expiresAt)}.`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied the sign-in details.");
    } catch {
      toast.error("Couldn't copy. Select the details and copy them instead.");
    }
  }

  return (
    <div className="space-y-3">
      <style>{PRINT_CSS}</style>
      <div data-sign-in-card className="border-border bg-card space-y-4 rounded-lg border-2 border-dashed p-5">
        <div>
          <p className="text-muted-foreground text-xs">{card.workspaceName} on Nexa · {card.role}</p>
          <p className="font-display text-xl leading-tight">{card.name}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Sign in at</dt>
          <dd className="font-mono break-all">{origin ? `${origin}/auth` : "/auth"}</dd>
          <dt className="text-muted-foreground">{card.username ? "Username" : "Email"}</dt>
          <dd className="font-mono break-all">{signInWith}</dd>
          <dt className="text-muted-foreground">Code</dt>
          <dd className="font-mono text-lg font-semibold tracking-wider" data-testid="sign-in-code">{card.code}</dd>
        </dl>
        <p className="text-muted-foreground text-xs">
          The code is the first password. It works until {formatDate(card.expiresAt)}, then they choose their own password.
        </p>
      </div>
      <div data-sign-in-card-actions className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="size-3.5" /> Print
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          <Copy className="size-3.5" /> Copy
        </Button>
        {onDone ? (
          <Button type="button" size="sm" onClick={onDone}>
            Done
          </Button>
        ) : null}
        <p className="text-muted-foreground w-full text-xs">
          This is the only time the code is shown. If it&apos;s lost, issue a new one from the student&apos;s profile.
        </p>
      </div>
    </div>
  );
}
