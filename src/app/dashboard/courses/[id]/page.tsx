"use client";

import React, { use, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Calendar, FileText, Play, Award, Target } from 'lucide-react';
import { $Enums } from '@/generated/prisma';
import Overview from './models/overview';
import Lessons from './models/lessons';
import Submissions from './models/submissions';
import Assessments from './models/assessments';
import Grades from './models/grades';
import Schedule from './models/schedule';
import { useRouter } from 'next/navigation';
import { useLesson } from '@/context/LessonContext';
import { useSubmission } from '@/context/SubmissionContext';
import { useSubmissionEntries } from '@/context/SubmissionEntryContext';
import { useTests } from '@/context/TestContext';
import { useTestSubmissions } from '@/context/TestSubmissionContext';
import { useLessonCompletions } from '@/context/LessonCompletionContext';
import { useCourses } from '@/context/CourseContext';
import Skeleton from '../../components/skeleton';
import { useProfile } from '@/context/ProfileContext';
import Image from 'next/image';
import { useNotifications } from '@/context/NotificationsContext';
import { useActivityLog } from '@/context/ActivityLogContext';
import { JsonObject } from '@prisma/client/runtime/library';

type ActiveTabValues = 'overview' | 'lessons' | 'submissions' | 'tests' | 'grades' | 'schedule';

type TabButtonProps = {
  id: ActiveTabValues;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  count?: number;
  loading: boolean;
};

type StudentCourseProps = {
  params: Promise<{ id: string }>;
}

