/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { useCourses } from "@/context/CourseContext";
import { useProfile } from "@/context/ProfileContext";
import { useSubmission } from "@/context/SubmissionContext";
import { useSubmissionEntries } from "@/context/SubmissionEntryContext";
import { Calendar, FileText, MoveLeft, Plus, Trash2, Upload } from "lucide-react";
import { use, useEffect, useState } from "react";
import SubmissionUploadSkeleton from "../../skeletons/portal-skeleton";
import { useRouter } from "next/navigation";
import { Dialog, useDialog } from "@/app/dashboard/components/pop-up";
import { uploadFile } from "@/lib/blob";
import { useErrorPages } from "@/app/dashboard/components/error-pages";

// submission id
interface SubmissionPortalProps {
  params: Promise<{ id: string }>;
}

export default function SubmissionPortal({ params }: SubmissionPortalProps) {
  const { id } = use(params);

  const { loading: submissionLoading, fetchSubmissionById } = useSubmission();
  const { loading: entryLoading, fetchEntryByStudentIdSubId, createEntry, updateEntry } = useSubmissionEntries();
  const { loading: courseLoading, fetchCoursesByIds } = useCourses();
  const { profile } = useProfile();
  const router = useRouter();
  const { showDialog, hideDialog, dialogState } = useDialog();
  const { renderNotFoundPage, renderAccessDeniedPage } = useErrorPages();

  const studentProfile = profile as AppTypes.Student;

  // useStates
  const [submission, setSubmission] = useState<AppTypes.Submission | null>(null);
  const [submissionEntry, setSubmissionEntry] = useState<AppTypes.SubmissionEntry | null>(null);
  const [course, setCourse] = useState<AppTypes.Course | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // first find submission
  useEffect(() => {
    if (!id) return;

    const fetch = async () => {
      const sub = await fetchSubmissionById(id) as AppTypes.Submission;

      setSubmission(sub);
    }

    fetch();
  }, [id, fetchSubmissionById]);

  // then find submission entry, if it exists
  useEffect(() => {
    if (!id || !studentProfile) return;

    const fetch = async () => {
      const entry = await fetchEntryByStudentIdSubId(studentProfile.id, id) as AppTypes.SubmissionEntry;

      setSubmissionEntry(entry);
    }

    fetch();
  }, [id, studentProfile, fetchEntryByStudentIdSubId]);

  // also find the course for the course name
  useEffect(() => {
    if (!id || !submission) return;

    const fetch = async () => {
      const courses = await fetchCoursesByIds([submission.courseId]) as AppTypes.Course[];

      setCourse(courses[0]);
    }

    fetch();
  }, [id, submission]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      setUploadedFiles(prev => [...prev, ...files]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setUploadedFiles(prev => [...prev, ...files]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      let uploadedUrls: string[] = [];

      // Upload all files from uploadedFiles state
      if (uploadedFiles.length > 0) {
        const uploads = await Promise.all(
          uploadedFiles.map(async (file) => {
            const url = await uploadFile(file);
            return url;
          })
        );
        uploadedUrls = uploads;
      }

      if (submissionEntry) {
        console.log("Submission Entry exists", submissionEntry);
        // Update existing entry
        await updateEntry(submissionEntry.id, {
          submittedAt: new Date(),
          status: "SUBMITTED",
          attemptNumber: submissionEntry.attemptNumber + 1,
          fileUrl: uploadedUrls,
        });
      } else {
        // Create a new submission entry
        await createEntry({
          studentId: (profile as AppTypes.Student).id,
          submissionId: (submission as AppTypes.Submission).id,
          submittedAt: new Date(),
          status: "SUBMITTED",
          attemptNumber: 1,
          fileUrl: uploadedUrls,
          feedback: "",
          grade: null,
        });
      }

      // Clear uploaded files after successful submission
      setUploadedFiles([]);

      showDialog({
        type: "success",
        title: "Success!",
        message: "Your operation completed successfully.",
        onConfirm: () => router.push(`/dashboard/submissions/review/${(submission as AppTypes.Submission).id}`),
      });
    } catch (err: any) {
      console.error(err);
      showDialog({
        type: "error",
        title: "Error",
        message: err.message || "Something went wrong.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getAcceptedFileTypes = (submission: AppTypes.Submission) => {
    return [
      ...submission.fileType.split(',').map(type => {
        switch (type.trim()) {
          case 'PDF': return '.pdf';
          case 'DOCX': return '.docx,.doc';
          case 'ZIP': return '.zip';
          case 'JPEG': return '.jpg,.jpeg';
          default: return '';
        }
      }),
      "application/zip",
    ].join(",");
  }

  if (courseLoading || entryLoading || submissionLoading || !submission || !course) {
    return <SubmissionUploadSkeleton />
  }

  if (!submission) {
    return renderNotFoundPage({
      resourceType: "submission",
      onRedirect: () => router.push("/dashboard/submissions"),
      redirectDelay: 5,
    });
  }

  if (new Date() > new Date(submission.dueDate)) {
    return renderAccessDeniedPage({
      reason: "This submission portal is closed. No further submissions are accepted",
      resourceType: "submission",
      onGoBack: () => router.push(`/dashboard/submissions/review/${submission.id}`)
    })
  }

  return (
    <>
      <Dialog
        isOpen={dialogState.isOpen}
        onClose={hideDialog}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        showCancel={dialogState.showCancel}
        autoClose={dialogState.autoClose}
        onConfirm={dialogState.onConfirm}
        onCancel={dialogState.onCancel}
      />
      <div className="h-full px-6 pt-6 pb-10 bg-gray-50 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.push("/dashboard/submissions")}
              className="text-blue-600 hover:text-blue-800 mb-4 flex items-center"
            >
              <MoveLeft className="w-5 h-5 mr-2" />Back to Submissions
            </button>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{submission.title}</h1>
            <p className="text-gray-600 text-sm font-bold">
              {course.name}
            </p>
            <div className="flex items-center mt-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4 mr-2" />
              Due: {(new Date(submission.dueDate)).toLocaleDateString()}
            </div>
          </div>

          {/* Upload Area */}
          <div className="bg-white p-8 border border-gray-200 mb-6">
            <h2 className="text-lg font-semibold mb-6">
              Upload Your Submission
            </h2>

            <div
              className={`border border-dashed rounded-lg p-8 text-center transition-colors ${dragActive
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
                }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="font-medium text-gray-700 mb-2">
                Drop files here or click to browse
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Accepted formats: {`submission.fileType, .ZIP`}
              </p>
              <input
                type="file"
                multiple
                accept={getAcceptedFileTypes(submission)}
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="text-sm inline-flex items-center px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-2" />
                Choose Files
              </label>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mt-6">
                <h3 className="font-medium text-sm text-gray-900 mb-3">Uploaded Files</h3>
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{file.name}</p>
                          <p className="text-sm text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="mt-8 flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={uploadedFiles.length === 0 || submitting}
                className="px-6 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Submit Assignment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}