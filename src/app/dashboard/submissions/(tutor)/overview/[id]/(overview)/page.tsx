/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useCourses } from "@/context/CourseContext";
import { useSubmission } from "@/context/SubmissionContext";
import { useSubmissionEntries } from "@/context/SubmissionEntryContext";
import { $Enums } from "@/generated/prisma";
import { formatDate } from "@/lib/functions";
import { AlertCircle, Calendar, CheckCircle, Download, Edit3, Eye, FileText, ArrowLeft, Trash2, Users, ChevronRight } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import OverviewSkeleton from "../../../../skeletons/overview-skeleton";
import ActionsMenu from "../../../../models/actions-menu";

type Stats = {
  totalStudents: number;
  submittedCount: number;
  gradedCount: number;
  lateCount: number;
}

export default function SubmissionDetailTutor() {
  // ID
  const { id } = useParams();

  // Contexts
  const { loading: courseLoading, fetchCoursesByIds } = useCourses();
  const { loading: submissionLoading, fetchSubmissionById, deleteSubmission } = useSubmission();
  const { loading: entriesLoading, fetchEntriesBySubmissionId, deleteEntry } = useSubmissionEntries();
  const router = useRouter();

  // States
  const [stats, setStats] = useState<Stats | object>({});
  const [course, setCourse] = useState<AppTypes.Course | null>(null);
  const [submission, setSubmission] = useState<AppTypes.Submission | null>(null);
  const [entries, setEntries] = useState<AppTypes.SubmissionEntry[]>([]);

  // Fetch submission
  useEffect(() => {
    if (!id) return;
    (async () => {
      const sub = await fetchSubmissionById(id as string) as AppTypes.Submission;
      setSubmission(sub);
    })();
  }, [id, fetchSubmissionById]);

  // fetch course and entries
  useEffect(() => {
    if (!submission) return;
    (async () => {
      const courses = await fetchCoursesByIds([submission.courseId]) as AppTypes.Course[];
      setCourse(courses[0]);
      const ents = await fetchEntriesBySubmissionId(submission.id) as AppTypes.SubmissionEntry[];
      setEntries(ents);
      // Calculate stats
      const totalStudents = courses[0]?.students.length || 0;
      const submittedCount = ents.length;
      const gradedCount = ents.filter(entry => entry.status === $Enums.SubmissionStatus.GRADED).length;
      const lateCount = ents.filter(entry => entry.status === $Enums.SubmissionStatus.LATE).length;
      setStats({ totalStudents, submittedCount, gradedCount, lateCount });
    })();
  }, [submission, fetchCoursesByIds, fetchEntriesBySubmissionId]);

  // helper functions
  const averageGrade = (stats as Stats).gradedCount > 0
    ? Math.round(entries.reduce((sum, entry) => sum + (0 || 0), 0) / (stats as Stats).gradedCount)
    : 0;

  const handleDeleteSubmission = async () => {
    if (confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
      if (!submission) return;
      await deleteSubmission(submission.id);
      router.push('/dashboard/submissions');
    }
  };

  const handleEditSubmission = () => {
    if (!submission) return;
    router.push(`/dashboard/submissions/create/${submission.id}`);
  }

  const handleViewDetails = (studentId: string) => {
    if (!submission) return;
    router.push(`/dashboard/submissions/overview/${submission.id}/${studentId}`);
  }

  const handleDeleteSubmissionEntry = async (entryId: string) => {
    if (confirm('Are you sure you want to delete this submission entry? This action cannot be undone.')) {
      if (!entryId) return;
      await deleteEntry(entryId);
      setEntries(prev => prev.filter(entry => entry.id !== entryId));
    }
  };

  if (!submission || !course || courseLoading || submissionLoading || entriesLoading) {
    return <OverviewSkeleton />;
  }

  return (
    <div className="h-full px-6 pt-4 pb-10 bg-gray-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {submission.title}
              </h1>
              <p className="text-gray-600 text-sm font-bold">
                {course.name}
              </p>
              <div className="flex items-center mt-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4 mr-2" />
                Due: {formatDate(submission.dueDate)}
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleEditSubmission}
                className="px-4 py-2 text-white text-sm bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={handleDeleteSubmission}
                className="px-4 py-2 text-red-600 text-sm border border-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{(stats as Stats).totalStudents}</p>
                <p className="text-sm text-gray-600">Total Students</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{(stats as Stats).submittedCount}</p>
                <p className="text-sm text-gray-600">Submitted</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{(stats as Stats).gradedCount}</p>
                <p className="text-sm text-gray-600">Graded</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <AlertCircle className="w-8 h-8 text-orange-500" />
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{(stats as Stats).lateCount}</p>
                <p className="text-sm text-gray-600">Late Submissions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Submission Info */}
        <div className="bg-white p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            Submission Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">
                Accepted File Types
              </p>
              <p className="text-gray-900 text-sm">
                {submission.fileType}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">
                Created
              </p>
              <p className="text-gray-900 text-sm">{formatDate(submission.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">
                Average Grade
              </p>
              <p className="text-gray-900 text-sm">
                {(stats as Stats).gradedCount > 0 ? `${averageGrade}%` : 'Not available'}
              </p>
            </div>
          </div>
        </div>

        {/* Student Submissions */}
        <div className="bg-white border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold">
              Student Submissions
            </h2>
          </div>

          {entries.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions yet</h3>
              <p className="text-gray-500 text-sm">Students haven&apos;t submitted their work yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Grade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {entries.map(
                    entry => {
                      const actions = [
                        { 
                          label: "View Details", 
                          icon: <ChevronRight className="w-4 h-4" />, 
                          onClick: () => handleViewDetails(entry.studentId) 
                        },
                        { 
                          label: "Delete Entry", 
                          icon: <Trash2 className="w-4 h-4" />, 
                          onClick: () => handleDeleteSubmissionEntry(entry.id), 
                          danger: true 
                        },
                      ];
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {entry.student.fullName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {entry.student.email}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(entry.submittedAt)}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${entry.status === $Enums.SubmissionStatus.GRADED
                              ? 'bg-green-100 text-green-800'
                              : entry.status === $Enums.SubmissionStatus.LATE
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-blue-100 text-blue-800'
                              }`}>
                              {entry.status.replace('_', ' ')}
                            </span>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {entry.grade ? `${entry.grade}%` : 'Not graded'}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <ActionsMenu title="Submission Entry Actions" actions={actions} />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}