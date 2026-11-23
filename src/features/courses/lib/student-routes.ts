/**
 * A learner's course pages. Each lesson has its own path, not a query:
 * offline reading keeps one page per path (A's public/sw.js).
 */
export const studentCourseRoutes = {
  list: "/dashboard/courses",
  saved: "/dashboard/courses/saved",
  overview: (id: string) => `/dashboard/courses/${id}`,
  lessons: (id: string, lessonId?: string) => `/dashboard/courses/lessons/${id}${lessonId ? `/${lessonId}` : ""}`,
  practice: (id: string, setId?: string) => `/dashboard/courses/${id}/practice${setId ? `/${setId}` : ""}`,
};
