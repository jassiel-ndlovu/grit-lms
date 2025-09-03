"use client";

import { Calendar, Clock, Download, FileText, GraduationCap, Star, User, Users } from "lucide-react";
import TestSubmissionsSkeleton from "../../../skeletons/test-submissions-skeleton";
import { $Enums } from "@/generated/prisma";
import { useEffect, useState } from "react";
import { useStudent } from "@/context/StudentContext";
import { useTestSubmissions } from "@/context/TestSubmissionContext";
import { useTests } from "@/context/TestContext";
import { useParams, useRouter } from "next/navigation";
import Skeleton from "@/app/dashboard/components/skeleton";
import { formatDate } from "@/lib/functions";

export default function TestSubmissionsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const testId = params?.id;
  
  const { currentTest, loading: testLoading, fetchTestById } = useTests();
  const {
    testSubmissions,
    loading: submissionsLoading,
    fetchSubmissionsByTestId,
  } = useTestSubmissions();
  const { loading: studentsLoading, fetchStudentsByCourseId } = useStudent();

  const [students, setStudents] = useState<AppTypes.Student[]>([]);
  const [exportLoading, setExportLoading] = useState(false);

  // Fetch test + submissions
  useEffect(() => {
    if (testId) {
      fetchTestById(testId);
      fetchSubmissionsByTestId(testId);
    }
  }, [testId, fetchTestById, fetchSubmissionsByTestId]);

  // Fetch students
  useEffect(() => {
    if (currentTest?.courseId) {
      const fetch = async () => {
        const fetchedStudents = (await fetchStudentsByCourseId(
          currentTest.courseId
        )) as AppTypes.Student[];

        setStudents(fetchedStudents);
      };

      fetch();
    }
  }, [currentTest?.courseId, fetchStudentsByCourseId]);

  /** ---------------------------
   * Helper Functions
   ---------------------------- */
  const getStatusColor = (status: $Enums.SubmissionStatus) => {
    switch (status) {
      case "GRADED":
        return "bg-green-100 text-green-800";
      case "SUBMITTED":
        return "bg-yellow-100 text-yellow-800";
      case "LATE":
        return "bg-red-100 text-red-800";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      case "NOT_SUBMITTED":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatScore = (score?: number, totalPoints?: number) => {
    if (score === undefined || score === null) return "Not graded";
    const total = totalPoints || currentTest?.totalPoints || 100;
    return `${score}/${total} (${Math.round((score / total) * 100)}%)`;
  };

  const getSubmissionStats = () => {
    const total = testSubmissions.length;
    const graded = testSubmissions.filter((s) => s.status === "GRADED").length;
    const submitted = testSubmissions.filter(
      (s) => s.status === "SUBMITTED"
    ).length;
    const late = testSubmissions.filter((s) => s.status === "LATE").length;
    return { total, graded, submitted, late };
  };

  const exportResults = async () => {
    setExportLoading(true);
    try {
      // Create CSV
      const headers = [
        "Student Name",
        "Email",
        "Status",
        "Score",
        "Percentage",
        "Submitted At",
        "Feedback",
      ];
      const rows = testSubmissions.map((submission) => {
        const student = students.find((s) => s.id === submission.studentId);
        const percentage =
          submission.score && currentTest
            ? Math.round((submission.score / currentTest.totalPoints) * 100)
            : 0;
        return [
          student?.fullName || "Unknown Student",
          student?.email || "Unknown Email",
          submission.status,
          submission.score || "Not graded",
          `${percentage}%`,
          submission.submittedAt
            ? formatDate(submission.submittedAt)
            : "Not submitted",
          submission.feedback || "No feedback",
        ];
      });
      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");

      // Download CSV
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${currentTest?.title || "test"}-submissions.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExportLoading(false);
    }
  };

  const viewSubmission = (studentId: string) => {
    router.push(`/dashboard/tutor-tests/submissions/${testId}/${studentId}`);
  };

  /** ---------------------------
   * Rendering
   ---------------------------- */
  if (testLoading || !currentTest) {
    return <TestSubmissionsSkeleton />;
  }

  const stats = getSubmissionStats();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        {/* Page header */}
        <div className="bg-white border-gray-200 border">
          <div className="flex items-center gap-3 p-6 border-b border-gray-200 bg-gray-50">
            <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">
                {currentTest.title}
              </h2>
              <p className="text-sm text-gray-600">{currentTest.description}</p>
            </div>
            <button
              onClick={exportResults}
              disabled={exportLoading || testSubmissions.length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {exportLoading ? "Exporting..." : "Export CSV"}
            </button>
          </div>

          <div className="p-6">
            {/* Test Overview */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <div>
                    <span className="text-gray-500 block">Due Date</span>
                    <p className="font-medium">{formatDate(currentTest.dueDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <div>
                    <span className="text-gray-500 block">Total Points</span>
                    <p className="font-medium">{currentTest.totalPoints}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <div>
                    <span className="text-gray-500 block">Time Limit</span>
                    <p className="font-medium">
                      {currentTest.timeLimit ? `${currentTest.timeLimit} mins` : 'No limit'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <div>
                    <span className="text-gray-500 block">Questions</span>
                    <p className="font-medium">{currentTest.questions?.length || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
                    <p className="text-sm text-blue-700">Total Submissions</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold text-green-900">{stats.graded}</p>
                    <p className="text-sm text-green-700">Graded</p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="text-2xl font-bold text-yellow-900">{stats.submitted}</p>
                    <p className="text-sm text-yellow-700">Pending Review</p>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="text-2xl font-bold text-red-900">{stats.late}</p>
                    <p className="text-sm text-red-700">Late Submissions</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Loading State for Submissions */}
            {submissionsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-40 mb-4" />
                {[...Array(5)].map((_, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div>
                          <Skeleton className="h-5 w-32 mb-1" />
                          <Skeleton className="h-4 w-48" />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-6 w-16 rounded-full" />
                        <div className="text-right">
                          <Skeleton className="h-4 w-20 mb-1" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                        <Skeleton className="h-8 w-12" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Submissions List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                      Student Submissions ({testSubmissions.length})
                    </h3>
                  </div>

                  {testSubmissions.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <GraduationCap className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <h4 className="text-lg font-medium mb-2">No submissions yet</h4>
                      <p className="text-sm">Students haven&apos;t submitted this test yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {testSubmissions.map((submission) => {
                        const student = students.find(s => s.id === submission.studentId);
                        const percentage = submission.score && currentTest ? 
                          Math.round((submission.score / currentTest.totalPoints) * 100) : 0;

                        return (
                          <div
                            key={submission.id}
                            className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                  <User className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  {studentsLoading ? (
                                    <Skeleton className="h-5 w-32 mb-1" />
                                  ) : (
                                    <h4 className="font-medium text-gray-900">
                                      {student?.fullName || 'Unknown Student'}
                                    </h4>
                                  )}
                                  <p className="text-sm text-gray-500">
                                    {submission.submittedAt ? (
                                      <>
                                        Submitted: {formatDate(new Date(submission.submittedAt))} at{' '}
                                        {new Date(submission.submittedAt).toLocaleTimeString()}
                                      </>
                                    ) : (
                                      "No submission date recorded"
                                    )}
                                  </p>
                                  {student?.email && (
                                    <p className="text-xs text-gray-400">{student.email}</p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
                                  {submission.status.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                                </span>

                                <div className="text-right min-w-0">
                                  <p className="text-sm font-medium text-gray-900">
                                    {formatScore(submission.score || 0, currentTest.totalPoints)}
                                  </p>
                                  {submission.score !== null && submission.score !== undefined && (
                                    <div className="flex items-center gap-1 justify-end">
                                      <Star className="w-3 h-3 text-yellow-500 fill-current" />
                                      <span className="text-xs text-gray-500">
                                        {percentage}%
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <button
                                  onClick={() => viewSubmission(submission.studentId)}
                                  className="px-3 py-1 bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
                                >
                                  View
                                </button>
                              </div>
                            </div>

                            {submission.feedback && (
                              <div className="mt-3 p-3 bg-gray-50 rounded border-l-4 border-blue-500">
                                <p className="text-sm text-gray-700 font-medium mb-1">Instructor Feedback:</p>
                                <p className="text-sm text-gray-600">{submission.feedback}</p>
                              </div>
                            )}

                            {/* Time spent indicator */}
                            {submission.startedAt && submission.submittedAt && (
                              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                                <Clock className="w-3 h-3" />
                                <span>
                                  Time spent: {
                                    Math.round(
                                      (new Date(submission.submittedAt).getTime() - 
                                       new Date(submission.startedAt).getTime()) / (1000 * 60)
                                    )
                                  } minutes
                                </span>
                                {currentTest.timeLimit && (
                                  <span className="text-gray-400">
                                    / {currentTest.timeLimit} minutes allowed
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {testSubmissions.length > 0 && (
                <>
                  Showing {testSubmissions.length} submission{testSubmissions.length !== 1 ? 's' : ''}
                  {stats.graded > 0 && (
                    <span className="ml-2">
                      • Average: {Math.round(
                        testSubmissions
                          .filter(s => s.score !== null && s.score !== undefined)
                          .reduce((sum, s) => sum + (s.score || 0), 0) / 
                        testSubmissions.filter(s => s.score !== null && s.score !== undefined).length
                      )}%
                    </span>
                  )}
                </>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/dashboard/tutor-tests')}
                className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800 transition-colors"
              >
                Back to Tests
              </button>
              <button 
                onClick={exportResults}
                disabled={exportLoading || testSubmissions.length === 0}
                className="px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {exportLoading ? 'Exporting...' : 'Export Results'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
