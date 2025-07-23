import { Calendar, FileText, Send } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import CourseCard from "../components/course-card";
import { assessments, courses, submissions } from "@/lib/static";
import { useRouter } from "next/navigation";

export default function StudentDashboard() {
  const events: CourseEvent[] = courses.flatMap(course => course.courseEvents || []);
  const continueCourses: Course[] = []; // Placeholder for logic

  return (
    <div className="h-full px-6 pt-6 pb-10 space-y-12 bg-gray-50 overflow-y-auto">
      {/* Banner */}
      <div className="h-48 rounded-xl bg-white border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="p-6">
          <h1 className="text-2xl font-semibold text-gray-800 mb-1">Welcome back 👋</h1>
          <p className="text-sm text-gray-600">Here’s a snapshot of your current learning journey.</p>
        </div>
        <div className="relative w-64 h-24 md:h-full">
          <Image
            src="/images/Learning illustration.jpg"
            alt="Learning illustration"
            className="object-cover"
            fill
          />
        </div>
      </div>

      {/* Continue Working */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Continue Working</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {continueCourses.length > 0 ? (
            continueCourses.map(course => (
              <CourseCard key={course.courseId} course={course} />
            ))
          ) : (
            <div className="text-sm text-gray-500">No active lessons yet.</div>
          )}
        </div>
      </section>

      {/* Enrolled Courses */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Enrolled Courses</h2>
        {continueCourses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {continueCourses.map(course => (
              <CourseCard key={course.courseId} course={course} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center bg-white p-10 rounded-xl border border-dashed border-gray-300 shadow-sm">
            <div className="relative w-48 h-48 mb-6">
              <Image
                src="/images/Online-Learning.jpg"
                alt="No courses"
                className="object-cover"
                fill
              />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              You’re not enrolled in any courses yet
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Head over to the course catalogue to start learning something new.
            </p>
            <Link
              href="/dashboard/browse-courses"
              className="inline-block px-5 py-2 rounded bg-blue-500 text-white text-sm font-medium hover:bg-blue-400 transition"
            >
              Browse Courses
            </Link>
          </div>
        )}
      </section>

      {/* Events, Assessments, Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CourseEventSection events={events} />
        <CourseAssessmentSection assessments={assessments} />
        <CourseSubmissionSection submissions={submissions} />
      </div>
    </div>
  );
}

function CourseEventSection({ events }: { events: CourseEvent[] }) {
  const router = useRouter();
  return (
    <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="text-md font-semibold text-blue-600 mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-blue-500" />
        Upcoming Meetings
      </h2>
      <div className="space-y-3">
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">No meetings scheduled.</p>
        ) : (
          events.slice(0, 3).map(event => (
            <div
              key={event.id}
              onClick={() => router.push(event.link)}
              className="cursor-pointer bg-gray-50 p-3 rounded hover:bg-blue-50 transition"
            >
              <p className="text-sm font-medium text-gray-800">{event.title}</p>
              <p className="text-xs text-gray-500">{new Date(event.date).toUTCString()}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CourseAssessmentSection({ assessments }: { assessments: Assessment[] }) {
  return (
    <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="text-md font-semibold text-indigo-600 mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-indigo-600" />
        Upcoming Assessments
      </h2>
      <div className="space-y-3">
        {assessments.length === 0 ? (
          <p className="text-sm text-gray-500">No upcoming assessments.</p>
        ) : (
          assessments.map(a => (
            <div key={a.id} className="bg-gray-50 p-3 rounded hover:bg-indigo-50 transition">
              <p className="text-sm font-medium text-gray-800">
                {courses.find(course => course.courseId === a.courseId)?.courseName || 'Unknown'} - {a.title}
              </p>
              <p className="text-xs text-gray-500">Due: {a.dueDate}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CourseSubmissionSection({ submissions }: { submissions: Submission[] }) {
  return (
    <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="text-md font-semibold text-emerald-600 mb-4 flex items-center gap-2">
        <Send className="w-5 h-5 text-emerald-600" />
        Upcoming Submissions
      </h2>
      <div className="space-y-3">
        {submissions.length === 0 ? (
          <p className="text-sm text-gray-500">No upcoming submissions.</p>
        ) : (
          submissions.map(s => (
            <div key={s.id} className="bg-gray-50 p-3 rounded hover:bg-emerald-50 transition">
              <p className="text-sm font-medium text-gray-800">{s.title}</p>
              <p className="text-xs text-gray-500">Due: {s.dueDate}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}