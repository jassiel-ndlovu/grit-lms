"use client";

import { Calendar, FileText, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCourses } from "@/context/CourseContext";
import { useTests } from "@/context/TestContext";
import { useProfile } from "@/context/ProfileContext";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import CourseCard from "../components/course-card";
import Link from "next/link";
import DashboardSkeleton from "../components/dashboard-skeleton";
import { formatDate } from "@/lib/functions";
import { useStudent } from "@/context/StudentContext";

export default function StudentDashboard() {
  const { loading: coursesLoading, fetchCoursesByStudentId } = useCourses();
  const { fetchTestsByStudentId, loading: testsLoading } = useTests();
  const { profile, loading: profileLoading } = useProfile();

  const [continueCourses, setContinueCourses] = useState<AppTypes.Course[]>([]);
  const [studentTests, setStudentTests] = useState<AppTypes.Test[]>([]);

  // Derived data
  const studentProfile = profile as AppTypes.Student;

  // Fetch courses for the student
  useEffect(() => {
    const fetchCourses = async () => {
      if (studentProfile?.id) {
        const courses = await fetchCoursesByStudentId(studentProfile.id);
        setContinueCourses(courses || []);
      }
    }

    fetchCourses();
  }, [studentProfile, fetchCoursesByStudentId]);

  // Fetch tests
  useEffect(() => {
    const fetchTests = async () => {
      if (studentProfile?.id) {
        const tests = await fetchTestsByStudentId(studentProfile.id);
        setStudentTests(tests as AppTypes.Test[] || []);
      }
    }

    fetchTests();
  }, [studentProfile?.id, fetchTestsByStudentId, continueCourses]);

  const events = useMemo(() =>
    continueCourses?.flatMap(course => course.courseEvents ?? []) ?? [],
    [continueCourses]
  );

  const studentSubmissions = useMemo(() =>
    studentTests.flatMap(test =>
      test.submissions?.filter(sub => sub.studentId === studentProfile?.id) ?? []
    ) ?? [],
    [studentTests, studentProfile]
  );

  // Loading state
  const isLoading = coursesLoading || testsLoading || profileLoading;
  if (isLoading) {
    return <DashboardSkeleton />;
  }

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

      {/* Events, Assessments, Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CourseEventSection events={events} />
        <CourseAssessmentSection assessments={studentTests} />
        <CourseSubmissionSection
          submissions={studentSubmissions}
        />
      </div>

      {/* Continue Working */}
      {/* <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Continue Working
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {isLoading
            ? [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
            : continueCourses.length > 0
              ? continueCourses.map(course => (
                <CourseCard
                  key={course.id}
                  course={course}
                  lessons={[]}
                />
              ))
              : <div className="text-sm text-gray-500">No active lessons yet.</div>
          }
        </div>
      </section> */}

      {/* Enrolled Courses */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Enrolled Courses
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : continueCourses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {continueCourses.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                lessons={[]}
              />
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
              className="inline-block px-5 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
            >
              Browse Courses
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="h-32 bg-white border border-gray-200 rounded-xl shadow-sm p-4 animate-pulse">
      <div className="h-4 w-2/3 bg-gray-200 rounded mb-2"></div>
      <div className="h-3 w-1/2 bg-gray-200 rounded"></div>
    </div>
  );
}

function CourseEventSection({ events, loading = false }: { events: AppTypes.CourseEvent[]; loading?: boolean }) {
  const router = useRouter();
  return (
    <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="text-md font-semibold text-blue-600 mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-blue-500" />
        Upcoming Meetings
      </h2>
      <div className="space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
        ) : events.length === 0 ? (
          <p className="text-sm text-gray-500">No meetings scheduled.</p>
        ) : (
          events.slice(0, 3).map(event => (
            <div
              key={event.id}
              onClick={() => router.push(event.link)}
              className="cursor-pointer bg-gray-50 p-3 rounded hover:bg-blue-50 transition"
            >
              <p className="text-sm font-medium text-gray-800">{event.title}</p>
              <p className="text-xs text-gray-500">{formatDate(new Date(event.date))}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CourseAssessmentSection({ assessments, loading = false }: { assessments: AppTypes.Test[] | null; loading?: boolean }) {

  return (
    <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="text-md font-semibold text-indigo-600 mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-indigo-600" />
        Upcoming Assessments
      </h2>
      <div className="space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
        ) : assessments?.length === 0 ? (
          <p className="text-sm text-gray-500">No upcoming assessments.</p>
        ) : (
          assessments?.map(a => (
            <div key={a.id} className="bg-gray-50 p-3 rounded hover:bg-indigo-50 transition">
              <p className="text-sm font-medium text-gray-800">{a.title}</p>
              <p className="text-xs text-gray-500">Due: {formatDate(a.dueDate)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CourseSubmissionSection({ submissions, loading = false }: { submissions: AppTypes.TestSubmission[] | null; loading?: boolean }) {
  const { fetchStudentsById } = useStudent();

  const [studentRecords, setStudentRecords] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetch = async () => {
      if (submissions && submissions.length > 0) {
        const students = await fetchStudentsById(
          Array.from(new Set(submissions.map(s => s.studentId)))
        );
        setStudentRecords(prev => {
          const newRecords: Record<string, string> = {};
          students.forEach(s => {
            newRecords[s.id] = s.fullName;
          });
          return { ...prev, ...newRecords };
        });
      }
    }

    fetch();
  }, [submissions, fetchStudentsById]);

  return (
    <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
      <h2 className="text-md font-semibold text-emerald-600 mb-4 flex items-center gap-2">
        <Send className="w-5 h-5 text-emerald-600" />
        Upcoming Submissions
      </h2>
      <div className="space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
        ) : submissions?.length === 0 ? (
          <p className="text-sm text-gray-500">No upcoming submissions.</p>
        ) : (
          submissions?.map(s => (
            <div key={s.id} className="bg-gray-50 p-3 rounded hover:bg-emerald-50 transition">
              <p className="text-sm font-medium text-gray-800">{studentRecords[s.studentId]}</p>
              <p className="text-xs text-gray-500">Due: {s.status}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