export default function StudentCourse({ params }: StudentCourseProps) {
  // contexts
  const { id: courseId } = use(params);
  const { profile } = useProfile();
  const { loading: courseLoading, fetchCoursesByIds } = useCourses();
  const { loading: lessonLoading, fetchLessonsByCourseId } = useLesson();
  const { loading: completionsLoading, fetchCompletionByStudentAndLesson } = useLessonCompletions();
  const { loading: submissionLoading, fetchSubmissionsByStudentIdCourseId } = useSubmission();
  const { loading: entriesLoading, fetchEntriesByStudentId } = useSubmissionEntries();
  const { loading: testsLoading, fetchTestsByStudentIdCourseId } = useTests();
  const { loading: testSubsLoading, fetchSubmissionByStudentTestId } = useTestSubmissions();
  const { notifications } = useNotifications();
  const { activities } = useActivityLog();
  const router = useRouter();

  // states
  const [course, setCourse] = useState<AppTypes.Course | null>(null);
  const [lessons, setLessons] = useState<AppTypes.Lesson[]>([]);
  const [completions, setCompletions] = useState<AppTypes.LessonCompletion[]>([]);
  const [submissions, setSubmissions] = useState<AppTypes.Submission[]>([]);
  const [entries, setEntries] = useState<AppTypes.SubmissionEntry[]>([]);
  const [grades, setGrades] = useState<AppTypes.Grade[]>([]);
  const [tests, setTests] = useState<AppTypes.Test[]>([]);
  const [testSubmissions, setTestSubmissions] = useState<AppTypes.TestSubmission[]>([]);

  const [activeTab, setActiveTab] = useState<ActiveTabValues>('overview');
  const [progressPercentage, setProgressPercentage] = useState<number>(0);

  // Calculate overall grade
  const calculateOverallGrade = useCallback(() => {
    if (grades.length === 0) return 0;

    const totalScore = grades.reduce((sum, grade) => sum + (grade.score || 0), 0);
    const totalOutOf = grades.reduce((sum, grade) => sum + (grade.outOf || 0), 0);

    return totalOutOf > 0 ? Math.round((totalScore / totalOutOf) * 100) : 0;
  }, [grades]);

  // Filter course-specific notifications and activities
  const courseNotifications = useMemo(() => {
    return notifications.filter(notification => notification.courseId === courseId);
  }, [notifications, courseId]);

  const courseActivities = useMemo(() => {
    return activities.filter(activity =>
      (activity.meta as JsonObject)?.courseId === courseId ||
      activity.action.includes('COURSE') ||
      (activity.meta && Object.values(activity.meta).includes(courseId))
    ).slice(0, 5); // Show only recent 5 activities
  }, [activities, courseId]);

  // fetches
  useEffect(() => {
    async function loadData() {
      if (!profile?.id || !courseId) return;

      try {
        const studentId = profile.id;

        // Course
        const fetchedCourses = await fetchCoursesByIds([courseId]) as AppTypes.Course[];
        const fetchedLessons = await fetchLessonsByCourseId(courseId) as AppTypes.Lesson[];

        setCourse(fetchedCourses[0]);
        setLessons(fetchedLessons);

        // Lesson Completions (load per lesson for this student)
        if (fetchedLessons?.length) {
          const fetchedCompletions = await Promise.all(
            fetchedLessons.map((lesson) =>
              fetchCompletionByStudentAndLesson(studentId, lesson.id)
            )
          );

          const filteredCompletions = fetchedCompletions.filter(Boolean) as AppTypes.LessonCompletion[]

          setCompletions(filteredCompletions);

          setProgressPercentage(fetchedLessons.length !== 0
            ? (filteredCompletions.length / fetchedLessons.length) * 100
            : 0
          );
        }

        // Submissions + entries
        const fetchedSubs = await fetchSubmissionsByStudentIdCourseId(studentId, courseId) as AppTypes.Submission[];
        const fetchedEntries = await fetchEntriesByStudentId(studentId) as AppTypes.SubmissionEntry[];

        setSubmissions(fetchedSubs);
        setEntries(fetchedEntries);

        // Tests
        const fetchedTests = await fetchTestsByStudentIdCourseId(studentId, courseId) as AppTypes.Test[];
        if (fetchedTests?.length) {
          const fetchedTestSubs = await Promise.all(
            fetchedTests.map((test) =>
              fetchSubmissionByStudentTestId(studentId, test.id)
            )
          );

          const filteredTestSubs = fetchedTestSubs.filter(Boolean) as AppTypes.TestSubmission[];
          setTestSubmissions(filteredTestSubs);
        }
        setTests(fetchedTests);

        // Grades
        const entryGrades = entries
          .map(entry => entry.grade)
          .filter((g): g is NonNullable<typeof g> => g !== null);

        const testGrades = testSubmissions
          .map(sub => sub.grade)
          .filter((g): g is NonNullable<typeof g> => g !== null);

        setGrades([...entryGrades, ...testGrades]);

      } catch (err) {
        console.error("Failed to load course data", err);
      }
    }

    loadData();
  }, [
    profile?.id,
    courseId,
    progressPercentage,
    fetchCoursesByIds,
    fetchLessonsByCourseId,
    fetchCompletionByStudentAndLesson,
    fetchSubmissionsByStudentIdCourseId,
    fetchEntriesByStudentId,
    fetchTestsByStudentIdCourseId,
    fetchSubmissionByStudentTestId,
  ]);

  if (!profile || !course || courseLoading) return <StudentCourseSkeleton />;

  const getStatusColor = (status: $Enums.SubmissionStatus | string) => {
    switch (status) {
      case 'SUBMITTED':
      case 'GRADED':
        return 'text-green-600 bg-green-50';
      case 'NOT_STARTED':
      case 'IN_PROGRESS':
        return 'text-blue-600 bg-blue-50';
      case 'LATE':
      case 'NOT_SUBMITTED':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const TabButton = ({ id, label, icon: Icon, count = 0, loading }: TabButtonProps) => (
    <button
      disabled={loading}
      onClick={() => setActiveTab(id)}
      className={`flex items-center px-4 py-2 text-sm font-medium  transition-colors ${activeTab === id
        ? 'border-b-4 border-b-blue-600 text-blue-600 font-medium'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
    >
      <Icon className="h-4 w-4 mr-2" />
      {label}
      {count > 0 && !loading && (
        <span className={`w-6 h-6 ml-2 px-2 py-0.5 flex items-center justify-center rounded-full tracking-tighter text-xs ${activeTab === id
          ? 'bg-blue-200 text-blue-800'
          : 'bg-gray-200 text-gray-600'
          } ${loading && "animate-pulse"}`}>
          {count < 10 ? count : "9+"}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="max-w-7xl bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Courses
              </button>
              <div className="h-6 border-l border-gray-300"></div>
              <div>
                <h1 className="font-semibold text-gray-900">{course.name}</h1>
                <p className="text-sm text-gray-500">Tutor: {course.tutor.fullName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Course Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">{course.name}</h2>
              <p className="text-blue-100 mb-4 max-w-2xl">{course.description}</p>
              <div className="flex items-center space-x-6">
                <div>
                  <div className="text-sm text-blue-200">Progress</div>
                  {completionsLoading ?
                    <Skeleton className="h-6 w-40 mb-1 rounded !bg-blue-200" />
                    : <div className="text-lg font-semibold">{Math.round(progressPercentage)}%</div>
                  }
                </div>
                <div>
                  <div className="text-sm text-blue-200">Overall Grade</div>
                  {entriesLoading || testSubsLoading ?
                    <Skeleton className="h-6 w-40 mb-1 rounded !bg-blue-200" />
                    : <div className="text-lg font-semibold">{calculateOverallGrade()}%</div>
                  }
                </div>
                <div>
                  <div className="text-sm text-blue-200">Lessons Completed</div>
                  {completionsLoading ?
                    <Skeleton className="h-6 w-40 mb-1 rounded !bg-blue-200" />
                    : <div className="text-lg font-semibold">{completions.length} of {lessons.length}</div>
                  }
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="relative w-32 h-32 bg-white/10 border-2 border-white flex items-center justify-center">
                <Image
                  src={`/images/${course.imageUrl}`}
                  alt="Course Image"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="bg-blue-700/30 border-white/20 border rounded-full h-2">
              <div
                className="from-0% via-50% to-100% bg-gradient-to-r from-green-400 to-blue-400 rounded-full h-2 transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex pt-4 overflow-x-auto">
            <TabButton
              id="overview"
              label="Overview"
              icon={BookOpen}
              loading={!course || !profile || courseLoading || submissionLoading}
            />
            <TabButton
              id="lessons"
              label="Lessons"
              icon={Play}
              count={lessons.length}
              loading={lessonLoading || completionsLoading}
            />
            <TabButton
              id="submissions"
              label="Submissions"
              icon={FileText}
              count={submissions.length}
              loading={submissionLoading || entriesLoading}
            />
            <TabButton
              id="tests"
              label="Tests & Quizzes"
              icon={Target}
              count={tests.length}
              loading={testsLoading || testSubsLoading}
            />
            <TabButton
              id="grades"
              label="Grades"
              icon={Award}
              count={grades.length}
              loading={entriesLoading || testSubsLoading}
            />
            <TabButton
              id="schedule"
              label="Schedule"
              icon={Calendar}
              count={0}
              loading={false}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <Overview
            submissions={submissions}
            tests={tests}
            testsLoading={testsLoading}
            submissionsLoading={submissionLoading}
            testSubmissions={testSubmissions}
            entries={entries}
            progressPercentage={progressPercentage}
            notifications={courseNotifications}
            activities={courseActivities}
            calculateOverallGrade={calculateOverallGrade}
          />
        )}

        {/* Lessons Tab */}
        {activeTab === 'lessons' && (
          <Lessons
            lessons={lessons}
            lessonCompletions={completions}
            studentId={profile.id}
            loading={lessonLoading || completionsLoading}
          />
        )}

        {/* Submissions Tab */}
        {activeTab === 'submissions' && (
          <Submissions
            submissions={submissions}
            entries={entries}
            loading={entriesLoading || submissionLoading}
            getStatusColor={getStatusColor}
          />
        )}

        {/* Tests Tab */}
        {activeTab === 'tests' && (
          <Assessments
            tests={tests}
            testSubs={testSubmissions}
            loading={testsLoading || testSubsLoading}
            getStatusColor={getStatusColor}
          />
        )}

        {/* Grades Tab */}
        {activeTab === 'grades' && (
          <Grades
            grades={grades}
            loading={entriesLoading || testSubsLoading}
          />
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <Schedule events={[]} />
        )}
      </div>
    </div>
  );
}

function StudentCourseSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="max-w-7xl bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-5 w-20 rounded" />
              <div className="h-6 border-l border-gray-300"></div>
              <div>
                <Skeleton className="h-6 w-40 mb-1 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Skeleton className="h-8 w-64 mb-2 rounded" />
              <Skeleton className="h-4 w-96 mb-4 rounded" />
              <div className="flex items-center space-x-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i}>
                    <Skeleton className="h-3 w-16 mb-1 rounded" />
                    <Skeleton className="h-5 w-12 rounded" />
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden md:block">
              <Skeleton className="h-32 w-32 rounded-lg" />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex pt-4 space-x-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-28 !rounded-none" />
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="mb-6">
            <Skeleton className="h-5 w-1/3 mb-2 rounded" />
            <Skeleton className="h-24 w-full rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}