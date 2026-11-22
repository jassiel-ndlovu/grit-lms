/**
 * /dashboard/browse-courses — retired. It listed every course on the
 * platform, across workspaces; tutors now choose which courses to list
 * (#206), and Find courses shows only those. Old links land there.
 */

import { permanentRedirect } from "next/navigation";

import { joinRoutes } from "@/features/courses/lib/join-ui";

export default function LegacyBrowseCoursesPage() {
  permanentRedirect(joinRoutes.browse);
}
