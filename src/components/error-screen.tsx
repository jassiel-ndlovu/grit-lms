/**
 * Nexa's error pages: one layout for 404, 401, 403 and 500, so a dead end
 * still says what happened and offers a way on. Used by the app's
 * not-found, error, forbidden and unauthorized files. Server-safe (no hooks);
 * the client bits live in error-screen-client.tsx.
 */

import Link from "next/link";

import ErrorArt from "@/components/illustrations/generated/error";
import NotFoundArt from "@/components/illustrations/generated/not-found";
import { cn } from "@/lib/utils";

export type ErrorKind = "404" | "401" | "403" | "500";

/** What each page says. Plain words; the code is shown small, for support. */
export const ERROR_COPY: Record<ErrorKind, { title: string; description: string }> = {
  "404": {
    title: "We can't find that page",
    description: "The link may be old or mistyped, or the page was moved or deleted. If someone sent it to you, ask them for a fresh link.",
  },
  "401": {
    title: "Sign in to see this page",
    description: "This page is only for people with a Nexa account. Sign in and we'll bring you back here.",
  },
  "403": {
    title: "You don't have access to this page",
    description: "Your account can't open it. If you think you should, ask the owner or an admin of your workspace to give you access.",
  },
  "500": {
    title: "Something went wrong on our side",
    description: "It isn't anything you did. We've been told about it. Try again in a moment; if it keeps happening, contact support.",
  },
};

/** A plain frame for error pages outside the dashboard: the wordmark and the page. */
export function ErrorFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="border-border border-b px-4 py-3 sm:px-6">
        <Link href="/" className="font-display text-foreground text-lg tracking-tight">
          Nexa
        </Link>
      </header>
      <main className="flex flex-1 items-center">{children}</main>
    </div>
  );
}

export function ErrorScreen({
  kind,
  title,
  description,
  detail,
  actions,
  className,
}: {
  kind: ErrorKind;
  title?: string;
  description?: string;
  /** A line under the description, for example the missing address or an error reference. */
  detail?: React.ReactNode;
  /** The buttons. Every page should offer at least one way on. */
  actions: React.ReactNode;
  className?: string;
}) {
  const copy = ERROR_COPY[kind];
  const Art = kind === "500" ? ErrorArt : NotFoundArt;
  return (
    <section
      aria-labelledby="error-title"
      className={cn("mx-auto grid w-full max-w-4xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1fr_auto] md:py-20", className)}
    >
      <div className="max-w-lg space-y-5">
        <p className="text-muted-foreground font-mono text-xs tracking-wide uppercase">Error {kind}</p>
        <h1 id="error-title" className="font-display text-foreground text-3xl leading-tight tracking-tight sm:text-4xl">
          {title ?? copy.title}
        </h1>
        <p className="text-muted-foreground text-base">{description ?? copy.description}</p>
        {detail ? <div className="text-muted-foreground text-sm">{detail}</div> : null}
        <div className="flex flex-wrap items-center gap-3 pt-2">{actions}</div>
        <p className="text-muted-foreground pt-4 text-sm">
          Still stuck?{" "}
          <Link href="/support" className="text-foreground underline underline-offset-2">
            Contact support
          </Link>
          .
        </p>
      </div>
      <Art className="mx-auto hidden h-72 w-auto md:block" />
    </section>
  );
}
