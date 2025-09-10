"use client";

import LessonMarkdown from "@/app/components/markdown";
import { useCourses } from "@/context/CourseContext";
import { useProfile } from "@/context/ProfileContext";
import { useSubmission } from "@/context/SubmissionContext";
import { useEvents } from "@/context/EventContext";
import { $Enums } from "@/generated/prisma";
import { uploadFile } from "@/lib/blob";
import { formatDate, formatForDateTimeLocal, parseDateTimeLocal } from "@/lib/functions";
import { ArrowLeft, Download, EyeOff } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useMemo } from "react";
import SubmissionFormSkeleton from "../../../skeletons/submission-form-skeleton";

type MaxAttemptOptions = "Limited" | "Unlimited";

export default function SubmissionForm() {
  const { id } = useParams();
  const [isEditing, setIsEditing] = useState<boolean>(false);

  useMemo(() => {
    if (id) {
      setIsEditing(true);
    } else {
      setIsEditing(false);
    }
  }, [id]);

  // Contexts
  const { loading: coursesLoading, fetchCoursesByTutorId } = useCourses();
  const { 
    loading: submissionLoading, 
    fetchSubmissionById, 
    createSubmission, 
    updateSubmission 
  } = useSubmission();
  const { createEvent } = useEvents();
  const { profile } = useProfile();
  const router = useRouter();

  // States
  const [formData, setFormData] = useState<Partial<AppTypes.Submission>>({
    title: "",
    description: "",
    descriptionFiles: [],
    courseId: "",
    fileType: "PDF",
    dueDate: new Date(),
    lastDueDate: new Date(),
    maxAttempts: 1,
    totalPoints: 1,
    isActive: true,
  });

  const [maxAttemptsOption, setMaxAttemptsOption] = useState<MaxAttemptOptions>(
    formData.maxAttempts === null ? "Unlimited" : "Limited"
  );
  const [courses, setCourses] = useState<AppTypes.Course[]>([]);
  const [submission, setSubmission] = useState<AppTypes.Submission | null>(null);
  const [maxAttempts, setMaxAttempts] = useState<number>(formData.maxAttempts || 1);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // fetch courses
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const courses = await fetchCoursesByTutorId(profile.id) as AppTypes.Course[];
      setCourses(courses);
    })();
  }, [profile, fetchCoursesByTutorId]);

  // fetch submission if editing
  useEffect(() => {
    if (!id) return;

    (async () => {
      const sub = await fetchSubmissionById(id as string) as AppTypes.Submission;
      setSubmission(sub);
      setFormData({
        title: sub.title,
        description: sub.description,
        descriptionFiles: sub.descriptionFiles || [],
        courseId: sub.courseId,
        fileType: sub.fileType,
        dueDate: sub.dueDate,
        lastDueDate: sub.lastDueDate || undefined,
        maxAttempts: sub.maxAttempts,
        totalPoints: sub.totalPoints,
        isActive: sub.isActive,
      });
      setMaxAttempts(sub.maxAttempts || 1);
      setMaxAttemptsOption(sub.maxAttempts === null ? "Unlimited" : "Limited");
    })();
  }, [id, fetchSubmissionById]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!(formData.title as string)?.trim()) newErrors.title = "Title is required";
    if (!formData.description) newErrors.description = "Description is required";
    if (!formData.courseId) newErrors.courseId = "Course is required";
    if (!formData.dueDate) newErrors.dueDate = "Due date is required";
    if (!formData.totalPoints || formData.totalPoints < 1) newErrors.totalPoints = "Total points must be at least 1";
    if (maxAttemptsOption === "Limited" && (!formData.maxAttempts || formData.maxAttempts < 1)) {
      newErrors.maxAttempts = "Max attempts must be at least 1";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsUploading(true);

    try {
      // Upload files and get their URLs
      const uploadedFileUrls = await Promise.all(
        files.map(async (file) => {
          try {
            const url = await uploadFile(file);
            return url;
          } catch (error) {
            console.error(`Failed to upload file ${file.name}:`, error);
            return null;
          }
        })
      );

      // Filter out failed uploads
      const successfulUploads = uploadedFileUrls.filter(url => url !== null) as string[];

      // Combine with existing files if editing
      const allDescriptionFiles = [
        ...(formData.descriptionFiles || []),
        ...successfulUploads
      ];

      const submissionData: Partial<AppTypes.Submission> = {
        title: formData.title as string,
        description: formData.description as string,
        descriptionFiles: allDescriptionFiles,
        fileType: formData.fileType as $Enums.FileType,
        courseId: formData.courseId as string,
        totalPoints: formData.totalPoints as number,
        isActive: formData.isActive,
        maxAttempts: maxAttemptsOption === "Limited" ? maxAttempts : null,
        dueDate: new Date(formData.dueDate as Date),
        lastDueDate: formData.lastDueDate ? new Date(formData.lastDueDate as Date) : null,
      };

      if (isEditing && submission) {
        // Update existing submission
        await updateSubmission(submission.id, submissionData);
        
        // Update event if needed
        await createEvent(formData.courseId ?? "", {
          title: `${formData.title} (Updated)`,
          courseId: formData.courseId,
          date: new Date(),
          description: `Submission "${formData.title}" has been updated. Due on ${formData.dueDate ? formatDate(formData.dueDate) : ""}.`,
          type: $Enums.EventType.SUBMISSION,
          link: `/dashboard/submissions/${submission.id}`
        });
      } else {
        // Create new submission
        const newSubmission = await createSubmission(formData.courseId as string, submissionData);
        
        // Create event for new submission
        if (newSubmission) {
          await createEvent(formData.courseId ?? "", {
            title: formData.title as string,
            courseId: formData.courseId as string,
            date: formData.dueDate as Date,
            description: `New submission "${formData.title}" created. Due on ${formData.dueDate ? formatDate(formData.dueDate) : ""}.`,
            type: $Enums.EventType.SUBMISSION,
            link: `/dashboard/submissions/${newSubmission.id}`
          });
        }
      }

      router.push("/dashboard/submissions");
    } catch (error) {
      console.error("Error saving submission:", error);
      setErrors({ submit: "Failed to save submission. Please try again." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selectedFiles]);
    e.target.value = ''; // Reset input
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeUploadedFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      descriptionFiles: (prev.descriptionFiles || []).filter((_, i) => i !== index)
    }));
  };

  const toggleActiveStatus = () => {
    setFormData(prev => ({
      ...prev,
      isActive: !prev.isActive
    }));
  };

  const fileTypeOptions = [
    { value: "PDF", label: "PDF only" },
    { value: "DOCX", label: "Word documents only" },
    { value: "PDF,DOCX", label: "PDF and Word documents" },
    { value: "PDF,DOCX,ZIP", label: "PDF, Word, and ZIP files" },
    { value: "PDF,DOCX,ZIP,JPEG", label: "All supported formats" }
  ];

  if (coursesLoading || submissionLoading) {
    return <SubmissionFormSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/submissions"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Submissions
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {isEditing ? "Edit Submission" : "Create New Submission"}
              </h1>
              <p className="text-gray-600">
                {isEditing ? "Update submission details" : "Set up a new assignment for your students"}
              </p>
            </div>
            
            {/* Active/Inactive Toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">
                {formData.isActive ? 'Active' : 'Draft'}
              </span>
              <button
                type="button"
                onClick={toggleActiveStatus}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.isActive ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  formData.isActive ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        {!formData.isActive && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <EyeOff className="w-5 h-5 text-yellow-600 mr-2" />
              <p className="text-yellow-800 text-sm">
                This submission is currently in draft mode and won&apos;t be visible to students.
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assignment Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                className={`w-full px-3 py-2 border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.title ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Enter assignment title..."
              />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
            </div>

            {/* Description with Markdown support */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                className={`w-full px-3 py-2 border text-sm font-mono rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.description ? "border-red-500" : "border-gray-300"
                }`}
                rows={4}
                placeholder="Enter assignment description or instructions (Markdown supported)..."
              />
              {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}

              {/* Markdown Preview */}
              {formData.description && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg border">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preview:</label>
                  <div className="text-sm">
                    <LessonMarkdown content={formData.description} />
                  </div>
                </div>
              )}
            </div>

            {/* Total Points */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Points *
              </label>
              <input
                type="number"
                min={1}
                value={formData.totalPoints}
                onChange={(e) => setFormData((prev) => ({ ...prev, totalPoints: Number(e.target.value) }))}
                className={`w-full px-3 py-2 border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.totalPoints ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="Enter total points..."
              />
              {errors.totalPoints && <p className="mt-1 text-sm text-red-600">{errors.totalPoints}</p>}
            </div>

            {/* Description Files */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Instruction Files (Optional)
              </label>

              {/* Existing uploaded files */}
              {(formData.descriptionFiles && formData.descriptionFiles.length > 0) && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Existing Files:</h4>
                  <div className="flex flex-wrap gap-2">
                    {formData.descriptionFiles.map((fileUrl, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                      >
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          File {index + 1}
                        </a>
                        <button
                          type="button"
                          onClick={() => removeUploadedFile(index)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Dropzone for new files */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  ref={fileInputRef}
                />
                <div className="text-gray-500">
                  <p className="text-sm">Drop files here or click to browse</p>
                  <p className="text-xs text-gray-400 mt-1">Files will be uploaded and available to students</p>
                </div>
              </div>

              {/* New files to be uploaded */}
              {files.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Files to upload:</h4>
                  <div className="flex flex-wrap gap-2">
                    {files.map((file, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {file.name}
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Course Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Course *
              </label>
              <select
                value={formData.courseId}
                onChange={(e) => setFormData(prev => ({ ...prev, courseId: e.target.value }))}
                className={`w-full px-3 py-2 border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.courseId ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select a course...</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
              {errors.courseId && <p className="mt-1 text-sm text-red-600">{errors.courseId}</p>}
            </div>

            {/* File Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Accepted File Types
              </label>
              <select
                value={formData.fileType}
                onChange={(e) => setFormData((prev) => ({ ...prev, fileType: e.target.value as $Enums.FileType }))}
                className="w-full px-3 py-2 border border-gray-300 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {fileTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Due Date *</label>
              <input
                type="datetime-local"
                value={formData.dueDate ? formatForDateTimeLocal(new Date(formData.dueDate)) : ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    dueDate: parseDateTimeLocal(e.target.value)
                  }))
                }
                className={`w-full px-3 py-2 border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.dueDate ? "border-red-500" : "border-gray-300"
                }`}
              />
              {errors.dueDate && <p className="mt-1 text-sm text-red-600">{errors.dueDate}</p>}
            </div>

            {/* Last Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Extended Due Date (optional)</label>
              <input
                type="datetime-local"
                value={formData.lastDueDate ? formatForDateTimeLocal(new Date(formData.lastDueDate)) : ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    lastDueDate: e.target.value ? parseDateTimeLocal(e.target.value) : null
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                If provided, students can still resubmit after the main due date until this deadline.
              </p>
            </div>

            {/* Max Attempts */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Attempts</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <select
                  value={maxAttemptsOption}
                  onChange={(e) => setMaxAttemptsOption(e.target.value as MaxAttemptOptions)}
                  className={`px-3 py-2 border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.maxAttempts ? "border-red-500" : "border-gray-300"
                  }`}
                >
                  <option value="Limited">Limited</option>
                  <option value="Unlimited">Unlimited</option>
                </select>
                <input
                  type="number"
                  value={maxAttemptsOption === "Limited" ? maxAttempts : ""}
                  min={1}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setFormData((prev) => ({ ...prev, maxAttempts: value }));
                    setMaxAttempts(value);
                  }}
                  disabled={maxAttemptsOption === "Unlimited"}
                  className={`px-3 py-2 border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.maxAttempts ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="Number of attempts"
                />
              </div>
              {errors.maxAttempts && <p className="mt-1 text-sm text-red-600">{errors.maxAttempts}</p>}
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.push("/dashboard/submissions")}
                className="px-4 py-2 text-gray-700 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={coursesLoading || submissionLoading || isUploading}
                className="flex-1 px-4 py-2 bg-blue-600 text-sm text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUploading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    {isEditing ? "Updating..." : "Creating..."}
                  </div>
                ) : isEditing ? (
                  "Update Submission"
                ) : (
                  "Create Submission"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}