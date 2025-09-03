import { $Enums } from "@/generated/prisma";
import { AlertCircle, Calendar, CheckCircle, Clock, FileText, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCourses } from "@/context/CourseContext";
import { useSubmission } from "@/context/SubmissionContext";
import { useRouter } from "next/navigation";

interface StudentSubmissionsPageProps {
  studentId: string;
}

export default function StudentSubmissionsPage({ studentId }: StudentSubmissionsPageProps) {
  const { loading: coursesLoading, fetchCoursesByStudentId } = useCourses();
  const { loading: submissionLoading, fetchSubmissionsByStudentId } = useSubmission();
  const router = useRouter();

  const [submissions, setSubmissions] = useState<AppTypes.Submission[]>([]);
  const [courses, setCourses] = useState<AppTypes.Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  // fetch courses
  useEffect(() => {
    if (!studentId) return;

    const fetch = async () => {
      setLoading(true);

      const studentCourses = await fetchCoursesByStudentId(studentId) as AppTypes.Course[];

      setCourses(studentCourses);

      setLoading(false);
    };

    fetch();
  }, [studentId, fetchCoursesByStudentId]);

  // fetch submissions
  useEffect(() => {
    if (!studentId) return;

    const fetch = async () => {
      setLoading(true);

      const subs = await fetchSubmissionsByStudentId(studentId) as AppTypes.Submission[];

      setSubmissions(subs);

      setLoading(false);
    }

    fetch();
  }, [studentId, fetchSubmissionsByStudentId]);

  const filteredSubmissions = useMemo(() => {
    if (selectedCourse === 'all') return submissions;
    return submissions.filter(sub => sub.courseId === selectedCourse);
  }, [submissions, selectedCourse]);

  const getSubmissionStatus = (submission: AppTypes.Submission): AppTypes.SubmissionStatus => {
    const entry = submission.entries.find(e => e.studentId === studentId);
    if (!entry) {
      return new Date() > submission.dueDate
        ? $Enums.SubmissionStatus.NOT_SUBMITTED
        : $Enums.SubmissionStatus.NOT_STARTED;
    }
    return entry.status;
  };

  const getStatusIcon = (status: $Enums.SubmissionStatus) => {
    switch (status) {
      case $Enums.SubmissionStatus.SUBMITTED:
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
      case $Enums.SubmissionStatus.GRADED:
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case $Enums.SubmissionStatus.LATE:
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case $Enums.SubmissionStatus.NOT_SUBMITTED:
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: $Enums.SubmissionStatus) => {
    switch (status) {
      case $Enums.SubmissionStatus.SUBMITTED:
        return 'bg-blue-100 text-blue-800';
      case $Enums.SubmissionStatus.GRADED:
        return 'bg-green-100 text-green-800';
      case $Enums.SubmissionStatus.LATE:
        return 'bg-orange-100 text-orange-800';
      case $Enums.SubmissionStatus.NOT_SUBMITTED:
        return 'bg-red-100 text-red-800';
      case $Enums.SubmissionStatus.IN_PROGRESS:
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSubmissionClick = (submission: AppTypes.Submission) => {
    router.push(`/dashboard/submissions/review/${submission.id}`);
  };

  return (
    <div className="h-full px-6 pt-6 pb-10 bg-gray-50 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">My Submissions</h1>
        <p className="text-gray-600 text-sm">
          Track and manage your assignment submissions
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="px-4 py-2 border border-gray-300 text-sm focus:ring-2 focus:outline-none focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Courses</option>
          {courses.map(course => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </select>
      </div>

      {/* Submissions Grid */}
      {loading || coursesLoading || submissionLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 animate-pulse">
              <div className="h-4 w-3/4 bg-gray-200 rounded mb-3"></div>
              <div className="h-3 w-1/2 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 w-2/3 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No submissions found
          </h3>
          <p className="text-gray-500 text-sm">
            {selectedCourse === 'all'
              ? "You don't have any assignments yet"
              : "No assignments found for the selected course"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSubmissions.map(submission => {
            const status = getSubmissionStatus(submission);
            const entry = submission.entries.find(e => e.studentId === studentId);
            const isOverdue = new Date() > submission.dueDate && !entry;

            return (
              <div
                key={submission.id}
                onClick={() => handleSubmissionClick(submission)}
                className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                      {submission.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {courses.find(c => c.id = submission.courseId)?.name}
                    </p>
                  </div>
                  {getStatusIcon(status)}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    Due: {(new Date(submission.dueDate)).toLocaleDateString()}
                  </div>

                  {entry?.submittedAt && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      Submitted: {(new Date(entry.submittedAt)).toLocaleDateString()}
                    </div>
                  )}

                  {/* {entry?.grade !== undefined && (
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="font-medium">Grade: {entry.grade}%</span>
                    </div>
                  )} */}
                  Bug Fix in Progress
                </div>

                <div className="flex justify-between items-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                    {status.replace('_', ' ')}
                  </span>

                  {isOverdue && (
                    <span className="text-xs text-red-500 font-medium">
                      Overdue
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
