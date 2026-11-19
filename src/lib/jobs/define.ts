/**
 * defineJob(name, run) — the route handlers for one scheduled job.
 * docs/revamp/a/design/06-deployment.md §5.
 *
 *   const job = defineJob("notifications", () => runNotificationJobs());
 *   export const GET = job.GET;
 *   export const POST = job.POST;
 *
 * Verifies the caller, records a JobRun row (start, end, ok, the job's
 * result: counts only, never personal data) and returns `{ ok, ...result }`.
 *
 * Recording is best effort: if the JobRun table is missing (the migration
 * not yet applied) or the write fails, the job still runs and a warning is
 * logged. Jobs must be idempotent: schedulers deliver at least once.
 */

import "server-only";

import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";

import type { JobName } from "./registry";
import { verifyJobRequest } from "./verify";

type JobResult = Record<string, unknown>;

async function record<T>(label: string, op: () => Promise<T>): Promise<T | null> {
  try {
    return await op();
  } catch (e) {
    console.warn(`[jobs] could not ${label}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

export function defineJob(name: JobName, run: () => Promise<JobResult>) {
  async function handle(req: NextRequest) {
    const body = req.method === "POST" ? await req.text() : "";
    const auth = await verifyJobRequest({ headers: req.headers, body, path: req.nextUrl.pathname });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const row = await record("start JobRun", () =>
      prisma.jobRun.create({ data: { job: name, trigger: auth.trigger }, select: { id: true } }),
    );

    try {
      const result = await run();
      if (row) {
        await record("finish JobRun", () =>
          prisma.jobRun.update({
            where: { id: row.id },
            data: { finishedAt: new Date(), ok: true, result: JSON.parse(JSON.stringify(result)) },
          }),
        );
      }
      return NextResponse.json({ ok: true, job: name, ...result });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[jobs] ${name} failed:`, e);
      // No-op unless SENTRY_DSN is set; the event is scrubbed in beforeSend.
      Sentry.captureException(e, { tags: { job: name } });
      await Sentry.flush(2000).catch(() => false);
      if (row) {
        await record("finish JobRun", () =>
          prisma.jobRun.update({
            where: { id: row.id },
            data: { finishedAt: new Date(), ok: false, error: message.slice(0, 500) },
          }),
        );
      }
      return NextResponse.json({ ok: false, job: name, error: "Job failed" }, { status: 500 });
    }
  }

  return { GET: handle, POST: handle };
}
