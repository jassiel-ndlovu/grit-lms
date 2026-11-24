/**
 * Study credits as a student or parent sees them: what's left, the packs to
 * buy, and what was bought and when it runs out. Server-safe.
 */

import { PageSection } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { roughAnswers } from "@/features/ai-credits/topup-math";
import { formatDate, type DateContext } from "@/lib/datetime";

import { nameList, nextExpiry, number } from "../../lib/study-ui";
import type { StudyAccount } from "../../study";
import { CreditPacks } from "./credit-packs";

export function CreditPurchases({ rows, ctx }: { rows: StudyAccount["purchases"]; ctx: DateContext }) {
  return (
    <ul className="divide-border border-border divide-y border-y text-sm">
      {rows.map((p) => (
        <li key={p.boughtAt.getTime()} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2.5">
          <span className="text-foreground min-w-0 flex-1 basis-48">
            {number(p.credits)} credits
            <span className="text-muted-foreground block text-xs">Bought {formatDate(p.boughtAt, ctx)}</span>
          </span>
          {p.expired ? <StatusChip>Expired</StatusChip> : null}
          {p.expiresAt && !p.expired ? (
            <span className="text-muted-foreground text-xs">Expires {formatDate(p.expiresAt, ctx)}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** One student's credits in one organisation. */
export function StudyAccountSection({
  account: a,
  ctx,
  title,
}: {
  account: StudyAccount;
  ctx: DateContext;
  /** The child and organisation; null for a student's own only one. */
  title: string | null;
}) {
  const expiry = nextExpiry(a.purchases);
  return (
    <PageSection
      id={`credits-${a.studentUserId}-${a.workspace.id}`}
      title={title}
    >
      <p className="text-muted-foreground text-sm">
        {a.courses.length
          ? `For the study assistant in ${a.courses.map((c) => c.name).join(", ")}.`
          : a.off.length
            ? "No course can use them at the moment."
            : "No course has the study assistant on at the moment."}
        {a.off.length ? ` A tutor switched the assistant off in ${nameList(a.off)}.` : null}
      </p>
      <StatTiles>
        <StatTile label="Credits left" value={number(a.balance)} />
        <StatTile label="Answers (about)" value={number(roughAnswers(a.balance))} />
        <StatTile
          label="Next to expire"
          value={a.balance > 0 && expiry ? formatDate(expiry, ctx, { day: "numeric", month: "short" }) : "-"}
        />
      </StatTiles>
      {a.courses.length === 0 ? null : a.payer ? (
        <CreditPacks
          offer={a.offer}
          buyer={{ kind: "STUDENT", studentUserId: a.studentUserId, workspaceId: a.workspace.id }}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          Ask your parent to buy study credits. They can do it from their own Nexa account.
        </p>
      )}
      {a.purchases.length ? (
        <div className="space-y-2">
          <h3 className="text-foreground text-sm font-medium">Bought</h3>
          <CreditPurchases rows={a.purchases} ctx={ctx} />
        </div>
      ) : null}
    </PageSection>
  );
}
