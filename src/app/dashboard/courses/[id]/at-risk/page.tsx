/**
 * /dashboard/courses/[id]/at-risk — where A's at-risk notifications link
 * (viewer.md Draft 1.20). The list lives at /dashboard/at-risk, which checks
 * who may see it.
 */

import { redirect } from "next/navigation";

import { atRiskRoutes } from "@/features/activity/lib/at-risk";

export default async function CourseAtRiskPage({ params }: { params: Promise<{ id: string }> }) {
  redirect(atRiskRoutes.view("open", (await params).id));
}
