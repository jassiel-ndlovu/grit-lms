'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { CalendarDays, Clock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTests } from '@/context/TestContext';
import { useCourses } from '@/context/CourseContext';
import { useProfile } from '@/context/ProfileContext';
import Skeleton from '../components/skeleton';
import { formatTime } from '@/lib/functions';

export default function TestsPage() {  
  const { fetchTestsByCourse, loading: testsLoading } = useTests();
  const { fetchCoursesByStudentId, loading: coursesLoading } = useCourses();
  const { profile, loading: profileLoading } = useProfile();

  const [studentCourses, setStudentCourses] = useState<AppTypes.Course[]>([]);
  const [studentTests, setStudentTests] = useState<AppTypes.Test[]>([]);

  // Memoize student profile once
  const studentProfile = useMemo(() => profile as AppTypes.Student, [profile]);

  // Fetch student courses
  useEffect(() => {
    if (studentProfile?.id) {
      // Fetch courses for the student
      const fetchCourses = async () => {
        const fetchedCourses = await fetchCoursesByStudentId(studentProfile.id);
        setStudentCourses(fetchedCourses || []);
      }

      fetchCourses();
    }
  }, [studentProfile?.id, fetchCoursesByStudentId]);

  // Fetch tests ONLY when necessary
  useEffect(() => {
    if (studentProfile?.id) {
      const fetchTests = async () => {
        if (coursesLoading) return; 

        const courseIds = studentCourses.map(course => course.id);
        const fetchedTests = await fetchTestsByCourse(courseIds);
        setStudentTests(fetchedTests || []);
      }

      fetchTests();
    }
  }, [studentProfile?.id, fetchTestsByCourse, coursesLoading]);

  // Group by course
  const groupedByCourse = useMemo(() => {
    return studentCourses
      .map(course => ({
        ...course,
        tests: studentTests.filter(t => t.courseId === course.id),
      }))
      .filter(course => course.tests.length > 0);
  }, [studentCourses, studentTests]);

  // Consolidated loading state
  const isLoading = coursesLoading || testsLoading || profileLoading;

  return (
    <div className="h-full w-full px-6 py-10 bg-gray-50 overflow-y-auto">
      <header className="max-w-5xl mx-auto mb-10">
        <h1 className="text-3xl font-bold text-gray-800">Your Active Tests</h1>
        <p className="text-sm text-gray-600 mt-1">
          Browse and access your currently active tests across all courses.
        </p>
      </header>

      <main className="max-w-5xl mx-auto space-y-8">
        {isLoading ? (
          <SkeletonLoader />
        ) : groupedByCourse.length === 0 ? (
          <EmptyState />
        ) : (
          groupedByCourse.map(course => (
            <section
              key={course.id}
              className="bg-white border border-gray-200 rounded-lg p-6"
            >
              <h2 className="text-lg font-semibold text-blue-600 mb-4">
                {course.name}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {course.tests.map(test => (
                  <TestContent 
                    key={test.id} 
                    test={test}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}

function TestContent({ test }: { test: AppTypes.Test }) {
  const { profile } = useProfile();

  const [timeLeft, setTimeLeft] = useState<string>('Calculating...');
  const [isExpired, setIsExpired] = useState(false);

  const router = useRouter();

  useEffect(() => {
    if (!test.timeLimit) return;

    const calculateTimeLeft = () => {
      const studentSub = test.submissions.find(s => s.studentId === profile?.id);

      let startTime = new Date();

      if (studentSub) {
        startTime = new Date(studentSub.startedAt);
      } else {
        // Now
        startTime = new Date(Date.now());
      }

      const endTime = new Date(test.dueDate);
      endTime.setMinutes(endTime.getMinutes() + (test.timeLimit as number));
      const distance = endTime.getTime() - startTime.getTime();

      if (distance < 0) {
        setIsExpired(true);
        setTimeLeft('Time expired');
        return;
      }

      const timeLeft: string = formatTime(Math.floor(distance / 1000));

      setTimeLeft(timeLeft);
    };

    // Calculate immediately
    calculateTimeLeft();

    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000);

    // Cleanup interval on unmount
    return () => clearInterval(timer);
  }, [test.timeLimit, test.createdAt]);

  return (
    <div className="border border-gray-300 rounded-md p-4 bg-gray-50 hover:shadow transition">
      <h3 className="text-md font-semibold text-gray-800 mb-1">
        {test.title}
      </h3>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <CalendarDays className="w-4 h-4" />
        Due: {new Date(test.dueDate).toLocaleString()}
      </div>

      {test.timeLimit && (
        <div className={`flex items-center gap-2 text-sm mb-2 ${
          isExpired ? 'text-red-500' : 'text-gray-500'
        }`}>
          <Clock className="w-4 h-4" />
          Time left: {timeLeft}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
          Active
        </span>

        <button
          onClick={() => router.push(`/dashboard/tests/pre-test/${test.id}`)}
          className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 transition"
          disabled={isExpired}
        >
          {isExpired ? 'Expired' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {[1, 2].map(i => (
        <div
          key={i}
          className="bg-white p-6 rounded-lg border border-gray-200"
        >
          <Skeleton className="w-12 h-12 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2].map(j => (
              <div
                key={j}
                className="border border-gray-300 rounded-md p-4 bg-gray-50"
              >
                <Skeleton className="h-5 w-3/5 mb-2" />
                <Skeleton className="h-3.5 w-2/5 mb-4" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-lg p-12 text-center border border-gray-200">
      <div className="relative mx-auto w-44 h-44 mb-2">
        <Image
          src="/images/No-Result.jpg"
          alt="No results"
          className="object-cover"
          fill
        />
      </div>
      <h2 className="text-xl font-semibold text-gray-700 mb-2">
        No Active Tests
      </h2>
      <p className="text-sm text-gray-500">
        You currently have no tests available. Check back later or contact your tutor.
      </p>
    </div>
  );
}
