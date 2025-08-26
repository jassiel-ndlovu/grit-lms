import LessonMarkdown from "@/app/components/markdown";
import { $Enums } from "@/generated/prisma";
import { uploadFile } from "@/lib/blob";
import { formatForDateTimeLocal, parseDateTimeLocal } from "@/lib/functions";
import { MoveLeft, Download } from "lucide-react";
import { useState, useRef } from "react";

interface SubmissionFormProps {
  courses: AppTypes.Course[];
  loading: boolean;
  submission?: AppTypes.Submission | null;
  isEditing: boolean;
  onSave: (submission: AppTypes.Submission) => void;
  onCancel: () => void;
}

type MaxAttemptOptions = "Limited" | "Unlimited";

export default function SubmissionForm({
  courses,
  loading,
  submission,
  isEditing,
  onSave,
  onCancel
}: SubmissionFormProps) {
  const [formData, setFormData] = useState<Partial<AppTypes.Submission>>({
    title: submission?.title || "",
    description: submission?.description || "",
    descriptionFiles: submission?.descriptionFiles || [],
    courseId: submission?.courseId || (courses[0]?.id || ""),
    fileType: submission?.fileType || "PDF",
    dueDate: submission?.dueDate || undefined,
    lastDueDate: submission?.lastDueDate || undefined,
    maxAttempts: submission?.maxAttempts || 1,
  });

  const [maxAttemptsOption, setMaxAttemptsOption] = useState<MaxAttemptOptions>(
    formData.maxAttempts === null ? "Unlimited" : "Limited"
  );
  const [maxAttempts, setMaxAttempts] = useState<number>(formData.maxAttempts || 1);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!(formData.title as string).trim()) newErrors.title = "Title is required";
    if (!formData.description) newErrors.description = "Description is required";
    if (!formData.courseId) newErrors.courseId = "Course is required";
    if (!formData.dueDate) newErrors.dueDate = "Due date is required";
    if (maxAttemptsOption === "Limited" && !formData.maxAttempts) newErrors.maxAttempts = "Max attempts is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
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

      const submissionData: AppTypes.Submission = {
        id: submission?.id || `submission_${Date.now()}`,
        title: formData.title as string,
        description: formData.description as string,
        descriptionFiles: allDescriptionFiles,
        fileType: formData.fileType as $Enums.FileType,
        courseId: formData.courseId as string,
        maxAttempts: maxAttemptsOption === "Limited" ? maxAttempts : null,
        dueDate: new Date(formData.dueDate as Date),
        lastDueDate: formData.lastDueDate ? new Date(formData.lastDueDate as Date) : null,
        entries: submission?.entries || [],
        createdAt: submission?.createdAt || new Date()
      };

      onSave(submissionData);
    } catch (error) {
      console.error("Error uploading files:", error);
      alert("Failed to upload some files. Please try again.");
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

  const fileTypeOptions = [
    { value: "PDF", label: "PDF only" },
    { value: "DOCX", label: "Word documents only" },
    { value: "PDF,DOCX", label: "PDF and Word documents" },
    { value: "PDF,DOCX,ZIP", label: "PDF, Word, and ZIP files" },
    { value: "PDF,DOCX,ZIP,JPEG", label: "All supported formats" }
  ];

  return (
    <div className="h-full px-6 pt-6 pb-10 bg-gray-50 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <button
            onClick={onCancel}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center"
          >
            <MoveLeft className="w-4 h-4 mr-3" /> Back to Submissions
          </button>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isEditing ? "Edit Submission" : "Create New Submission"}
          </h1>
          <p className="text-gray-600 text-sm">
            {isEditing ? "Update submission details" : "Set up a new assignment for your students"}
          </p>
        </div>

        <div className="bg-white p-6 border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assignment Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                className={`w-full px-3 py-2 text-sm border ${errors.title ? "border-red-500" : "border-gray-300"
                  } focus:ring-2 focus:outline-none focus:ring-blue-500 focus:border-transparent`}
                placeholder="Enter assignment title..."
              />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
            </div>

            {/* Description with Markdown support */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <div className="relative">
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  onDragOver={(e) => e.preventDefault()}
                  className={`w-full px-3 py-2 font-mono text-sm border ${errors.description ? "border-red-500" : "border-gray-300"
                    } focus:ring-2 focus:outline-none focus:ring-blue-500 focus:border-transparent`}
                  rows={4}
                  placeholder="Enter assignment description or instructions (Markdown Allowed)..."
                />
              </div>
              {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}

              {/* Markdown Preview */}
              <div className="mt-2 p-3 bg-gray-50 rounded-md">
                <label className="block text-sm font-medium text-gray-700 mb-2">Preview:</label>
                <div className="text-sm">
                  <LessonMarkdown content={formData.description || "*Type your description above...*"} />
                </div>
              </div>
            </div>

            {/* Description Files */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
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
                        className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
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
                className="flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-lg p-6 text-gray-500 cursor-pointer hover:border-blue-400 hover:text-blue-500"
              >
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="fileInput"
                  ref={fileInputRef}
                />
                <label htmlFor="fileInput" className="cursor-pointer text-sm text-center">
                  Drop files here or <span className="text-blue-600">browse</span>
                  <p className="text-xs text-gray-400 mt-1">Files will be uploaded and available to students</p>
                </label>
              </div>

              {/* New files to be uploaded */}
              {files.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Files to upload:</h4>
                  <div className="flex flex-wrap gap-2">
                    {files.map((file, index) => (
                      <span
                        key={index}
                        className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course *
              </label>
              <select
                value={formData.courseId}
                onChange={(e) => setFormData(prev => ({ ...prev, courseId: e.target.value }))}
                className={`w-full px-3 py-2 text-sm border focus:ring-2 focus:outline-none focus:ring-blue-500 focus:border-transparent ${errors.courseId ? 'border-red-500' : 'border-gray-300'}`}
              >
                <option value="">
                  Select a course...
                </option>
                {courses.map(course => (
                  <option
                    key={course.id}
                    value={course.id}
                  >
                    {course.name}
                  </option>))}
              </select>

              {errors.courseId &&
                <p className="mt-1 text-sm text-red-600">
                  {errors.courseId}
                </p>}
            </div>

            {/* File Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Accepted File Types
              </label>
              <select
                value={formData.fileType}
                onChange={(e) => setFormData((prev) => ({ ...prev, fileType: e.target.value as $Enums.FileType }))}
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
              <input
                type="datetime-local"
                value={formData.dueDate ? formatForDateTimeLocal(new Date(formData.dueDate)) : ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    dueDate: parseDateTimeLocal(e.target.value)
                  }))
                }
                className={`w-full px-3 py-2 border text-sm ${errors.dueDate ? "border-red-500" : "border-gray-300"
                  } focus:ring-2 focus:outline-none focus:ring-blue-500 focus:border-transparent`}
              />
              {errors.dueDate && <p className="mt-1 text-sm text-red-600">{errors.dueDate}</p>}
            </div>

            {/* Last Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Extended Due Date (optional)</label>
              <input
                type="datetime-local"
                value={formData.lastDueDate ? formatForDateTimeLocal(new Date(formData.lastDueDate)) : ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    lastDueDate: e.target.value ? parseDateTimeLocal(e.target.value) : null
                  }))
                }
                className="w-full px-3 py-2 border text-sm border-gray-300 focus:ring-2 focus:outline-none focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                If provided, students can still resubmit after the main due date until this deadline.
              </p>
            </div>

            {/* Max Attempts */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Attempts</label>
              <div className="flex justify-between items-center gap-2">
                <select
                  value={maxAttemptsOption}
                  onChange={(e) => setMaxAttemptsOption(e.target.value as MaxAttemptOptions)}
                  className={`w-full px-3 py-2 text-sm border ${errors.maxAttempts ? "border-red-500" : "border-gray-300"
                    } focus:ring-2 focus:outline-none focus:ring-blue-500 focus:border-transparent`}
                >
                  <option value="Limited">Limited</option>
                  <option value="Unlimited">Unlimited</option>
                </select>
                <input
                  type="number"
                  value={maxAttemptsOption === "Limited" ? maxAttempts : ""}
                  min={1}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, maxAttempts: Number(e.target.value) }));
                    setMaxAttempts(Number(e.target.value));
                  }}
                  disabled={maxAttemptsOption === "Unlimited"}
                  className={`w-full px-3 py-2 border text-sm ${errors.maxAttempts ? "border-red-500" : "border-gray-300"
                    } focus:ring-2 focus:outline-none focus:ring-blue-500 focus:border-transparent`}
                />
              </div>
              {errors.maxAttempts && <p className="mt-1 text-sm text-red-600">{errors.maxAttempts}</p>}
            </div>

            {/* Buttons */}
            <div className="flex justify-end space-x-4 pt-6">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 border border-gray-300 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || isUploading}
                className="px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading || isUploading ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    {isUploading ? "Uploading..." : "Saving..."}
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