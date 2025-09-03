import { $Enums } from "@/generated/prisma";
import { AlertCircle, CheckCircle, FileText, Plus, Search, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import SubmissionForm from "./models/submission-form";
import SubmissionDetailTutor from "./models/submission-details-tutor";
import { TutorSubmissionsTableSkeleton } from "./skeletons/tutor-submissions-skeletons";
import SubmissionActionsMenu from "./models/actions-menu";
import { useCourses } from "@/context/CourseContext";
import { useSubmission } from "@/context/SubmissionContext";
import { formatDate } from "@/lib/functions";

interface TutorSubmissionsPageProps {
  tutorId: string;
}

export default function TutorSubmissionsPage({ tutorId }: TutorSubmissionsPageProps) {
  const { loading: coursesLoading, fetchCoursesByTutorId } = useCourses();
  const { loading: submissionLoading, fetchSubmissionsByTutorId, createSubmission } = useSubmission();

  const [submissions, setSubmissions] = useState<AppTypes.Submission[]>([]);
  const [courses, setCourses] = useState<AppTypes.Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'detail'>('list');
  const [selectedSubmission, setSelectedSubmission] = useState<AppTypes.Submission | null>(null);

  // fetch courses
  useEffect(() => {
    if (!tutorId) return;

    const fetchData = async () => {
      const tutorCourses = (await fetchCoursesByTutorId(tutorId)) as AppTypes.Course[];

      setCourses(tutorCourses);
    };

    fetchData();
  }, [tutorId, fetchCoursesByTutorId]);

  // fetch submissions
  useEffect(() => {
    if (!tutorId) return;

    const fetch = async () => {
      const subs = await fetchSubmissionsByTutorId(tutorId) as AppTypes.Submission[];
      setSubmissions(subs);
    }

    fetch();
  }, [tutorId, fetchSubmissionsByTutorId]);

  const filteredSubmissions = useMemo(() => {
    let filtered = submissions;

    // Filter by course
    if (selectedCourse !== 'all') {
      filtered = filtered.filter(sub => sub.courseId === selectedCourse);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(sub =>
        sub.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.courseId.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(sub => {
        const hasStatus = sub.entries.some(entry => entry.status === statusFilter);
        if (statusFilter === 'not_submitted') {
          return sub.entries.length === 0 || !hasStatus;
        }
        return hasStatus;
      });
    }

    return filtered;
  }, [submissions, selectedCourse, searchTerm, statusFilter]);

  const getSubmissionStats = (submission: AppTypes.Submission) => {
    const course = courses.filter((c) => c.id === submission.courseId);

    const totalStudents = course[0].students?.length || 0;
    const submittedCount = submission.entries.length;
    const gradedCount = NaN;//submission.entries.filter(e => e.grade !== undefined).length;
    const lateCount = submission.entries.filter(e => e.status === $Enums.SubmissionStatus.LATE).length;

    return { totalStudents, submittedCount, gradedCount, lateCount };
  };

  const handleSave = async (submission: Partial<AppTypes.Submission>) => {
    if (!submission) alert("Invalid Submission created");

    await createSubmission(submission.courseId as string, submission);
    setView('list');
  }

  const handleCreateSubmission = () => {
    setSelectedSubmission(null);
    setView('create');
  };

  const handleEditSubmission = (submission: AppTypes.Submission) => {
    setSelectedSubmission(submission);
    setView('edit');
  };

  const handleViewDetails = (submission: AppTypes.Submission) => {
    setSelectedSubmission(submission);
    setView('detail');
  };

  const handleDeleteSubmission = async (submissionId: string) => {
    if (confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
      // API call to delete submission
      setSubmissions(prev => prev.filter(sub => sub.id !== submissionId));
    }
  };

  const handleDuplicateSubmission = (submission: AppTypes.Submission) => {
    const duplicated: AppTypes.Submission = {
      ...submission,
      id: `${submission.id}_copy_${Date.now()}`,
      title: `${submission.title} (Copy)`,
      entries: [],
    };
    setSubmissions(prev => [duplicated, ...prev]);
  };

  if (view === 'create' || view === 'edit') {
    return (
      <SubmissionForm
        loading={submissionLoading}
        courses={courses}
        submission={selectedSubmission}
        isEditing={view === 'edit'}
        onSave={handleSave}
        onCancel={() => setView('list')}
      />
    );
  }

  if (view === 'detail' && selectedSubmission) {
    return (
      <SubmissionDetailTutor
        courseName={courses.find(c => c.id === selectedSubmission.courseId)?.name ?? "Unknown Course Name"}
        submission={selectedSubmission}
        onBack={() => setView('list')}
        onEdit={() => setView('edit')}
        onDelete={() => {
          handleDeleteSubmission(selectedSubmission.id);
          setView('list');
        }}
      />
    );
  }

  return (
    <div className="h-full px-6 pt-6 pb-10 bg-gray-50 overflow-y-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Manage Submissions
          </h1>
          <p className="text-gray-600 text-sm">
            Create and manage assignments for your courses
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
              placeholder="Search submissions..."
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
            <option value="submitted">Submitted</option>
            <option value="graded">Graded</option>
            <option value="late">Late</option>
            <option value="not_submitted">Not Submitted</option>
          </select>
        </div>
        <button
          onClick={handleCreateSubmission}
          className="px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Submission
        </button>
      </div>

      {/* Submissions Table */}
      {coursesLoading || submissionLoading ? (
        <TutorSubmissionsTableSkeleton />
      ): (!filteredSubmissions.length || !courses.length) ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No submissions found
          </h3>
          <p className="text-gray-500 text-sm mb-4">
            {searchTerm || statusFilter !== 'all' || selectedCourse !== 'all'
              ? "Try adjusting your filters"
              : "Create your first submission to get started"}
          </p>
          {(!searchTerm && statusFilter === 'all' && selectedCourse === 'all') && (
            <button
              onClick={handleCreateSubmission}
              className="px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 flex items-center gap-2 mx-auto"
            >
              <Plus className="w-4 h-4" />
              Create First Submission
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assignment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
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
                {filteredSubmissions.map(submission => {
                  const stats = getSubmissionStats(submission);
                  const isOverdue = new Date() > submission.dueDate;
                  const completionRate = stats.totalStudents > 0
                    ? Math.round((stats.submittedCount / stats.totalStudents) * 100)
                    : 0;

                  return (
                    <tr key={submission.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {submission.title}
                          </div>
                          <div className="text-sm text-gray-500">
                            Created {(new Date(submission.createdAt)).toLocaleDateString()}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{courses.filter(c => c.id === submission.courseId)[0].name}</div>
                        <div className="text-sm text-gray-500">
                          {stats.totalStudents} students
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(submission.dueDate)}
                        </div>
                        <div className={`text-sm ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
                          {isOverdue ? 'Overdue' : 'Active'}
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
                        <div className="flex items-center space-x-2">
                          {stats.gradedCount > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {stats.gradedCount} graded
                            </span>
                          )}
                          {stats.lateCount > 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              {stats.lateCount} late
                            </span>
                          )}
                          {stats.submittedCount === 0 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              <XCircle className="w-3 h-3 mr-1" />
                              No submissions
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <SubmissionActionsMenu
                          onView={() => handleViewDetails(submission)}
                          onEdit={() => handleEditSubmission(submission)}
                          onDelete={() => handleDeleteSubmission(submission.id)}
                          onDuplicate={() => handleDuplicateSubmission(submission)}
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
    </div>
  );
}