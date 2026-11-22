"use client";

/**
 * Imports, sign-in cards (#216): every new student's and parent's card on
 * one A4 sheet, eight to a page, to print and cut. The codes come from A's
 * getSignInCards (audited) when the page opens and live only in memory:
 * never in the URL, storage or the server-rendered HTML. They stop working
 * after 14 days, and then the sheet is empty.
 */

import * as React from "react";
import Link from "next/link";
import { Loader2, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { actionError } from "@/features/courses/lib/account-ui";
import { getSignInCards } from "@/features/imports/actions";
import type { SignInCard } from "@/features/imports/types";
import { DEFAULT_TIME_ZONE, formatDate } from "@/lib/datetime";

import { importRoutes } from "./import-ui";

const PRINT_CSS = `@media print {
  @page { size: A4; margin: 10mm; }
  body * { visibility: hidden !important; }
  [data-sign-in-sheet], [data-sign-in-sheet] * { visibility: visible !important; }
  [data-sign-in-sheet] { position: absolute; left: 0; top: 0; width: 100%; }
  [data-sign-in-sheet] li { break-inside: avoid; }
}`;

export function SignInSheet({ jobId, workspaceName }: { jobId: string; workspaceName: string }) {
  const [cards, setCards] = React.useState<SignInCard[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    setOrigin(window.location.origin);
    let live = true;
    getSignInCards({ jobId })
      .then((res) => {
        if (!live) return;
        if (res?.data) setCards(res.data);
        else setError(actionError(res, "Couldn't load the cards. Try again."));
      })
      .catch(() => live && setError("Couldn't load the cards. Try again."));
    return () => {
      live = false;
    };
  }, [jobId]);

  if (error) return <p role="alert" className="text-destructive text-sm">{error}</p>;
  if (!cards) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 aria-hidden className="size-4 animate-spin" /> Loading the cards…
      </p>
    );
  }
  if (cards.length === 0) {
    return (
      <p className="border-border text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
        No cards to print. Sign-in codes work for 14 days; after that, give a student a new code from{" "}
        <Link href="/dashboard/students" className="text-foreground underline underline-offset-2">
          Students
        </Link>
        .{" "}
        <Link href={importRoutes.job(jobId)} className="text-foreground underline underline-offset-2">
          Back to the import
        </Link>
      </p>
    );
  }

  const signInAt = origin ? `${origin}/auth` : "/auth";
  return (
    <div className="space-y-4">
      <style>{PRINT_CSS}</style>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => window.print()}>
          <Printer className="size-4" /> Print {cards.length === 1 ? "1 card" : `${cards.length} cards`}
        </Button>
        <p className="text-muted-foreground text-xs">
          Each code is a first password. Hand the cards out in person and keep spare prints somewhere safe.
        </p>
      </div>
      <ul data-sign-in-sheet className="grid gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
        {cards.map((c) => (
          <li key={`${c.kind}-${c.username}`} className="bg-card space-y-3 rounded-lg border-2 border-dashed p-4 print:p-3">
            <div>
              <p className="text-muted-foreground text-xs">
                {workspaceName} on Nexa · {c.kind === "parent" ? (c.forStudent ? `Parent of ${c.forStudent}` : "Parent") : "Student"}
              </p>
              <p className="font-display text-lg leading-tight">{c.name}</p>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Sign in at</dt>
              <dd className="font-mono break-all">{signInAt}</dd>
              <dt className="text-muted-foreground">Username</dt>
              <dd className="font-mono break-all">{c.username}</dd>
              <dt className="text-muted-foreground">Code</dt>
              <dd className="font-mono text-base font-semibold tracking-wider">{c.code}</dd>
            </dl>
            <p className="text-muted-foreground text-xs">
              Works until {formatDate(c.expiresAt, { timeZone: DEFAULT_TIME_ZONE })}, then they choose their own password.
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
