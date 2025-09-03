"use client";

import { BookOpen, Clock, Plus, Search, Users } from "lucide-react";
import TestActionsMenu from "./models/actions-menu";
import TutorTestsTableSkeleton from "./skeletons/table-skeleton";
import { useEffect, useMemo, useState } from "react";
import { useCourses } from "@/context/CourseContext";
import { useTests } from "@/context/TestContext";
import { useProfile } from "@/context/ProfileContext";
import { formatDate } from "@/lib/functions";
import ViewSubmissionsDialog from "./dialogs/view-submission-dialog";
import StatusCheck from "./models/status-menu";
import { useRouter } from "next/navigation";

export default function TutorTestsPage() {
  const { fetchCoursesByTutorId, loading: coursesLoading } = useCourses();
  const { fetchTestsByTutorId, deleteTest, loading: testLoading } = useTests();
  const { profile } = useProfile();
  const router = useRouter();

  const tutorProfile: AppTypes.Tutor = profile as AppTypes.Tutor;

  const [tests, setTests] = useState<AppTypes.Test[]>([]);
  const [courses, setCourses] = useState<AppTypes.Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTest, setSelectedTest] = useState<AppTypes.Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSubmissionsDialog, setShowSubmissionsDialog] = useState<boolean>(false);

  // fetch courses
  useEffect(() => {
    if (!tutorProfile) return;

    const fetch = async () => {
      setLoading(true);

      const fetchedCourses = await fetchCoursesByTutorId(tutorProfile.id) as AppTypes.Course[];

      setCourses(fetchedCourses);
      setLoading(false);
    };

    fetch();
  }, [tutorProfile, fetchCoursesByTutorId]);

  // fetch tests
  useEffect(() => {
    if (!tutorProfile) return;

    const fetch = async () => {
      setLoading(true);

      const fetchedTests = await fetchTestsByTutorId(tutorProfile.id) as AppTypes.Test[];

      setTests(fetchedTests);
      setLoading(false);
    };

    fetch();
  }, [tutorProfile, fetchTestsByTutorId]);

  // memoized filter function
  const filteredTests = useMemo(() => {
    let filtered = tests;

    // Filter by course
    if (selectedCourse !== 'all') {
      filtered = filtered.filter(test => test.courseId === selectedCourse);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(test =>
        test.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        courses.find(c => c.id === test.courseId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(test => {
        switch (statusFilter) {
          case 'active':
            return test.isActive;
          case 'inactive':
            return !test.isActive;
          case 'upcoming':
            return test.dueDate > new Date();
          case 'past':
            return test.dueDate <= new Date();
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [tests, courses, selectedCourse, searchTerm, statusFilter]);

  // functions
  const getTestStats = (test: AppTypes.Test) => {
    const totalStudents = courses.find(c => c.id === test.courseId)?.students?.length || 0;
    const submittedCount = test.submissions.filter(s => s.submittedAt).length;
    const gradedCount = test.submissions.filter(s => s.score !== undefined).length;
    const inProgressCount = test.submissions.filter(s => s.status === 'SUBMITTED').length;

    return { totalStudents, submittedCount, gradedCount, inProgressCount };
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const handleEditTest = (test: AppTypes.Test) => {
    setSelectedTest(test);
    router.push(`/dashboard/tutor-tests/create/${test.id}`);
  };

  const handleViewDetails = (test: AppTypes.Test) => {
    setSelectedTest(test);
    setShowSubmissionsDialog(true);
  };

  const handleDeleteTest = async (testId: string) => {
    try {
      if (confirm('Are you sure you want to delete this test? This action cannot be undone.')) {
        await deleteTest(testId);
      }
    } catch (error) {
      console.error('Error deleting test:', error);
    }
  };

  const handleDuplicateTest = (test: AppTypes.Test) => {
    const duplicated: AppTypes.Test = {
      ...test,
      id: `${test.id}_copy_${Date.now()}`,
      title: `${test.title} (Copy)`,
      submissions: [],
      createdAt: new Date(),
    };
    setTests(prev => [duplicated, ...prev]);
  };

  const handleToggleActive = (testId: string) => {
    setTests(prev => prev.map(test =>
      test.id === testId ? { ...test, isActive: !test.isActive } : test
    ));
  };

  if (loading || testLoading || coursesLoading) {
    return <TutorTestsTableSkeleton />;
  }

  return (
    <div className="h-full px-6 pt-6 pb-10 bg-gray-50 overflow-y-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Manage Tests
          </h1>
          <p className="text-gray-600 text-sm">
            Create and manage tests and examinations for your courses
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 p-6 bg-white border border-gray-200 flex justify-between items-center">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
            />
          </div>

          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="px-4 py-2 border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Courses</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past Due</option>
          </select>
        </div>

        <button
          onClick={() => router.push("/dashboard/tutor-tests/create")}
          className="px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Test
        </button>
      </div>

      {/* Tests Table */}
      {(!filteredTests.length && !loading) ? (
        <div className="text-center py-12 bg-white border border-gray-200">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No tests found
          </h3>
          <p className="text-gray-500 text-sm mb-4">
            {searchTerm || statusFilter !== 'all' || selectedCourse !== 'all'
              ? "Try adjusting your filters"
              : "Create your first test to get started"}
          </p>
          {(!searchTerm && statusFilter === 'all' && selectedCourse === 'all') && (
            <button
              onClick={() => router.push("/dashboard/tutor-tests/create")}
              className="px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 flex items-center gap-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              Create First Test
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Test
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTests.map(test => {
                  const stats = getTestStats(test);
                  const isOverdue = new Date() > test.dueDate;
                  const completionRate = stats.totalStudents > 0
                    ? Math.round((stats.submittedCount / stats.totalStudents) * 100)
                    : 0;

                  return (
                    <tr key={test.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {test.title}
                          </div>
                          <div className="text-sm text-gray-500">
                            {test.totalPoints} points • Created {new Date(test.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{courses.find(c => c.id === test.courseId)?.name || "Course name not found"}</div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          {stats.totalStudents} students
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(test.dueDate)}
                        </div>
                        <div className={`text-sm ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
                          {isOverdue ? 'Overdue' : 'Active'}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {test.timeLimit ? formatDuration(test.timeLimit) : 'No limit'}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${completionRate}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">
                            {stats.submittedCount}/{stats.totalStudents}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusCheck
                          isActive={test.isActive}
                          stats={{
                            gradedCount: stats.gradedCount,
                            inProgressCount: stats.inProgressCount,
                            submittedCount: stats.submittedCount
                          }}
                        />
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <TestActionsMenu
                          onView={() => handleViewDetails(test)}
                          onEdit={() => handleEditTest(test)}
                          onDelete={() => handleDeleteTest(test.id)}
                          onDuplicate={() => handleDuplicateTest(test)}
                          onToggleActive={() => handleToggleActive(test.id)}
                          isActive={test.isActive}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showSubmissionsDialog && (
        <ViewSubmissionsDialog
          test={selectedTest as AppTypes.Test}
          courseId={selectedTest?.courseId as string}
          courseName={courses.find(c => c.id === selectedTest?.courseId)?.name || "Course Name Not Found"}
          onClose={() => setShowSubmissionsDialog(false)}
        />
      )}
    </div>
  );
}