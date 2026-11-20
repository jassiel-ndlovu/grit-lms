/**
 * The teacher for B's teaching pages and actions: the signed-in user.
 *
 * These pages used to start from the user's `Tutor` row, found by email.
 * Tutors made the tenancy way (workspace onboarding, invitations, the role
 * choice, the Preview seed) have a Membership but no `Tutor` row, so the
 * pages now key teaching on the user id, through CourseStaff
 * (`taughtByUser`). `id` is a USER id, not a Tutor profile id.
 */
export function teacherFrom(user: { id: string; name?: string | null }): { id: string; fullName: string } {
  return { id: user.id, fullName: user.name ?? "" };
}
