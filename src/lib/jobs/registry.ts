/**
 * Every scheduled job: name, route, schedule and how stale it may get before
 * /api/health reports a problem. docs/revamp/a/design/06-deployment.md §5, §9.
 *
 * Stage 1: `.github/workflows/scheduled-jobs.yml` calls these routes and is
 * edited by hand to match (scripts/check-jobs.ts compares them).
 * Stage 2: the same routes are scheduled in QStash or Vercel Cron.
 */

export type JobName = "auto-submit" | "notifications" | "housekeeping";

export type JobInfo = {
  name: JobName;
  path: `/api/cron/${string}`;
  /** Cron expression in UTC, as the scheduler uses it. */
  schedule: string;
  /** /api/health fails when the last successful run is older than this. */
  staleAfterMinutes: number;
};

export const JOBS: Record<JobName, JobInfo> = {
  "auto-submit": {
    name: "auto-submit",
    path: "/api/cron/auto-submit",
    schedule: "*/5 * * * *",
    staleAfterMinutes: 20,
  },
  notifications: {
    name: "notifications",
    path: "/api/cron/notifications",
    schedule: "0 * * * *",
    staleAfterMinutes: 120,
  },
  housekeeping: {
    name: "housekeeping",
    path: "/api/cron/housekeeping",
    schedule: "30 0 * * *",
    staleAfterMinutes: 26 * 60,
  },
};
