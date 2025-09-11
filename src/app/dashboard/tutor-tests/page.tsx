"use client";

import { BookOpen, Clock, Cloud, CloudOffIcon, Plus, Search, Users } from "lucide-react";
import TestActionsMenu from "./models/actions-menu";
import TutorTestsTableSkeleton from "./skeletons/table-skeleton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCourses } from "@/context/CourseContext";
import { useTests } from "@/context/TestContext";
import { useProfile } from "@/context/ProfileContext";
import { useTestSubmissions } from "@/context/TestSubmissionContext";
import { formatDate } from "@/lib/functions";
import ViewSubmissionsDialog from "./dialogs/view-submission-dialog";
import StatusCheck from "./models/status-menu";
import { useRouter } from "next/navigation";

export default function TutorTestsPage() {
  const { fetchCoursesByTutorId, loading: coursesLoading } = useCourses();
  const { fetchTestsByTutorId, deleteTest, loading: testLoading } = useTests();
  const { fetchSubmissionsByTestId } = useTestSubmissions();
  const { profile } = useProfile();
  const router = useRouter();

  const tutorProfile: AppTypes.Tutor = profile as AppTypes.Tutor;

  const [tests, setTests] = useState<AppTypes.Test[]>([]);
  const [courses, setCourses] = useState<AppTypes.Course[]>([]);
  const [testSubmissions, setTestSubmissions] = useState<Record<string, AppTypes.TestSubmission[]>>({});
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTest, setSelectedTest] = useState<AppTypes.Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState<Record<string, boolean>>({});
  const [showSubmissionsDialog, setShowSubmissionsDialog] = useState<boolean>(false);

  // fetch courses
  useEffect(() => {
    if (!tutorProfile) return;

    const fetch = async () => {
      setLoading(true);

      try {
        const fetchedCourses = await fetchCoursesByTutorId(tutorProfile.id) as AppTypes.Course[];
        setCourses(fetchedCourses);
      } catch (error) {
        console.error("Failed to fetch courses:", error);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [tutorProfile, fetchCoursesByTutorId]);

// Function to fetch submissions for a specific test
  const fetchTestSubmissions = useCallback(async (testId: string) => {
    setSubmissionsLoading(prev => ({ ...prev, [testId]: true }));
    
    try {
      const submissions = await fetchSubmissionsByTestId(testId) as AppTypes.TestSubmission[];
      setTestSubmissions(prev => ({ ...prev, [testId]: submissions }));
    } catch (error) {
      console.error(`Failed to fetch submissions for test ${testId}:`, error);
    } finally {
      setSubmissionsLoading(prev => ({ ...prev, [testId]: false }));
    }
  }, [fetchSubmissionsByTestId]);

  // fetch tests
  useEffect(() => {
    if (!tutorProfile) return;

    const fetch = async () => {
      setLoading(true);

      try {
        const fetchedTests = await fetchTestsByTutorId(tutorProfile.id) as AppTypes.Test[];
        setTests(fetchedTests);
        
        // Fetch submissions for each test
        fetchedTests.forEach(test => {
          fetchTestSubmissions(test.id);
        });
      } catch (error) {
        console.error("Failed to fetch tests:", error);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [tutorProfile, fetchTestsByTutorId, fetchTestSubmissions]);

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
        test.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        courses.find(c => c.id === test.courseId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(test => {
        switch (statusFilter) {
          case 'active':
            return test.isActive;
          case 'inactive':
            return !test.isActive;
          case 'upcoming':
            return new Date(test.dueDate) > now;
          case 'past':
            return new Date(test.dueDate) <= now;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [tests, courses, selectedCourse, searchTerm, statusFilter]);

  // functions
  const getTestStats = (test: AppTypes.Test) => {
    const submissions = testSubmissions[test.id] || [];
    const totalStudents = courses.find(c => c.id === test.courseId)?.students?.length || 0;
    const submittedCount = submissions.filter(s => s.submittedAt).length;
    const gradedCount = submissions.filter(s => s.grade !== undefined && s.grade !== null).length;
    const inProgressCount = submissions.filter(s => s.status === 'SUBMITTED').length;

    return { 
      totalStudents, 
      submittedCount, 
      gradedCount, 
      inProgressCount,
      isLoading: submissionsLoading[test.id] || false
    };
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
        setTests(prev => prev.filter(test => test.id !== testId));
        // Remove submissions for deleted test
        setTestSubmissions(prev => {
          const newSubmissions = { ...prev };
          delete newSubmissions[testId];
          return newSubmissions;
        });
      }
    } catch (error) {
      console.error('Error deleting test:', error);
    }
  };

  const handleDuplicateTest = async (test: AppTypes.Test) => {
    try {
      // Create a copy of the test without the ID and with a new title
      const duplicatedTest = {
        ...test,
        id: undefined, // Let the server generate a new ID
        title: `${test.title} (Copy)`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // In a real implementation, you would call an API to create the duplicated test
      // For now, we'll just add it to the local state
      setTests(prev => [{ ...duplicatedTest, id: `temp-${Date.now()}` }, ...prev]);
      
      // Show success message
      alert('Test duplicated successfully!');
    } catch (error) {
      console.error('Error duplicating test:', error);
      alert('Failed to duplicate test. Please try again.');
    }
  };

  const handleToggleActive = async (testId: string) => {
    try {
      // In a real implementation, you would call an API to toggle the test status
      // For now, we'll just update the local state
      setTests(prev => prev.map(test =>
        test.id === testId ? { ...test, isActive: !test.isActive } : test
      ));
    } catch (error) {
      console.error('Error toggling test status:', error);
    }
  };

  const isLoading = loading || testLoading || coursesLoading;

  if (isLoading) {
    return <TutorTestsTableSkeleton />;
  }

  return (
    <div className="h-full px-6 pt-6 pb-10 bg-gray-50">
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
      <div className="mb-6 p-6 bg-white border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
      {(!filteredTests.length && !isLoading) ? (
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
                  const isOverdue = new Date() > new Date(test.dueDate);
                  const completionRate = stats.totalStudents > 0
                    ? Math.round((stats.submittedCount / stats.totalStudents) * 100)
                    : 0;
                  const course = courses.find(c => c.id === test.courseId);

                  return (
                    <tr key={test.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {test.title}
                          </div>
                          <div className="text-sm text-gray-500">
                            {test.totalPoints} points • Created {formatDate(test.createdAt)}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{course?.name || "Course not found"}</div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          {stats.totalStudents} students
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(test.dueDate)}
                        </div>
                        <div className={`flex items-center gap-1 text-sm font-medium ${isOverdue ? 'text-red-500' : test.isActive ? 'text-green-500': 'text-gray-500'}`}>
                          {isOverdue ? 
                            <Clock className="w-3 h-3" />
                          : test.isActive ? 
                            <Cloud className="w-3 h-3" />
                          : <CloudOffIcon className="w-3 h-3" />}
                          <span>{isOverdue ? 'Due' : test.isActive ? 'Active' : 'Draft'}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {test.timeLimit ? formatDuration(test.timeLimit) : 'No limit'}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {stats.isLoading ? (
                          <div className="text-sm text-gray-500">Loading...</div>
                        ) : (
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${completionRate}%` }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-600">
                              {stats.submittedCount}/{stats.totalStudents}
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusCheck
                          isActive={test.isActive}
                          stats={{
                            gradedCount: stats.gradedCount,
                            inProgressCount: stats.inProgressCount,
                            submittedCount: stats.submittedCount
                          }}
                          isLoading={stats.isLoading}
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

      {showSubmissionsDialog && selectedTest && (
        <ViewSubmissionsDialog
          test={selectedTest}
          testSubmissions={testSubmissions}
          courseId={selectedTest.courseId}
          courseName={courses.find(c => c.id === selectedTest.courseId)?.name || "Course Name Not Found"}
          onClose={() => setShowSubmissionsDialog(false)}
        />
      )}
    </div>
  );
}