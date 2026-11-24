/**
 * /dashboard/manage-courses/[id]/practice/[setId] — one practice set: its
 * name and publish switch, its questions, and how each student stands.
 */

import { notFound } from "next/navigation";

import { PageMessage, PageSection, PageTitle } from "@/components/shell/page-frame";
import { StatusChip } from "@/components/shell/status-chip";
import { DeletePracticeSetButton, PracticeItems, PracticeSetDetails } from "@/features/assessments/components/practice-set-editor";
import { readBankNode } from "@/features/assessments/lib/question-bank";
import { getPracticeSet, hasPractice, practiceByStudent } from "@/features/assessments/practice-queries";
import { CourseFrame, courseRoutes } from "@/features/courses/components/course-frame";
import { topicByCode, topicsFor } from "@/features/courses/lib/curriculum";
import { loadTutorCourse } from "@/features/courses/tutor-course";
import { schoolDateFormat } from "@/lib/datetime";

export const metadata = { title: "Practice set" };

const dateFmt = schoolDateFormat({ day: "numeric", month: "short", year: "numeric" });

export default async function PracticeSetPage({ params }: { params: Promise<{ id: string; setId: string }> }) {
  const { id, setId } = await params;
  const loaded = await loadTutorCourse(id);
  if (!loaded.ok) {
    return <PageMessage breadcrumb={[{ label: "Courses", href: courseRoutes.list }, { label: "Practice" }]}>{loaded.message}</PageMessage>;
  }
  const { course } = loaded;
  if (!(await hasPractice(course.id))) notFound();
  const set = await getPracticeSet(setId, course.id);
  if (!set) notFound();

  const students = [...course.students].sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email));
  const standing = await practiceByStudent(
    set.id,
    set.items,
    students.map((s) => s.id),
    new Date(),
  );
  const practised = [...standing.values()].filter((s) => s.answered > 0).length;

  return (
    <CourseFrame
      course={course}
      page={set.title}
      parent={{ label: "Practice", href: courseRoutes.practice(course.id) }}
      current={courseRoutes.practice(course.id)}
      actions={<DeletePracticeSetButton set={{ id: set.id, title: set.title }} courseId={course.id} />}
    >
      <PageTitle
        title={set.title}
        properties={<StatusChip tone={set.isPublished ? "success" : "neutral"}>{set.isPublished ? "Published" : "Draft"}</StatusChip>}
      />
      <PracticeSetDetails
        key={set.updatedAt.toISOString()}
        set={{ id: set.id, title: set.title, description: set.description, isPublished: set.isPublished }}
        questions={set.items.length}
      />

      <PageSection id="questions" title="Questions" description="New questions reach students in this order.">
        <PracticeItems
          setId={set.id}
          courseId={course.id}
          topics={topicsFor(course)}
          items={set.items.map((i) => ({
            id: i.id,
            stem: i.stem,
            type: readBankNode(i.data)?.type ?? "NONE",
            topics: i.topics.map((t) => topicByCode(t)?.title).filter((t): t is string => Boolean(t)),
            bankQuestionId: i.bankQuestionId,
          }))}
        />
      </PageSection>

      <PageSection
        id="students"
        title="Students"
        description={
          students.length === 0
            ? "No students are enrolled yet."
            : `${practised} of ${students.length} ${students.length === 1 ? "student has" : "students have"} practised this set.`
        }
      >
        {students.length ? (
          <div className="relative border-border overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Student
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Practised
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Known
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Answers right
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Last practised
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {students.map((s) => {
                  const r = standing.get(s.id);
                  return (
                    <tr key={s.id}>
                      <th scope="row" className="text-foreground px-3 py-2 text-left font-medium">
                        {s.fullName || s.email}
                      </th>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r?.answered ?? 0}/{set.items.length}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r?.known ?? 0}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r && r.accuracy !== null ? `${Math.round(r.accuracy * 100)}%` : "-"}
                      </td>
                      <td className="text-muted-foreground px-3 py-2">{r?.lastAt ? dateFmt.format(r.lastAt) : "Not yet"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </PageSection>
    </CourseFrame>
  );
}
