/** An organisation's AI credits, and the packs its billing manager can buy. Server-safe. */

import { PageSection } from "@/components/shell/page-frame";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { formatDate, type DateContext } from "@/lib/datetime";

import { number } from "../../lib/study-ui";
import { CreditPacks } from "./credit-packs";

export function WorkspaceCredits({
  report: r,
  offer,
  ctx,
}: {
  report: {
    included: { left: number; credits: number; renewsAt: string | null } | null;
    bought: number;
    comped: boolean;
    usedThisMonth: number;
  };
  /** Null for staff who may only look. */
  offer: { validityDays: number; packs: Array<{ priceCents: number; credits: number }> } | null;
  ctx: DateContext;
}) {
  return (
    <>
      <PageSection id="left">
        <p className="text-muted-foreground text-sm">
          Your staff&apos;s AI marking and AI help use these: the credits in your plan first, then the ones you bought. Students&apos; study
          credits are separate.
        </p>
        <StatTiles>
          <StatTile label="Plan credits left" value={r.included ? number(r.included.left) : "-"} />
          <StatTile label="Bought credits left" value={number(Math.max(0, r.bought))} />
          <StatTile label="Used this month" value={number(r.usedThisMonth)} />
        </StatTiles>
        <p className="text-muted-foreground text-sm">
          {r.comped
            ? "Nexa covers this organisation's AI use, so nothing runs out."
            : r.included
              ? `Your plan brings ${number(r.included.credits)} credits${
                  r.included.renewsAt ? ` until ${formatDate(r.included.renewsAt, ctx)}` : ""
                }.`
              : "Your plan brings no credits right now."}
        </p>
      </PageSection>
      {r.comped ? null : offer ? (
        <PageSection id="buy" title="Buy credits">
          <CreditPacks offer={offer} buyer={{ kind: "WORKSPACE" }} />
        </PageSection>
      ) : (
        <p className="text-muted-foreground text-sm">Someone who manages billing can buy more.</p>
      )}
    </>
  );
}
