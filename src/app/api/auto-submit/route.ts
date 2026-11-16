/**
 * /api/auto-submit — alias of /api/cron/auto-submit, kept until every
 * scheduler calls the new path (design 07, Batch 5). Delete it after the
 * scheduled-jobs workflow has used /api/cron/auto-submit for a release.
 */

// Segment config must be a literal in each route file, so it is not re-exported.
export const dynamic = "force-dynamic";

export { GET, POST } from "../cron/auto-submit/route";
