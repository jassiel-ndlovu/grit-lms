'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { CalendarDays, Clock, BookOpen, Zap, Target, TrendingUp, Users, Search, Filter } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTests } from '@/context/TestContext';
import { useCourses } from '@/context/CourseContext';
import { useProfile } from '@/context/ProfileContext';
import { formatTime, formatDate } from '@/lib/functions';
import { useTestSubmissions } from '@/context/TestSubmissionContext';

type TabType = 'active' | 'incomplete' | 'completed';

export default function TestsPage() {
  const { fetchTestsByCourse, loading: testsLoading } = useTests();
  const { fetchCoursesByStudentId, loading: coursesLoading } = useCourses();
  const { fetchSubmissionByStudentTestId } = useTestSubmissions();
  const { profile, loading: profileLoading } = useProfile();

  const [studentCourses, setStudentCourses] = useState<AppTypes.Course[]>([]);
  const [studentTests, setStudentTests] = useState<AppTypes.Test[]>([]);
  const [testSubmissions, setTestSubmissions] = useState<AppTypes.TestSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');

  const studentProfile = useMemo(() => profile as AppTypes.Student, [profile]);

  useEffect(() => {
    if (studentProfile?.id) {
      const fetchCourses = async () => {
        const fetchedCourses = await fetchCoursesByStudentId(studentProfile.id);
        setStudentCourses(fetchedCourses || []);
      }
      fetchCourses();
    }
  }, [studentProfile?.id, fetchCoursesByStudentId]);

  useEffect(() => {
    if (studentProfile?.id) {
      const fetchTests = async () => {
        if (coursesLoading) return;
        const courseIds = studentCourses.map(course => course.id);
        const fetchedTests = await fetchTestsByCourse(courseIds, true) as AppTypes.Test[];
        setStudentTests(fetchedTests);

        if (!fetchedTests || fetchedTests.length === 0) return;

        try {
          // Create an array of promises for all submissions
          const submissionPromises = fetchedTests.map(t =>
            fetchSubmissionByStudentTestId(studentProfile.id, t.id)
          );

          // Execute all requests in parallel
          const results = await Promise.allSettled(submissionPromises);

          // Process results
          const successfulSubmissions: AppTypes.TestSubmission[] = [];
          const errors: string[] = [];

          results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
              successfulSubmissions.push(result.value as AppTypes.TestSubmission);
            } else {
              errors.push(`Failed to fetch submission for test: ${fetchedTests[index]?.title}`);
            }
          });

          // Set the successful submissions
          setTestSubmissions(successfulSubmissions);

          // Log any errors
          if (errors.length > 0) {
            console.warn('Some submissions failed to load:', errors);
            if (successfulSubmissions.length === 0) {
              console.error('Failed to load submissions');
            }
          }
        } catch (error) {
          console.error('Error fetching test submissions:', error);
        } finally {
          setLoadingSubmissions(false);
        }
      }
      fetchTests();
    }
  }, [studentProfile?.id, studentCourses, fetchTestsByCourse, coursesLoading, fetchSubmissionByStudentTestId]);

  // Filter tests based on active tab
  const filteredTests = useMemo(() => {
    if (!studentTests || studentTests.length === 0) return [];

    const now = new Date();

    return studentTests.filter(test => {
      const dueDate = new Date(test.dueDate);
      const submission = testSubmissions.find(sub => sub.testId === test.id);
      const isCompleted = submission && submission.status === "SUBMITTED";
      const isExpired = dueDate < now;

      // A test is active if it is before the due date and test.isActive
      const isActive = test.isActive && dueDate >= now;

      // A test is incomplete if test.isActive, the due date has passed and no submission is found
      const isIncomplete = test.isActive && isExpired && !isCompleted;

      // A test is completed if test.isActive, the due date has passed and a submission is found
      const isCompletedStatus = test.isActive && isExpired && isCompleted;

      // Filter by tab
      if (activeTab === 'active') {
        if (!isActive) return false;
      } else if (activeTab === 'incomplete') {
        if (!isIncomplete) return false;
      } else if (activeTab === 'completed') {
        if (!isCompletedStatus) return false;
      }

      // Filter by search query
      if (searchQuery && !test.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Filter by course
      if (filterCourse !== 'all' && test.courseId !== filterCourse) {
        return false;
      }

      return true;
    });
  }, [studentTests, testSubmissions, activeTab, searchQuery, filterCourse]);

  // Get course info for each test
  const testsWithCourseInfo = useMemo(() => {
    if (!filteredTests) return;

    return filteredTests.map(test => {
      const course = studentCourses.find(c => c.id === test.courseId);
      return {
        ...test,
        courseName: course?.name || 'Unknown Course',
        courseImage: course?.imageUrl || null
      };
    });
  }, [filteredTests, studentCourses]);

  const isLoading = coursesLoading || testsLoading || profileLoading || loadingSubmissions;

  // Calculate stats for the header
  const stats = useMemo(() => {
    if (!studentTests || studentTests.length === 0) return;

    const activeTests = studentTests.filter(test => new Date(test.dueDate) > new Date());
    const completedTests = studentTests.filter(test =>
      test.submissions?.some(sub => sub.status === "SUBMITTED")
    );
    const upcomingDeadlines = studentTests.filter(test => {
      const dueDate = new Date(test.dueDate);
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return dueDate > now && dueDate <= nextWeek;
    }).length;

    return {
      totalTests: studentTests.length,
      activeTests: activeTests.length,
      completedTests: completedTests.length,
      upcomingDeadlines,
      completionRate: studentTests.length > 0 ? Math.round((completedTests.length / studentTests.length) * 100) : 0
    };
  }, [studentTests]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl p-6 space-y-8">
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
                  <h1 className="text-3xl font-bold">Your Tests Hub</h1>
                  <p className="text-blue-100 mt-1">Manage and access all your assessments in one place</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 mt-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-yellow-300" />
                  </div>
                  <span className="text-sm text-blue-100">{stats ? stats.totalTests: 0} Total Tests</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                    <Target className="w-4 h-4 text-green-300" />
                  </div>
                  <span className="text-sm text-blue-100">{stats ? stats.activeTests : 0} Active Tests</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="w-64 h-40 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20 p-6">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-1">{stats ? stats.completionRate: 0}%</div>
                  <div className="text-sm text-blue-100">Completion Rate</div>
                  <div className="mt-4 flex justify-center">
                    <div className="w-20 h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-blue-400 rounded-full transition-all duration-500"
                        style={{ width: `${stats ? stats.completionRate: 0}%` }}
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
            title="Total Tests"
            value={stats ? stats.totalTests.toString(): "0"}
            color="blue"
            trend="All courses"
          />
          <StatCard
            icon={<Clock className="w-6 h-6 text-amber-600" />}
            title="Active Tests"
            value={stats ? stats.activeTests.toString(): "0"}
            color="amber"
            trend="Ready to take"
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6 text-green-600" />}
            title="Completion Rate"
            value={`${stats ? stats.completionRate: "0"}%`}
            color="green"
            trend="Overall progress"
          />
          <StatCard
            icon={<Users className="w-6 h-6 text-purple-600" />}
            title="Upcoming Deadlines"
            value={stats ? stats.upcomingDeadlines.toString(): "0"}
            color="purple"
            trend="Next 7 days"
          />
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search tests by name..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <Filter className="text-gray-500 w-5 h-5" />
              <select
                className="border border-gray-300 text-sm px-4 py-3 rounded-xl focus:ring-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={filterCourse}
                onChange={(e) => setFilterCourse(e.target.value)}
              >
                <option value="all">All Courses</option>
                {studentCourses.map(course => (
                  <option key={course.id} value={course.id}>{course.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mt-6">
            <button
              className={`px-4 py-3 font-medium text-sm ${activeTab === 'active' ? 'text-blue-600 border-b-4 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('active')}
            >
              Active Tests
            </button>
            <button
              className={`px-4 py-3 font-medium text-sm ${activeTab === 'incomplete' ? 'text-blue-600 border-b-4 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('incomplete')}
            >
              Incomplete
            </button>
            <button
              className={`px-4 py-3 font-medium text-sm ${activeTab === 'completed' ? 'text-blue-600 border-b-4 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('completed')}
            >
              Completed
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {isLoading ? (
            <SkeletonLoader />
          ) : !testsWithCourseInfo || testsWithCourseInfo.length === 0 ? (
            <EmptyState />
          ) : (
            <section className="bg-white border border-gray-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  All Tests
                </h2>
                <span className="text-sm text-gray-500">
                  {testsWithCourseInfo.length} test{testsWithCourseInfo.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {testsWithCourseInfo.map(test => (
                  <TestCard
                    key={test.id}
                    test={test}
                    courseName={test.courseName}
                    courseImage={test.courseImage as string}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function TestCard({ test, courseName, courseImage }: { test: AppTypes.Test; courseName: string; courseImage?: string }) {
  const { profile } = useProfile();
  const { fetchSubmissionByStudentTestId } = useTestSubmissions();
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);
  const [studentSub, setStudentSub] = useState<AppTypes.TestSubmission | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      const sub = await fetchSubmissionByStudentTestId(profile.id, test.id) as AppTypes.TestSubmission;
      setStudentSub(sub);
    })();
  }, [profile?.id, test.id, fetchSubmissionByStudentTestId]);

  useEffect(() => {
    if (!test.timeLimit || !studentSub) return;

    const calculateTimeLeft = () => {
      const now = new Date();
      const dueDate = new Date(test.dueDate);

      if (studentSub?.status === "SUBMITTED") {
        setTimeLeft("Completed");
        return;
      }

      // Check if test is expired
      if (now > dueDate) {
        setIsExpired(true);
        setTimeLeft('Time expired');
        return;
      }

      // Calculate time left for active tests (static calculation)
      const timeLimitMs = (test.timeLimit as number) * 60 * 1000;
      const startTime = studentSub?.startedAt ? new Date(studentSub.startedAt) : now;
      const elapsedTime = now.getTime() - startTime.getTime();
      const remainingTime = timeLimitMs - elapsedTime;

      if (remainingTime <= 0) {
        setIsExpired(true);
        setTimeLeft('Time expired');
        return;
      }

      setTimeLeft(formatTime(Math.floor(remainingTime / 1000)));
    };

    calculateTimeLeft();
  }, [test.timeLimit, test.dueDate, studentSub]);

  const getStatusColor = () => {
    if (isExpired) return 'bg-red-100 text-red-700';
    if (studentSub?.status === "SUBMITTED") return 'bg-green-100 text-green-700';
    return 'bg-blue-100 text-blue-700';
  };

  const getStatusText = () => {
    if (isExpired) return 'Expired';
    if (studentSub?.status === "SUBMITTED") return 'Completed';
    return 'Active';
  };

  return (
    <div className="border border-gray-200 rounded-xl bg-white hover:shadow-md transition-all duration-300 group overflow-hidden">
      {/* Course image header */}
      {courseImage && (
        <div className="h-32 relative">
          <Image
            src={`/images/${courseImage}`}
            alt={courseName}
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-blue-600/20"></div>
          <div className="absolute bottom-2 left-3 text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">
            {courseName}
          </div>
        </div>
      )}

      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
          {test.title}
        </h3>

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CalendarDays className="w-4 h-4" />
            Due: {formatDate(test.dueDate)}
          </div>

          {test.timeLimit && timeLeft && (
            <div className={`flex items-center gap-2 text-sm ${isExpired ? 'text-red-500' : 'text-gray-600'}`}>
              <Clock className="w-4 h-4" />
              {studentSub?.status === "SUBMITTED" ? "Time taken: " : "Time left: "}{timeLeft}
            </div>
          )}

          {!courseImage && (
            <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
              {courseName}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${getStatusColor()}`}>
            {getStatusText()}
          </span>

          <button
            onClick={() => {
              if (studentSub?.status === "SUBMITTED") {
                router.push(`/dashboard/tests/review/${test.id}`);
              } else {
                router.push(`/dashboard/tests/pre-test/${test.id}`);
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isExpired}
          >
            {isExpired ? 'Expired' : studentSub?.status === "SUBMITTED" ? 'Review' : 'Start Test'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, color, trend }: {
  icon: React.ReactNode;
  title: string;
  value: string;
  color: "blue" | "amber" | "green" | "purple";
  trend: string;
}) {
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

function SkeletonLoader() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white p-6 rounded-2xl border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-xl animate-pulse"></div>
              <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
            </div>
            <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(j => (
              <div key={j} className="border border-gray-200 rounded-xl p-6 bg-white animate-pulse">
                <div className="h-6 bg-gray-200 rounded mb-3"></div>
                <div className="space-y-2 mb-4">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                  <div className="h-8 bg-gray-200 rounded w-20"></div>
                </div>
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
    <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        Not Available
      </h2>
      <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto">
        Check back later or contact your tutor for upcoming assessments.
      </p>
    </div>
  );
}