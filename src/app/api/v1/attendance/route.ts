/** GET /api/v1/attendance (#216 phase 3, Pro). Contract: docs/revamp/contracts/api.md. */

import { listAttendance, v1Route } from "@/features/api/v1";

export const dynamic = "force-dynamic";

export const GET = v1Route("attendance.read", listAttendance);
