/**
 * The fees list (a/ux/04 §6): filters, the table and paging. Pure display
 * of what listFeeInvoices returns; the page loads it. Row actions are in
 * fee-dialogs.tsx.
 */

import Link from "next/link";

import { StatusChip } from "@/components/shell/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import type { listFeeInvoices } from "@/features/payments/fee-queries";
import { formatDate, type DateContext } from "@/lib/datetime";

import { formatRand } from "../lib/billing-ui";
import { FEE_FILTERS, feeChip } from "../lib/payouts-ui";
import { FeeRowActions } from "./fee-dialogs";

export type FeeList = Awaited<ReturnType<typeof listFeeInvoices>>;
export type FeeFilter = (typeof FEE_FILTERS)[number]["key"];

export const FEES_PATH = "/dashboard/fees";

export function feesHref(p: { status?: FeeFilter; courseId?: string | null; cursor?: string | null }): string {
  const q = new URLSearchParams();
  if (p.status && p.status !== "OPEN") q.set("status", p.status);
  if (p.courseId) q.set("course", p.courseId);
  if (p.cursor) q.set("cursor", p.cursor);
  const s = q.toString();
  return s ? `${FEES_PATH}?${s}` : FEES_PATH;
}

/** YYYY-MM-DD of an instant in the viewer's zone, for comparing due days. */
function dayIn(iso: string | Date, ctx: DateContext): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ctx.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function FeeFilters({
  status,
  courseId,
  courses,
}: {
  status: FeeFilter;
  courseId: string | null;
  courses: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <nav aria-label="Fee status" className="flex gap-1 text-sm">
        {FEE_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={feesHref({ status: f.key, courseId })}
            aria-current={f.key === status ? "page" : undefined}
            className={
              f.key === status
                ? "bg-muted text-foreground rounded-md px-3 py-1.5 font-medium"
                : "text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5"
            }
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {courses.length > 1 ? (
        <form method="get" action={FEES_PATH} className="flex items-end gap-2">
          {status !== "OPEN" ? <input type="hidden" name="status" value={status} /> : null}
          <div className="space-y-1">
            <label htmlFor="fee-course" className="text-muted-foreground block text-xs">
              Course
            </label>
            <select
              id="fee-course"
              name="course"
              defaultValue={courseId ?? ""}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="border-input hover:bg-muted h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Show
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function FeesTable({
  list,
  ctx,
  canMarkOffsite,
  status,
  courseId,
  firstPage,
}: {
  list: FeeList;
  ctx: DateContext;
  canMarkOffsite: boolean;
  status: FeeFilter;
  courseId: string | null;
  firstPage: boolean;
}) {
  const today = dayIn(new Date(), ctx);
  if (list.items.length === 0 && firstPage) {
    return (
      <EmptyState
        compact
        title={status === "OPEN" ? "No open fees" : status === "PAID" ? "No paid fees yet" : "No fees yet"}
        description={
          status === "ALL" && !courseId
            ? "Create a fee for a student, and Nexa sends it to their parent to pay."
            : "Try another filter."
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="text-muted-foreground border-border border-b text-left text-xs">
            <tr>
              <th className="py-2 pr-3 font-medium">Student</th>
              <th className="py-2 pr-3 font-medium">Number</th>
              <th className="py-2 pr-3 font-medium">Paid to</th>
              <th className="py-2 pr-3 text-right font-medium">Fee</th>
              <th className="py-2 pr-3 font-medium">Due</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {list.items.map((f) => {
              const chip = feeChip(f.status, f.paidVia, dayIn(f.dueAt, ctx), today);
              return (
                <tr key={f.id}>
                  <td className="text-foreground py-2 pr-3">{f.learnerName || "—"}</td>
                  <td className="py-2 pr-3 tabular-nums">{f.number}</td>
                  <td className="text-muted-foreground py-2 pr-3">{f.payeeName}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatRand(f.totalCents)}</td>
                  <td className="py-2 pr-3">{formatDate(new Date(f.dueAt), ctx, { day: "numeric", month: "short" })}</td>
                  <td className="py-2 pr-3">
                    <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                  </td>
                  <td className="py-2 text-right">
                    {f.status === "OPEN" ? (
                      <FeeRowActions fee={{ id: f.id, number: f.number, learnerName: f.learnerName, totalCents: f.totalCents }} canMarkOffsite={canMarkOffsite} />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {list.nextCursor || !firstPage ? (
        <nav aria-label="Pages" className="flex gap-4 text-sm">
          {!firstPage ? (
            <Link href={feesHref({ status, courseId })} className="text-muted-foreground hover:text-foreground underline underline-offset-2">
              Newest
            </Link>
          ) : null}
          {list.nextCursor ? (
            <Link href={feesHref({ status, courseId, cursor: list.nextCursor })} className="text-muted-foreground hover:text-foreground underline underline-offset-2">
              Older
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
