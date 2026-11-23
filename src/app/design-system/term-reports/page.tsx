/**
 * /design-system/term-reports — term report screens with sample data and no
 * session, so a comment typed here shows "couldn't be saved". Same gate as
 * /design-system.
 */

import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { DeleteTermButton, ReleaseTermButton, TermDialogButton } from "@/features/grades/components/term-reports/term-controls";
import {
  CourseComments, DownloadReport, FamilyReports, StudentReportBody, TermCourses, TermList, TermStatus, TermStudents,
} from "@/features/grades/components/term-reports/views";
import type { LearnerReport, ReportCourse } from "@/features/grades/term-reports";
import { canPreviewDesignSystem } from "@/lib/ui-flags";

export const metadata = { title: "Term reports · Design system", robots: { index: false } };

const TERM = { id: "t4", title: "Term 4 2026", startsOn: "2026-10-06", endsOn: "2026-12-09" };

const MATHS: ReportCourse = {
  courseId: "maths",
  name: "Mathematics Grade 10",
  tutorName: "Ayanda Zulu",
  gradeLevel: 10,
  percent: 72.5,
  symbol: "Level 6",
  items: [
    { id: "a", kind: "test", title: "Algebra test", score: 38, outOf: 50 },
    { id: "b", kind: "assignment", title: "Functions and graphs: sketching, interpreting and finding equations", score: 17.5, outOf: 25 },
    { id: "c", kind: "test", title: "Trigonometry quiz", score: null, outOf: 20 },
  ],
  attendance: { present: 18, late: 2, absent: 1, excused: 0 },
  comment: { text: "Thandi works steadily and asks good questions.\nPractise factorising before the exam.", by: "Ayanda Zulu" },
};

const SCIENCE: ReportCourse = {
  courseId: "science", name: "Physical Sciences Grade 10", tutorName: "Bongani Nkosi", gradeLevel: 10, percent: null, symbol: null, items: [], attendance: null, comment: null,
};

const person = (learnerId: string, name: string, courses: ReportCourse[]): LearnerReport => ({ learnerId, userId: learnerId, isMinor: true, name, courses });
const THANDI = person("l1", "Thandi Mokoena", [MATHS, SCIENCE]);
const CLASS = [
  THANDI,
  person("l2", "Nkosinathi Johannes van der Westhuizen-Mokoena", [{ ...MATHS, percent: 41.3, symbol: "Level 3", comment: null, attendance: { present: 9, late: 4, absent: 7, excused: 1 } }]),
  person("l3", "Zanele Mthembu", [{ ...MATHS, percent: null, symbol: null, comment: null, attendance: null }]),
];

export default function TermReportsPreviewPage() {
  if (!canPreviewDesignSystem()) notFound();
  return (
    <div data-ui="revamp" data-shell="focus" className="bg-background text-foreground min-h-screen font-sans">
      <PageFrame type="list" breadcrumb={[{ label: "Design system", href: "/design-system" }, { label: "Term reports" }]} actions={<TermDialogButton />}>
        <PageTitle icon={<FileText />} title="Term reports" description="Marks, attendance and comments for a term, as a PDF for each student." />
        <TermList
          terms={[
            { ...TERM, released: false, phase: "running" },
            { id: "t3", title: "Term 3 2026", startsOn: "2026-07-21", endsOn: "2026-09-23", released: true, phase: "ended" },
            { id: "t1", title: "Term 1 2027", startsOn: "2027-01-13", endsOn: "2027-03-19", released: false, phase: "upcoming" },
          ]}
        />
      </PageFrame>
      <PageFrame
        type="record"
        breadcrumb={[{ label: "Term reports" }, { label: TERM.title }]}
        status={<TermStatus released={false} phase="running" />}
        actions={<ReleaseTermButton termId={TERM.id} released={false} missing={2} />}
      >
        <PageTitle actions={<TermDialogButton term={TERM} />} title={TERM.title} description="6 Oct 2026 to 9 Dec 2026. Only staff can see these reports." />
        <PageSection id="comments" title="Comments" description="Open a course to comment on each student.">
          <TermCourses
            termId={TERM.id}
            courses={[
              { id: "maths", name: "Mathematics Grade 10", tutorName: "Ayanda Zulu", students: 3, written: 1 },
              { id: "science", name: "Physical Sciences Grade 10", tutorName: "Bongani Nkosi", students: 1, written: 0 },
            ]}
          />
        </PageSection>
        <PageSection id="students" title="Students" description="Open a student to see and download the report.">
          <TermStudents termId={TERM.id} students={CLASS.map((r) => ({ learnerId: r.learnerId, name: r.name, courses: r.courses.map((c) => c.name) }))} />
        </PageSection>
        <div className="flex flex-wrap gap-2">
          <ReleaseTermButton termId={TERM.id} released missing={0} />
          <DeleteTermButton termId={TERM.id} title={TERM.title} />
        </div>
      </PageFrame>
      <PageFrame type="record" breadcrumb={[{ label: TERM.title }, { label: MATHS.name }]}>
        <PageTitle eyebrow={TERM.title} title={MATHS.name} description="1 of 3 comments written. Comments save as you write." />
        <CourseComments termId={TERM.id} courseId="maths" reports={CLASS} canEdit />
        <PageSection title="Someone who only reads">
          <CourseComments termId={TERM.id} courseId="maths" reports={CLASS.slice(0, 2)} canEdit={false} />
        </PageSection>
      </PageFrame>
      <PageFrame type="record" breadcrumb={[{ label: TERM.title }, { label: THANDI.name }]} actions={<DownloadReport termId={TERM.id} learnerId="l1" />}>
        <PageTitle eyebrow={TERM.title} title={THANDI.name} description="Released marks only. Work that was due and has no mark shows a dash." />
        <StudentReportBody termId={TERM.id} report={THANDI} overall={{ text: "A good term.", by: "Nomvula Dlamini" }} complete canEditOverall />
        <PageSection title="A tutor of one of the courses">
          <StudentReportBody termId={TERM.id} report={{ ...THANDI, courses: [SCIENCE] }} overall={null} complete={false} canEditOverall={false} />
        </PageSection>
      </PageFrame>
      <PageFrame type="record" breadcrumb={[{ label: "What a parent or an adult student sees" }]}>
        <FamilyReports
          reports={[
            { termId: "t3", learnerId: "l1", title: "Term 3 2026", startsOn: "2026-07-21", endsOn: "2026-09-23", workspaceName: "Ubuntu Tutors" },
            { termId: "t2", learnerId: "l1", title: "Term 2 2026", startsOn: "2026-04-08", endsOn: "2026-06-26", workspaceName: "Ubuntu Tutors" },
          ]}
        />
      </PageFrame>
    </div>
  );
}
