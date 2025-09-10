/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { BookOpen, Clock, Award, BarChart3, Play, Search, FileText, Target, TrendingUp, Bookmark } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { useCourses } from '@/context/CourseContext';
import { useTests } from '@/context/TestContext';
import { useTestSubmissions } from '@/context/TestSubmissionContext';
import { useSubmission } from '@/context/SubmissionContext';
import { useSubmissionEntries } from '@/context/SubmissionEntryContext';
import { useLesson } from '@/context/LessonContext';
import { useLessonCompletions } from '@/context/LessonCompletionContext';

export default function StudentCoursesPage() {
  const { profile } = useProfile();
  const { loading: courseLoading, fetchCoursesByStudentId } = useCourses();
  const { loading: testsLoading, fetchTestsByStudentId } = useTests();
  const { loading: testSubsLoading, fetchSubmissionsByStudentId: fetchTestSubmissionsByStudentId } = useTestSubmissions();
  const { loading: submissionLoading, fetchSubmissionsByStudentId } = useSubmission();
  const { loading: entriesLoading, fetchEntriesByStudentId } = useSubmissionEntries();
  const { loading: lessonsLoading, fetchLessonsByCourseId } = useLesson();
  const { loading: completionsLoading, fetchCompletionsByStudent } = useLessonCompletions();

  const router = useRouter();

  const [courses, setCourses] = useState<AppTypes.Course[]>([]);
  const [tests, setTests] = useState<AppTypes.Test[]>([]);
  const [testSubmissions, setTestSubmissions] = useState<AppTypes.TestSubmission[]>([]);
  const [submissions, setSubmissions] = useState<AppTypes.Submission[]>([]);
  const [submissionEntries, setSubmissionEntries] = useState<AppTypes.SubmissionEntry[]>([]);
  const [lessons, setLessons] = useState<AppTypes.Lesson[]>([]);
  const [lessonCompletions, setLessonCompletions] = useState<AppTypes.LessonCompletion[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  const studentId = profile?.id;

  // Fetch all data
  useEffect(() => {
    if (!studentId) return;

    const fetchData = async () => {
      try {
        const [
          studentCourses,
          studentTests,
          studentTestSubs,
          studentSubmissions,
          studentEntries,
          studentLessons,
          studentCompletions
        ] = await Promise.all([
          fetchCoursesByStudentId(studentId),
          fetchTestsByStudentId(studentId, true),
          fetchTestSubmissionsByStudentId(studentId),
          fetchSubmissionsByStudentId(studentId),
          fetchEntriesByStudentId(studentId),
          Promise.all((await fetchCoursesByStudentId(studentId) as AppTypes.Course[]).map(course =>
            fetchLessonsByCourseId(course.id)
          )).then(results => results.flat()),
          fetchCompletionsByStudent(studentId)
        ]);

        setCourses(studentCourses as AppTypes.Course[]);
        setTests(studentTests as AppTypes.Test[]);
        setTestSubmissions(studentTestSubs as AppTypes.TestSubmission[]);
        setSubmissions(studentSubmissions as AppTypes.Submission[]);
        setSubmissionEntries(studentEntries as AppTypes.SubmissionEntry[]);
        setLessons(studentLessons as AppTypes.Lesson[]);
        setLessonCompletions(studentCompletions as AppTypes.LessonCompletion[]);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [
    studentId,
    fetchCoursesByStudentId,
    fetchTestsByStudentId,
    fetchTestSubmissionsByStudentId,
    fetchSubmissionsByStudentId,
    fetchEntriesByStudentId,
    fetchLessonsByCourseId,
    fetchCompletionsByStudent
  ]);

  // Calculate course statistics
  const courseStats = useMemo(() => {
    const totalCourses = courses.length;
    const activeCourses = courses.length;

    const completedLessons = lessonCompletions.length;
    const totalLessons = lessons.length;
    const completionRate = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    const upcomingDeadlines = tests.filter(test => {
      const dueDate = new Date(test.dueDate);
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return dueDate > now && dueDate <= nextWeek;
    }).length;

    const averageGrade = testSubmissions.filter(ts => ts.grade).length > 0
      ? Math.round(testSubmissions.filter(ts => ts.grade).reduce((acc, ts) => acc + (ts.grade?.score || 0), 0) /
        testSubmissions.filter(ts => ts.grade).length)
      : 0;

    return {
      totalCourses,
      activeCourses,
      completionRate,
      upcomingDeadlines,
      averageGrade
    };
  }, [courses, tests, testSubmissions, lessons, lessonCompletions]);

  // Get courses with enriched data
  const enrichedCourses = useMemo(() => {
    return courses.map(course => {
      const courseTests = tests.filter(test => test.courseId === course.id);
      const courseSubmissions = submissions.filter(sub => sub.courseId === course.id);
      const courseLessons = lessons.filter(lesson => lesson.courseId === course.id);
      const completedLessons = lessonCompletions.filter(
        comp => courseLessons.some(lesson => lesson.id === comp.lessonId)
      ).length;

      const completionRate = courseLessons.length > 0
        ? Math.round((completedLessons / courseLessons.length) * 100)
        : 0;

      const upcomingTests = courseTests.filter(test =>
        new Date(test.dueDate) > new Date() &&
        !testSubmissions.some(ts => ts.testId === test.id && ts.status === "SUBMITTED")
      );

      const pendingSubmissions = courseSubmissions.filter(sub =>
        !submissionEntries.some(entry => entry.submissionId === sub.id && entry.status === "SUBMITTED")
      );

      return {
        ...course,
        stats: {
          totalTests: courseTests.length,
          totalLessons: courseLessons.length,
          completedLessons,
          completionRate,
          upcomingTests: upcomingTests.length,
          pendingSubmissions: pendingSubmissions.length
        }
      };
    });
  }, [courses, tests, submissions, lessons, lessonCompletions, testSubmissions, submissionEntries]);

  // Filter and sort courses
  const filteredCourses = useMemo(() => {
    let filtered = enrichedCourses;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(course =>
        course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    // if (filterCategory !== 'all') {
    //   filtered = filtered.filter(course => course.category === filterCategory);
    // }

    // Sort courses
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'progress':
          return b.stats.completionRate - a.stats.completionRate;
        case 'recent':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [enrichedCourses, searchQuery, sortBy]);

  const isLoading = courseLoading || testsLoading || testSubsLoading || submissionLoading ||
    entriesLoading || lessonsLoading || completionsLoading;

  const getCategoryColor = (category: string) => {
    const colors = {
      'Mathematics': 'bg-blue-100 text-blue-800',
      'Science': 'bg-green-100 text-green-800',
      'History': 'bg-amber-100 text-amber-800',
      'Literature': 'bg-purple-100 text-purple-800',
      'Technology': 'bg-indigo-100 text-indigo-800',
      'Arts': 'bg-pink-100 text-pink-800',
      'Languages': 'bg-red-100 text-red-800',
      'default': 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || colors.default;
  };

  const handleCourseClick = (courseId: string) => {
    router.push(`/dashboard/courses/${courseId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-8">

        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-700 p-8 text-white">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">My Courses</h1>
                <p className="text-blue-100 mt-1">Explore and manage your learning journey</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <StatCard
            icon={<BookOpen className="w-6 h-6 text-blue-600" />}
            title="Total Courses"
            value={courseStats.totalCourses}
            color="blue"
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6 text-green-600" />}
            title="Active Courses"
            value={courseStats.activeCourses}
            color="green"
          />
          <StatCard
            icon={<BarChart3 className="w-6 h-6 text-purple-600" />}
            title="Completion Rate"
            value={`${courseStats.completionRate}%`}
            color="purple"
          />
          <StatCard
            icon={<Clock className="w-6 h-6 text-red-600" />}
            title="Upcoming Deadlines"
            value={courseStats.upcomingDeadlines}
            color="red"
          />
          <StatCard
            icon={<Award className="w-6 h-6 text-yellow-600" />}
            title="Average Grade"
            value={`${courseStats.averageGrade}%`}
            color="yellow"
          />
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-center w-full lg:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:w-80">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Category Filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                <option value="all">All Categories</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Science">Science</option>
                <option value="History">History</option>
                <option value="Literature">Literature</option>
                <option value="Technology">Technology</option>
                <option value="Arts">Arts</option>
                <option value="Languages">Languages</option>
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              >
                <option value="recent">Recently Added</option>
                <option value="name">Course Name</option>
                <option value="progress">Progress</option>
              </select>
            </div>
          </div>
        </div>

        {/* Courses Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <CourseSkeletonCard key={i} />
            ))}
          </div>
        ) : filteredCourses.length === 0 ? (
          <EmptyState searchQuery={searchQuery} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                getCategoryColor={getCategoryColor}
                onClick={() => handleCourseClick(course.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, color }: { icon: React.ReactNode, title: string, value: number | string, color: string }) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    purple: "bg-purple-50 border-purple-200",
    red: "bg-red-50 border-red-200",
    yellow: "bg-yellow-50 border-yellow-200"
  };

  return (
    <div className={`${colorClasses[color as keyof typeof colorClasses]} border rounded-2xl p-6 hover:shadow-lg transition-all duration-300 hover:scale-105`}>
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-white rounded-xl shadow-sm">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm font-medium text-gray-700">{title}</div>
    </div>
  );
}

function CourseCard({ course, getCategoryColor, onClick }: {
  course: AppTypes.Course & { stats: any },
  getCategoryColor: (category: string) => string,
  onClick: () => void
}) {
  const isActive = true;
  const progress = course.stats.completionRate;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-105 group cursor-pointer" onClick={onClick}>
      {/* Course Image */}
      <div className="h-48 relative">
        {course.imageUrl ? (
          <Image
            src={`/images/${course.imageUrl}`}
            alt={course.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-white" />
          </div>
        )}
        <div className="absolute inset-0 bg-blue-600/20"></div>
        <div className="absolute top-4 left-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor("science")}`}>
            {`Category`}
          </span>
        </div>
        <div className="absolute top-4 right-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            {isActive ? 'Active' : 'Completed'}
          </span>
        </div>
      </div>

      {/* Course Content */}
      <div className="p-6">
        <h3 className="font-semibold text-gray-900 text-lg mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
          {course.name}
        </h3>

        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {course.description || 'No description available'}
        </p>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Course Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileText className="w-4 h-4" />
            <span>{course.stats.totalLessons} Lessons</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Target className="w-4 h-4" />
            <span>{course.stats.totalTests} Tests</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>{course.stats.upcomingTests} Upcoming</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Bookmark className="w-4 h-4" />
            <span>{course.stats.pendingSubmissions} Pending</span>
          </div>
        </div>

        {/* Dates */}
        {/* <div className="flex justify-between text-xs text-gray-500 mb-4">
          <span>Start: {formatDate(course.startDate)}</span>
          <span>End: {formatDate(course.endDate)}</span>
        </div> */}

        {/* Action Button */}
        <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors">
          <Play className="w-4 h-4" />
          Continue Learning
        </button>
      </div>
    </div>
  );
}

function CourseSkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse">
      <div className="h-48 bg-gray-200 rounded-xl mb-4"></div>
      <div className="h-6 w-3/4 bg-gray-200 rounded mb-3"></div>
      <div className="h-4 w-full bg-gray-200 rounded mb-2"></div>
      <div className="h-4 w-2/3 bg-gray-200 rounded mb-4"></div>
      <div className="h-2 w-full bg-gray-200 rounded-full mb-4"></div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="h-4 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded"></div>
      </div>
      <div className="h-8 w-full bg-gray-200 rounded-xl"></div>
    </div>
  );
}

function EmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
      <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-2xl flex items-center justify-center">
        <BookOpen className="w-12 h-12 text-gray-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No courses found
      </h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        {searchQuery
          ? "No courses match your search criteria. Try adjusting your search terms."
          : "You haven't enrolled in any courses yet. Browse available courses to get started."}
      </p>
      <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors">
        Browse Courses
      </button>
    </div>
  );
}