/**
 * Who referred whom, for owners and admins (viewer.md Draft 1.16), display
 * only. The page loads A's listReferralsFor; /design-system/join passes
 * samples.
 */

import { StatusChip } from "@/components/shell/status-chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, type DateContext } from "@/lib/datetime";

export interface ReferralTotal {
  referrerId: string;
  name: string;
  requested: number;
  joined: number;
}

export interface ReferralRow {
  referrerName: string;
  referredName: string;
  status: "REQUESTED" | "JOINED";
  createdAt: string;
  joinedAt: string | null;
}

const day = (iso: string, ctx: DateContext) => formatDate(new Date(iso), ctx, { day: "numeric", month: "short", year: "numeric" });

export function ReferrerTable({ rows }: { rows: ReferralTotal[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Referred by</TableHead>
          <TableHead className="text-right">Asked to join</TableHead>
          <TableHead className="text-right">Joined</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.referrerId}>
            <TableCell className="font-medium">{r.name}</TableCell>
            <TableCell className="text-right tabular-nums">{r.requested}</TableCell>
            <TableCell className="text-right tabular-nums">{r.joined}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ReferralList({ rows, ctx }: { rows: ReferralRow[]; ctx: DateContext }) {
  return (
    <ul className="divide-border border-border divide-y rounded-lg border">
      {rows.map((r, i) => (
        <li key={`${r.createdAt}:${i}`} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
          <div className="min-w-0 space-y-0.5">
            <p className="text-foreground font-medium">{r.referredName}</p>
            <p className="text-muted-foreground text-xs">
              referred by {r.referrerName} · asked {day(r.createdAt, ctx)}
              {r.joinedAt ? ` · joined ${day(r.joinedAt, ctx)}` : ""}
            </p>
          </div>
          <StatusChip tone={r.status === "JOINED" ? "success" : "info"}>{r.status === "JOINED" ? "Joined" : "Asked to join"}</StatusChip>
        </li>
      ))}
    </ul>
  );
}
