'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCourses } from '@/context/CourseContext';
import { Pencil, Users, FileText, Layers, FilePlus2, BookOpenText } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import StudentManagerDialog from './student-manager-dialog';
import { useStudent } from '@/context/StudentContext';
import CourseContentNotFound from '../models/content-not-found';

export default function EditCoursePage() {
  const { id } = useParams();
  const { updating: courseUpdateLoading, loading: courseLoading, message, courses, updateCourse } = useCourses();
  const { students } = useStudent();

  const [course, setCourse] = useState<AppTypes.Course | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [studentDialogOpen, setStudentDialogOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!courseLoading && courses.length > 0 && id && typeof id === 'string') {
      const found = courses.find(c => c.id === id);
      setCourse(found || null);
      setLoading(false);
    } else if (!courseLoading && courses.length === 0) {
      setLoading(false);
    }
  }, [id, courses, courseLoading]);

  if ((loading || courses.length === 0 || course === undefined) && !courseUpdateLoading) {
    return <CourseSkeleton />;
  }

  if (!course) {
    return (
      <CourseContentNotFound />
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          {course.imageUrl ? (
            <Image
              src={`/images/${course.imageUrl}`}
              alt="Course Cover"
              width={100}
              height={100}
              className="rounded object-cover border border-gray-200"
            />
          ) : (
            <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-inner">
              <Layers className="w-10 h-10 text-gray-400" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{course.name}</h1>
            <p className="text-sm text-gray-600 mt-1 max-w-md">{course.description}</p>
          </div>
        </div>
        <button
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm hover:bg-blue-700 transition"
        >
          <Pencil className="w-4 h-4" />
          Edit Course Info
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <OverviewCard icon={Users} title="Students" value={course.students.length} color="from-green-100 to-green-50" />
        <OverviewCard icon={BookOpenText} title="Lessons" value={course.lessons.length} color="from-indigo-100 to-indigo-50" />
        <OverviewCard icon={FileText} title="Assessments" value={course.quizzes.length + course.tests.length} color="from-yellow-100 to-yellow-50" />
        <OverviewCard icon={FilePlus2} title="Submissions" value={course.submissions.length} color="from-purple-100 to-purple-50" />
      </div>

      {/* Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Manage Course Content</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <ActionCard
            title="Manage Lessons"
            icon={BookOpenText}
            href={`/dashboard/manage-courses/lessons/${id}`}
            description="Add, update, or track progress of course lessons"
          />
          <ActionCard
            title="Manage Students"
            icon={Users}
            onClick={() => setStudentDialogOpen(true)}
            description="View and manage enrolled students"
          />

          {/* Student Manager Dialog */}
          {studentDialogOpen && (
            <StudentManagerDialog
              allStudents={students}
              enrolled={course.students}
              courseLoading={courseLoading}
              message={message?.content}
              onClose={() => setStudentDialogOpen(false)}
              onSave={async (selected) => {
                await updateCourse(course.id, {
                  students: selected,
                });
              }}
            />
          )}

          {/* Action Cards resumed */}
          <ActionCard
            title="Manage Assessments"
            icon={FileText}
            href={`/dashboard/tutor-tests/${id}`}
            description="Create and monitor quizzes or tests"
          />
        </div>
      </div>

      {/* Course Overview Section */}
      <div className="space-y-6 p-8 rounded bg-gray-100">
        <h2 className="text-lg font-semibold text-gray-800">
          Course Activity & Overview
        </h2>

        {/* Enrolled Students */}
        <div>
          <h3 className="text-base font-medium text-gray-700 mb-2">
            Enrolled Students ({course.students.length})
          </h3>
          {course.students.length ? (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {course.students.map((student) => (
                <li key={student.id} className="flex items-center gap-3 bg-white border p-3 rounded-md shadow-sm">
                  <div className="w-10 h-10 bg-orange-100 text-orange-600 flex items-center justify-center rounded-full font-bold">
                    {student.fullName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{student.fullName}</p>
                    <p className="text-xs text-gray-500">{student.email}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No students enrolled yet.</p>
          )}
        </div>

        {/* Upcoming Events */}
        <div>
          <h3 className="text-base font-medium text-gray-700 mb-2">Upcoming Events</h3>
          {course.courseEvents.length ? (
            <ul className="divide-y divide-gray-200 rounded-md border bg-white shadow-sm">
              {course.courseEvents
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(0, 5)
                .map((event) => (
                  <li key={event.id} className="p-4">
                    <p className="font-medium text-gray-800">{event.title}</p>
                    <p className="text-sm text-gray-500">{new Date(event.date).toLocaleString()}</p>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No upcoming events.</p>
          )}
        </div>

        {/* Active Assessments */}
        <div>
          <h3 className="text-base font-medium text-gray-700 mb-2">Active Assessments</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Active Quizzes */}
            <div className="bg-white border border-gray-300 rounded-md p-4 shadow-sm">
              <p className="font-semibold text-blue-700">Quizzes</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{course.quizzes.length}</p>
              <p className="text-sm text-gray-500">Total active quizzes</p>
            </div>

            {/* Active Tests */}
            <div className="bg-white border  border-gray-300 rounded-md p-4 shadow-sm">
              <p className="font-semibold text-yellow-700">Tests</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{course.tests.length}</p>
              <p className="text-sm text-gray-500">Total active tests</p>
            </div>

            {/* Active Submissions */}
            <div className="bg-white border border-gray-300 rounded-md p-4 shadow-sm">
              <p className="font-semibold text-purple-700">Submission Portals</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{course.submissions.length}</p>
              <p className="text-sm text-gray-500">Open submission portals</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewCard({ title, value, icon: Icon, color }: { title: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className={`p-5 rounded bg-gradient-to-br ${color} flex items-center gap-4`}>
      <div className="bg-white rounded-full p-2 shadow-sm">
        <Icon className="w-6 h-6 text-gray-700" />
      </div>
      <div>
        <p className="text-sm text-gray-600 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

type ActionCardProps = {
  title: string;
  description: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
}

function ActionCard({ title, description, icon: Icon, href, onClick }: ActionCardProps) {
  const className = "group bg-white border border-gray-200 rounded-xl p-6 shadow hover:shadow-lg transition-all cursor-pointer h-full flex flex-col justify-between";

  const content = (
    <>
      <div className="flex items-center gap-3 mb-3">
        <div className="bg-blue-100 p-2 rounded-full">
          <Icon className="w-5 h-5 text-blue-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>
      <p className="text-sm text-gray-600 group-hover:text-gray-800">{description}</p>
    </>
  );

  return href ? (
    <Link href={href} className={className}>{content}</Link>
  ) : (
    <button onClick={onClick} className={className}>{content}</button>
  );
}
function CourseSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10 animate-pulse">
      <div className="flex items-center gap-6">
        <div className="w-24 h-24 bg-gray-200 rounded-xl" />
        <div className="space-y-2">
          <div className="h-6 w-64 bg-gray-200 rounded" />
          <div className="h-4 w-80 bg-gray-100 rounded" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl" />
        ))}
      </div>

      <div>
        <div className="h-5 w-48 bg-gray-200 rounded mb-4" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
