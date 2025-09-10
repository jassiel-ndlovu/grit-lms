"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Calendar, FileText, Send, BookOpen, Clock, Trophy, TrendingUp, Users, PlayCircle, ChevronRight, Target, Zap, AlertCircle, PenBox, Award, Bookmark, CheckCircle, BarChart3 } from "lucide-react";
import { formatDate, formatTimeAgo } from "@/lib/functions";
import { useProfile } from "@/context/ProfileContext";
import { useCourses } from "@/context/CourseContext";
import { useTests } from "@/context/TestContext";
import { useTestSubmissions } from "@/context/TestSubmissionContext";
import { useSubmission } from "@/context/SubmissionContext";
import { useLesson } from "@/context/LessonContext";
import { useLessonCompletions } from "@/context/LessonCompletionContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActivityLog } from "@/context/ActivityLogContext";
import { JsonObject } from "@prisma/client/runtime/library";

export default function ModernStudentDashboard() {
  const { profile } = useProfile();
  const { activities } = useActivityLog();
  const { loading: courseLoading, fetchCoursesByStudentId } = useCourses();
  const { loading: testsLoading, fetchTestsByStudentId } = useTests();
  const { loading: testSubsLoading, fetchSubmissionsByStudentId: fetchTestSubmissionsByStudentId } = useTestSubmissions();
  const { loading: submissionLoading, fetchSubmissionsByStudentId } = useSubmission();
  const { loading: lessonsLoading, fetchLessonsByCourseId } = useLesson();
  const { loading: completionsLoading, fetchCompletionsByStudent } = useLessonCompletions();

  const [courses, setCourses] = useState<AppTypes.Course[]>([]);
  const [lessons, setLessons] = useState<AppTypes.Lesson[]>([]);
  const [completions, setCompletions] = useState<AppTypes.LessonCompletion[]>([]);
  const [submissions, setSubmissions] = useState<AppTypes.Submission[]>([]);
  const [tests, setTests] = useState<AppTypes.Test[]>([]);
  const [testSubmissions, setTestSubmissions] = useState<AppTypes.TestSubmission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!profile?.id) return;

        // Load all data in parallel
        const [
          studentCourses,
          studentTests,
          studentTestSubmissions,
          studentSubmissions,
          studentCompletions
        ] = await Promise.all([
          fetchCoursesByStudentId(profile.id),
          fetchTestsByStudentId(profile.id, true),
          fetchTestSubmissionsByStudentId(profile.id),
          fetchSubmissionsByStudentId(profile.id),
          fetchCompletionsByStudent(profile.id)
        ]);

        setCourses(studentCourses || []);
        setTests(studentTests || []);
        setTestSubmissions(studentTestSubmissions || []);
        setSubmissions(studentSubmissions || []);
        setCompletions(studentCompletions || []);

        // Load lessons for each course
        if (studentCourses?.length) {
          const allLessons = await Promise.all(
            studentCourses.map(course => fetchLessonsByCourseId(course.id))
          );
          setLessons(allLessons.flat().filter(Boolean) as AppTypes.Lesson[]);
        }

      } catch (err) {
        console.error('Error loading dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');

      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [
    profile?.id,
    fetchCoursesByStudentId,
    fetchTestsByStudentId,
    fetchTestSubmissionsByStudentId,
    fetchSubmissionsByStudentId,
    fetchLessonsByCourseId,
    fetchCompletionsByStudent
  ]);

  const stats = useMemo(() => {
    const totalCourses = courses.length;
    const completedLessons = completions.length;
    const totalLessons = lessons.length;
    const averageProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // Count upcoming deadlines (within next 7 days)
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingDeadlines = [
      ...tests.filter(test => new Date(test.dueDate) > now && new Date(test.dueDate) <= nextWeek),
      ...submissions.filter(sub => new Date(sub.dueDate) > now && new Date(sub.dueDate) <= nextWeek)
    ].length;

    // Calculate average grade from test submissions
    const gradedTests = testSubmissions.filter(ts => ts.grade !== undefined && ts.grade !== null);
    const averageGrade = gradedTests.length > 0
      ? Math.round(gradedTests.reduce((acc, ts) => acc + (ts.grade?.score || 0), 0) / gradedTests.length)
      : 0;

    return {
      totalCourses,
      completedLessons,
      averageProgress,
      upcomingDeadlines,
      averageGrade
    };
  }, [courses, completions, lessons, tests, submissions, testSubmissions]);

  const loadingStates = courseLoading || testsLoading || testSubsLoading || submissionLoading ||
    lessonsLoading || completionsLoading || loading;

  if (loadingStates) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Oops! Something went wrong</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 p-8 text-white">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between">
            <div className="mb-6 md:mb-0">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <Zap className="w-6 h-6 text-yellow-300" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Welcome back, {(profile as AppTypes.Student)?.fullName}! 👋</h1>
                  <p className="text-blue-100 mt-1">Ready to continue your learning journey?</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 mt-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-yellow-300" />
                  </div>
                  <span className="text-sm text-blue-100">Streak</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <Target className="w-4 h-4 text-green-300" />
                  </div>
                  <span className="text-sm text-blue-100">{stats.averageProgress}% Average Progress</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="w-64 h-40 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20 p-6">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">{stats.completedLessons}</div>
                  <div className="text-sm text-blue-100">Lessons Completed</div>
                  <div className="mt-4 flex justify-center">
                    <div className="w-20 h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-blue-400 rounded-full transition-all duration-500"
                        style={{ width: `${stats.averageProgress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            icon={<BookOpen className="w-6 h-6 text-blue-600" />}
            title="Active Courses"
            value={stats.totalCourses.toString()}
            color="blue"
            trend="Trend"
          />
          <StatCard
            icon={<Clock className="w-6 h-6 text-amber-600" />}
            title="Forums"
            value="0"
            color="amber"
            trend="Coming soon..."
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6 text-green-600" />}
            title="Avg. Progress"
            value={`${stats.averageProgress}%`}
            color="green"
            trend="+5% this week"
          />
          <StatCard
            icon={<Users className="w-6 h-6 text-purple-600" />}
            title="Study Groups"
            value="0"
            color="purple"
            trend="Coming soon..."
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Events & Quick Actions */}
          <div className="space-y-6">
            <UpcomingEvents events={[]} />
            <QuickActions />
          </div>

          {/* Middle Column - Assessments & Submissions */}
          <div className="space-y-6">
            <UpcomingAssessments
              assessments={tests}
              courses={courses}
            />
            <UpcomingSubmissions
              courses={courses}
              submissions={submissions}
            />
          </div>

          {/* Right Column - Progress Overview */}
          <div className="space-y-6">
            <WeeklyProgress progress={stats.averageProgress} />
            <RecentActivity activities={activities} courses={courses} />
          </div>
        </div>

        {/* Enrolled Courses */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2
              id="your-courses"
              className="text-2xl font-bold text-gray-900"
            >
              Your Courses
            </h2>
            <button className="text-blue-600 hover:text-blue-700 flex items-center gap-2 text-sm font-medium transition-colors">
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {courses.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No courses yet</h3>
              <p className="text-gray-600 mb-4">You haven&apos;t enrolled in any courses yet.</p>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Browse Courses
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map(course => {
                const courseLessons = lessons.filter(lesson => lesson.courseId === course.id);
                const courseCompletions = completions.filter(comp =>
                  courseLessons.some(lesson => lesson.id === comp.lessonId)
                );

                return (
                  <ModernCourseCard
                    key={course.id}
                    course={course}
                    lessonsLength={courseLessons.length}
                    completionsLength={courseCompletions.length}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Component Definitions
type StatCardProps = {
  title: string;
  value: string;
  color: "blue" | "amber" | "green" | "purple";
  trend: string;
  icon: React.ReactNode;
}

function StatCard({ icon, title, value, color, trend }: StatCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200",
    amber: "bg-amber-50 border-amber-200",
    green: "bg-green-50 border-green-200",
    purple: "bg-purple-50 border-purple-200"
  };

  return (
    <div className={`${colorClasses[color]} border rounded-2xl p-6 hover:shadow-lg transition-all duration-300 hover:scale-105`}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-white rounded-xl shadow-sm">
          {icon}
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
        <div className="text-sm font-medium text-gray-700 mb-2">{title}</div>
        <div className="text-xs text-gray-500">{trend}</div>
      </div>
    </div>
  );
}

type UpcomingEventsProps = {
  events: AppTypes.CourseEvent[];
}

function UpcomingEvents({ events }: UpcomingEventsProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Calendar className="w-5 h-5 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Upcoming Events</h3>
      </div>

      <div className="space-y-4">
        {events.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 text-sm mx-auto mb-4" />
            <p className="text-gray-500">No upcoming events</p>
          </div>
        ) : (
          events.slice(0, 3).map(event => (
            <div key={event.id} className="group cursor-pointer bg-gray-50 hover:bg-blue-50 p-4 rounded-xl transition-all duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 group-hover:text-blue-700">{event.title}</p>
                  <p className="text-sm text-gray-500 mt-1">{formatDate(event.date)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function QuickActions() {
  const actions = [
    { icon: <BookOpen className="w-5 h-5" />, label: "Browse Courses", color: "blue", url: "/dashboard#your-courses" },
    { icon: <PenBox className="w-5 h-5" />, label: "Tests", color: "purple", url: "/dashboard/tests" },
    { icon: <FileText className="w-5 h-5" />, label: "Submissions", color: "green", url: "/dashboard/submissions" }
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
      <div className="space-y-3">
        {actions.map((action, index) => (
          <Link
            href={action.url}
            key={index}
            className={`w-full flex items-center gap-3 p-3 rounded-xl bg-${action.color}-50 hover:bg-${action.color}-100 text-${action.color}-700 transition-all duration-200 hover:scale-105`}
          >
            {action.icon}
            <span className="font-medium text-sm">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

type UpcomingAssessmentsProps = {
  assessments: AppTypes.Test[];
  courses: AppTypes.Course[];
}

function UpcomingAssessments({ assessments, courses }: UpcomingAssessmentsProps) {
  const upcomingAssessments = assessments.filter(test => new Date(test.dueDate) > new Date())
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 3);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 rounded-xl">
          <FileText className="w-5 h-5 text-indigo-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Upcoming Assessments</h3>
      </div>

      <div className="space-y-4">
        {upcomingAssessments.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-400 text-sm mx-auto mb-4" />
            <p className="text-gray-500">No upcoming assessments</p>
          </div>
        ) : (
          upcomingAssessments.map(assessment => (
            <div key={assessment.id} className="group cursor-pointer border border-gray-200 hover:border-indigo-300 p-4 rounded-xl transition-all duration-200 hover:shadow-md">
              <p className="font-medium text-gray-900 group-hover:text-indigo-700">{assessment.title}</p>
              <p className="text-sm text-gray-500 mt-1">Due: {formatDate(assessment.dueDate)}</p>
              <p className="text-xs text-indigo-600 mt-2">{courses.find(c => c.id === assessment.courseId)?.name || 'Course'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type UpcomingSubmissionsProps = {
  submissions: AppTypes.Submission[];
  courses: AppTypes.Course[];
}

function UpcomingSubmissions({ submissions, courses }: UpcomingSubmissionsProps) {
  const upcomingSubmissions = submissions.filter(sub => new Date(sub.dueDate) > new Date())
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 3);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-emerald-100 rounded-xl">
          <Send className="w-5 h-5 text-emerald-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Upcoming Submissions</h3>
      </div>

      <div className="space-y-4">
        {upcomingSubmissions.length === 0 ? (
          <div className="text-center py-8">
            <Send className="w-12 h-12 text-gray-400 text-sm mx-auto mb-4" />
            <p className="text-gray-500">No upcoming submissions</p>
          </div>
        ) : (
          upcomingSubmissions.map(submission => (
            <div key={submission.id} className="group cursor-pointer border border-gray-200 hover:border-emerald-300 p-4 rounded-xl transition-all duration-200 hover:shadow-md">
              <p className="font-medium text-gray-900 group-hover:text-emerald-700">{submission.title}</p>
              <p className="text-sm text-gray-500 mt-1">Due: {formatDate(submission.dueDate)}</p>
              <p className="text-xs text-emerald-600 mt-2">{courses.find(c => c.id === submission.courseId)?.name || 'Course'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type WeeklyProgressProps = {
  progress: number;
}

function WeeklyProgress({ progress = 0 }: WeeklyProgressProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">This Week</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Weekly Progress</span>
          <span className="text-sm font-medium text-green-600">{progress ?? 0} of 7 days</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full" style={{ width: '0%' }}></div>
        </div>
        <div className="grid grid-cols-7 gap-1 mt-4">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <div key={index} className="text-center">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium ${index < progress ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}>
                {day}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecentActivity({ activities, courses }: { activities: AppTypes.ActivityLog[], courses: AppTypes.Course[] }) {
  const recentActivities = activities
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const getActivityIcon = (action: string) => {
    const actionMap: { [key: string]: React.ReactNode } = {
      'LESSON_COMPLETED': <BookOpen className="w-4 h-4 text-green-500" />,
      'TEST_COMPLETED': <FileText className="w-4 h-4 text-blue-500" />,
      'ASSIGNMENT_SUBMITTED': <Send className="w-4 h-4 text-purple-500" />,
      'GRADE_RECEIVED': <Award className="w-4 h-4 text-yellow-500" />,
      'COURSE_ENROLLED': <Bookmark className="w-4 h-4 text-indigo-500" />,
      'LOGIN': <CheckCircle className="w-4 h-4 text-green-500" />,
      'LOGOUT': <Clock className="w-4 h-4 text-gray-500" />,
      'DASHBOARD_LOAD_ERROR': <AlertCircle className="w-4 h-4 text-red-500" />,
      'default': <BarChart3 className="w-4 h-4 text-gray-500" />
    };

    return actionMap[action] || actionMap.default;
  };

  const getActivityDescription = (activity: AppTypes.ActivityLog) => {
    const courseName = (activity.meta as JsonObject)?.courseId
      ? courses.find(c => c.id === (activity.meta as JsonObject).courseId)?.name
      : 'a course';

    const actionMap: { [key: string]: string } = {
      'LESSON_COMPLETED': `Completed lesson in ${courseName}`,
      'TEST_COMPLETED': `Completed test in ${courseName}`,
      'ASSIGNMENT_SUBMITTED': `Submitted assignment in ${courseName}`,
      'GRADE_RECEIVED': `Received grade in ${courseName}`,
      'COURSE_ENROLLED': `Enrolled in ${courseName}`,
      'LOGIN': 'Logged into the platform',
      'LOGOUT': 'Logged out of the platform',
      'DASHBOARD_LOAD_ERROR': 'Experienced a loading error',
      'default': 'Performed an action'
    };

    return actionMap[activity.action] || actionMap.default;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Activity</h3>
      <div className="space-y-4">
        {recentActivities.length === 0 ? (
          <div className="text-center py-8">
            <PlayCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No recent activity</p>
          </div>
        ) : (
          recentActivities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="p-2 bg-gray-50 rounded-lg">
                {getActivityIcon(activity.action)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {getActivityDescription(activity)}
                </p>
                {(activity.meta as JsonObject)?.lessonTitle && (
                  <p className="text-sm text-gray-600">{(activity.meta as JsonObject).lessonTitle as string || "Unknown"}</p>
                )}
                {(activity.meta as JsonObject)?.score && (
                  <p className="text-sm text-gray-600">Score: {(activity.meta as JsonObject).score as number || 0}%</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {formatTimeAgo(activity.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type ModernCourseCardProps = {
  course: AppTypes.Course;
  completionsLength: number;
  lessonsLength: number;
}

function ModernCourseCard({ course, lessonsLength, completionsLength }: ModernCourseCardProps) {
  const router = useRouter();

  const progress = lessonsLength > 0 ? Math.round(completionsLength / lessonsLength * 100) : 0;

  return (
    <div
      onClick={() => router.push(`/dashboard/courses/${course.id}`)}
      className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-105"
    >
      <div className="relative h-48 bg-gradient-to-br from-blue-400 to-purple-500 overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute top-4 left-4">
          <div className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-gray-700">
            {course.tutor.fullName}
          </div>
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center justify-between text-white">
            <div className="text-sm font-medium">
              {completionsLength} of {lessonsLength} lessons
            </div>
            <div className="text-sm font-medium">
              {progress}%
            </div>
          </div>
          <div className="mt-2 w-full bg-white/20 rounded-full h-1.5">
            <div
              className="bg-white h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
          {course.name}
        </h3>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {course.description}
        </p>

        <div className="flex items-center justify-between">
          {/* <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(star => (
              <Star key={star} className="w-4 h-4 text-yellow-400 fill-current" />
            ))}
            <span className="text-xs text-gray-500 ml-1">(4.8)</span>
          </div> */}

          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="bg-gray-200 rounded-3xl h-64 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-2xl h-32 animate-pulse"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-6">
              <div className="bg-gray-200 rounded-2xl h-80 animate-pulse"></div>
              <div className="bg-gray-200 rounded-2xl h-60 animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}