"use client";

/**
 * A query's conversation (support.md). The requester replies, closes or
 * reopens, and says whether the answer helped. Staff reply, add internal
 * notes, and close; a Nexa admin can hand it to the organisation or take it
 * back. Dates arrive as labels from the server.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, ThumbsDown, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { moveQueryAction, rateAnswerAction, replyByTokenAction, replyToQueryAction, setQueryStatusAction } from "../actions";
import { SUPPORT_LIMITS, type SupportRoute, type SupportStatus } from "../support-rules";
import { supportErrorMessage } from "../support-ui";

export type ThreadMessage = {
  id: string; authorName: string; fromStaff: boolean; internal: boolean; body: string; attachments: string[]; whenLabel: string;
};

export type ThreadProps = {
  id: string;
  status: SupportStatus;
  route: SupportRoute;
  helpful: boolean | null;
  messages: ThreadMessage[];
  /** requester (signed in), public (private link), staff or nexa. */
  side: "requester" | "public" | "staff" | "nexa";
  /** Private-link token, for the public requester. */
  token?: string;
  /** Nexa admin: the organisation it can be handed to (from the query's context). */
  handTo?: { id: string; name: string } | null;
  answererName: string;
};

export function QueryThread(p: ThreadProps) {
  const router = useRouter();
  const staffSide = p.side === "staff" || p.side === "nexa";
  const [body, setBody] = React.useState("");
  const [internal, setInternal] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ data?: unknown; serverError?: string } | undefined | null>, after?: () => void) {
    setBusy(key);
    setError(null);
    const r = await fn().catch(() => null);
    setBusy(null);
    if (!r || r.data === undefined) return setError(supportErrorMessage(r?.serverError));
    after?.();
    router.refresh();
  }

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return setError("Write a reply first.");
    void run(
      "reply",
      () => (p.side === "public" && p.token ? replyByTokenAction({ token: p.token, body }) : replyToQueryAction({ id: p.id, body, internal: staffSide && internal })),
      () => { setBody(""); setInternal(false); },
    );
  };

  const closed = p.status === "CLOSED";
  const canRate = p.side === "requester" && p.helpful === null && p.messages.some((m) => m.fromStaff && !m.internal);

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-col gap-3" aria-label="Messages">
        {p.messages.map((m) => (
          <li
            key={m.id}
            className={cn(
              "rounded-lg border p-4",
              m.internal ? "border-dashed border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/20" : m.fromStaff ? "border-border bg-muted/40" : "border-border",
            )}
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs">
              <span className="text-foreground font-medium">
                {m.internal ? <Lock aria-hidden className="mr-1 inline size-3" /> : null}
                {m.authorName}
                {m.internal ? <span className="text-muted-foreground font-normal"> · note for staff only</span> : null}
              </span>
              <span className="text-muted-foreground">{m.whenLabel}</span>
            </div>
            <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</p>
            {m.attachments.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {m.attachments.map((url, i) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Screenshot ${i + 1} from ${m.authorName}`} className="border-border h-24 w-auto rounded border object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>

      {canRate ? (
        <div className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
          <span className="text-foreground">Did this answer help?</span>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("rate", () => rateAnswerAction({ id: p.id, helpful: true }))}>
            <ThumbsUp aria-hidden className="size-4" /> Yes
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("rate", () => rateAnswerAction({ id: p.id, helpful: false }))}>
            <ThumbsDown aria-hidden className="size-4" /> No
          </Button>
        </div>
      ) : p.side === "requester" && p.helpful !== null ? (
        <p className="text-muted-foreground text-xs">Thanks for telling us{p.helpful ? "." : ". Reply below with what's still missing."}</p>
      ) : null}

      <form onSubmit={send} className="flex flex-col gap-2">
        <label htmlFor="reply" className="text-foreground text-sm font-medium">
          {staffSide ? (internal ? "Note for staff" : `Reply to ${p.answererName}`) : closed ? "Reply to reopen this query" : "Reply"}
        </label>
        <Textarea id="reply" rows={4} value={body} maxLength={SUPPORT_LIMITS.bodyMax} onChange={(e) => setBody(e.target.value)}
          placeholder={staffSide && internal ? "Only staff see this note." : staffSide ? "They'll get a notification and an email." : "Add more detail, or answer a question you were asked."} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" variant={internal ? "outline" : "brand"} disabled={busy !== null}>
            {busy === "reply" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {internal ? "Add note" : "Send reply"}
          </Button>
          {staffSide ? (
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              <input type="checkbox" className="accent-primary" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
              Note for staff only
            </label>
          ) : null}
        </div>
      </form>

      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}

      {p.side !== "public" ? (
        <div className="border-border flex flex-wrap items-center gap-2 border-t pt-4">
          {closed ? (
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("status", () => setQueryStatusAction({ id: p.id, status: "OPEN" }))}>Reopen</Button>
          ) : (
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("status", () => setQueryStatusAction({ id: p.id, status: "CLOSED" }))}>
              {staffSide ? "Close query" : "Close: I don't need more help"}
            </Button>
          )}
          {p.side === "nexa" && p.route === "NEXA" && p.handTo ? (
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run("move", () => moveQueryAction({ id: p.id, route: "WORKSPACE", workspaceId: p.handTo!.id }))}>
              Hand to {p.handTo.name}
            </Button>
          ) : null}
          {p.side === "nexa" && p.route === "WORKSPACE" ? (
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void run("move", () => moveQueryAction({ id: p.id, route: "NEXA" }))}>
              Take back to Nexa support
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
