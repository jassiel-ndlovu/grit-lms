/**
 * GET /api/health — for an uptime monitor (design 06 §9). Public: it returns
 * only flags and ages, never data.
 *
 * 503 when the database does not answer within 2 seconds, or when a job's
 * last successful run is older than its `staleAfterMinutes`. A job that has
 * never run (or a database without the JobRun table yet) reports "unknown"
 * and does not fail the check.
 */

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { JOBS, type JobName } from "@/lib/jobs/registry";

export const dynamic = "force-dynamic";

type JobHealth = { status: "ok" | "stale" | "unknown"; lastOkMinutesAgo: number | null };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export async function GET() {
  const now = Date.now();

  let db = true;
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 2000);
  } catch {
    db = false;
  }

  const jobs = {} as Record<JobName, JobHealth>;
  let jobsReadable = db;
  for (const info of Object.values(JOBS)) {
    let lastOk: Date | null = null;
    if (jobsReadable) {
      try {
        const row = await withTimeout(
          prisma.jobRun.findFirst({
            where: { job: info.name, ok: true },
            orderBy: { startedAt: "desc" },
            select: { startedAt: true },
          }),
          2000,
        );
        lastOk = row?.startedAt ?? null;
      } catch {
        jobsReadable = false; // e.g. the JobRun migration is not applied yet
      }
    }
    const ago = lastOk ? Math.floor((now - lastOk.getTime()) / 60_000) : null;
    jobs[info.name] = {
      status: ago == null ? "unknown" : ago > info.staleAfterMinutes ? "stale" : "ok",
      lastOkMinutesAgo: ago,
    };
  }

  const ok = db && Object.values(jobs).every((j) => j.status !== "stale");
  return NextResponse.json(
    { ok, db, jobs, time: new Date(now).toISOString() },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
