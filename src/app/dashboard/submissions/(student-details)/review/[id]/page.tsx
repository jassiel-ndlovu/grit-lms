"use client";

import { useCourses } from "@/context/CourseContext";
import { useProfile } from "@/context/ProfileContext";
import { useSubmission } from "@/context/SubmissionContext";
import { useSubmissionEntries } from "@/context/SubmissionEntryContext";
import { $Enums } from "@/generated/prisma";
import { formatDate } from "@/lib/functions";
import { Download, Eye, FileText, MoveLeft, Upload, Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import SubmissionDetailsSkeleton from "../../../skeletons/review-skeleton";
import { useErrorPages } from "@/app/dashboard/components/error-pages";

interface SubmissionDetailsProps {
  params: Promise<{ id: string }>;
}

export default function SubmissionDetails({ params }: SubmissionDetailsProps) {
  const { id } = use(params);

  const { loading: courseLoading, fetchCoursesByIds } = useCourses();
  const { profile } = useProfile();
  const { loading: submissionLoading, fetchSubmissionById } = useSubmission();
  const { loading: entryLoading, fetchEntryByStudentIdSubId } = useSubmissionEntries();
  const router = useRouter();
  const { renderNotFoundPage } = useErrorPages();

  const studentProfile = profile as AppTypes.Student;

  const [canEdit, setCanEdit] = useState<boolean>(false);
  const [submission, setSubmission] = useState<AppTypes.Submission | null>(null);
  const [course, setCourse] = useState<AppTypes.Course | null>(null);
  const [entry, setEntry] = useState<AppTypes.SubmissionEntry | null>();

  // fetch submission
  useEffect(() => {
    if (!id) return;

    const fetch = async () => {
      const sub = (await fetchSubmissionById(id)) as AppTypes.Submission;

      setSubmission(sub);
    };
    fetch();
  }, [id, fetchSubmissionById]);

  // fetch submission entry for student
  useEffect(() => {
    if (!id || !studentProfile || !submission) return;

    const fetch = async () => {
      const subEntry = (await fetchEntryByStudentIdSubId(studentProfile.id, id)) as AppTypes.SubmissionEntry;

      // allow resubmission if within dueDate OR lastDueDate
      const now = new Date();
      const withinDue = now <= new Date(submission.dueDate);
      const withinLate = submission.lastDueDate ? now <= new Date(submission.lastDueDate) : false;

      setCanEdit((withinDue || withinLate));
      setEntry(subEntry);
    };
    fetch();
  }, [id, studentProfile, submission, fetchEntryByStudentIdSubId]);

  // fetch course
  useEffect(() => {
    if (!id || !submission) return;

    const fetch = async () => {
      const courses = (await fetchCoursesByIds([submission.courseId])) as AppTypes.Course[];
      setCourse(courses[0]);
    };
    fetch();
  }, [id, submission]);

  if (courseLoading || submissionLoading || entryLoading || !course || !submission || !studentProfile) {
    return <SubmissionDetailsSkeleton />;
  }

  if (!submission) {
    return renderNotFoundPage({
      resourceType: "submission",
      onRedirect: () => router.push("/dashboard/submissions"),
      redirectDelay: 5,
    });
  }

  return (
    <div className="h-full px-6 pt-6 pb-10 bg-gray-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/dashboard/submissions")}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center"
          >
            <MoveLeft className="w-5 h-5 mr-2" /> Back to Submissions
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {submission.title}
          </h1>
          <p className="text-gray-600 text-sm">
            {course.name}
          </p>
        </div>

        {/* Instructions */}
        {<div className="bg-white p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold mb-4">Instructions</h2>
          {submission.description && (
            <p className="text-gray-700 text-sm whitespace-pre-line mb-4">{submission.description}</p>
          )}

          {(submission.descriptionFiles as AppTypes.DescriptionFile[]).length > 0 && (
            <div className="space-y-2">
              {(submission.descriptionFiles as AppTypes.DescriptionFile[]).map((file, i) => (
                <a
                  key={i}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-blue-600 hover:underline"
                >
                  <Paperclip className="w-4 h-4 mr-2" />
                  {file.title}
                </a>
              ))}
            </div>
          )}
        </div>}
        {canEdit && !entry && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => router.push(`/dashboard/submissions/${submission.id}`)}
              className="px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 flex items-center"
            >
              <Upload className="w-4 h-4 mr-2" />
              Submit
            </button>
          </div>
        )}

        {/* Submission Info */}
        {entry && (
          <div className="bg-white p-6 border border-gray-200 mb-6">
            <h2 className="text-lg font-semibold mb-4">Submission Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Due Date</p>
                <p className="text-gray-900 text-sm">{formatDate(submission.dueDate)}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Submitted</p>
                <p className="text-gray-900 text-sm">{formatDate(entry.submittedAt)}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Status</p>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${entry.status === $Enums.SubmissionStatus.GRADED
                      ? "bg-green-100 text-green-800"
                      : entry.status === $Enums.SubmissionStatus.LATE
                        ? "bg-orange-100 text-orange-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                >
                  {entry.status.replace("_", " ")}
                </span>
              </div>

              {entry.grade !== undefined && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Grade</p>
                  {entry.grade ? (
                    <p className="text-2xl font-bold text-green-600">{entry.grade}%</p>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-200">
                      Not Graded
                    </span>
                  )}
                </div>
              )}
            </div>

            {canEdit && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => router.push(`/dashboard/submissions/${submission.id}`)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 flex items-center"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Resubmit
                </button>
              </div>
            )}
          </div>
        )}

        {/* Submitted Files */}
        {entry && entry.fileUrl.length > 0 && (
          <div className="bg-white p-6 border border-gray-200 mb-6">
            <h2 className="text-lg font-semibold mb-4">Submitted Files</h2>
            {entry.fileUrl.map((link, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-2"
              >
                <div className="flex items-center">
                  <FileText className="w-8 h-8 text-gray-400 mr-4" />
                  <div>
                    <p className="font-medium text-gray-900">{link.split("/").pop()}</p>
                    <p className="text-sm text-gray-500">Submitted on {formatDate(entry.submittedAt)}</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-600 hover:text-gray-800"
                  >
                    <Eye className="w-5 h-5" />
                  </a>
                  <a
                    href={link}
                    download
                    className="p-2 text-gray-600 hover:text-gray-800"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Feedback */}
        {entry && entry.feedback && (
          <div className="bg-white p-6 shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">Instructor Feedback</h2>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-gray-700 text-sm">{entry.feedback}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
