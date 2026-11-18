/**
 * Every assignment URL, in one place. Assignments live under
 * /dashboard/assignments; the old /dashboard/submissions URLs redirect
 * here (see legacyAssignmentPath). Pure; safe anywhere.
 */

const BASE = "/dashboard/assignments";

const seg = (s: string) => encodeURIComponent(s);

export const assignmentRoutes = {
  /** Students: assignments across their courses. Tutors: the ones they set. */
  index: BASE,
  /** One assignment; tutors see the class list, students hand in here. */
  detail: (id: string) => `${BASE}/${seg(id)}`,
  new: `${BASE}/new`,
  edit: (id: string) => `${BASE}/${seg(id)}/edit`,
  /** A tutor grading one student's work. */
  student: (id: string, studentId: string) => `${BASE}/${seg(id)}/students/${seg(studentId)}`,
} as const;

/**
 * Where an old /dashboard/submissions URL now lives, from the path segments
 * after "submissions". Old links stay in emails, notifications and
 * bookmarks, so this mapping is permanent.
 *
 *   []                          → index
 *   [id]                        → detail
 *   create                      → new
 *   create/id                   → edit
 *   overview/id, portal/id,
 *   review/id                   → detail
 *   overview/id/studentId       → student
 *   anything else               → index
 */
export function legacyAssignmentPath(segments: readonly string[]): string {
  const [first, second, third, ...rest] = segments;
  if (first === undefined) return assignmentRoutes.index;

  if (first === "create") {
    if (second === undefined) return assignmentRoutes.new;
    return third === undefined ? assignmentRoutes.edit(second) : assignmentRoutes.index;
  }
  if (first === "overview" && second !== undefined) {
    if (third === undefined) return assignmentRoutes.detail(second);
    return rest.length === 0 ? assignmentRoutes.student(second, third) : assignmentRoutes.index;
  }
  if ((first === "portal" || first === "review") && second !== undefined && third === undefined) {
    return assignmentRoutes.detail(second);
  }
  if (second === undefined && !["create", "overview", "portal", "review"].includes(first)) {
    return assignmentRoutes.detail(first);
  }
  return assignmentRoutes.index;
}
