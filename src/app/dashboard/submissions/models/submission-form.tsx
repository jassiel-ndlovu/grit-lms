import { $Enums } from "@/generated/prisma";
import { formatForDateTimeLocal, parseDateTimeLocal } from "@/lib/functions";
import { MoveLeft } from "lucide-react";
import { useState } from "react";

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

  const handleSubmit = (e: React.FormEvent) => {
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

    const submissionData: AppTypes.Submission = {
      id: submission?.id || `submission_${Date.now()}`,
      title: formData.title as string,
      description: formData.description as string,
      descriptionFiles: files.map(f => (
        { title: f.name, url: "http://localhost:3000" }
      )) || [],
      fileType: formData.fileType as $Enums.FileType,
      courseId: formData.courseId as string,
      maxAttempts: maxAttemptsOption === "Limited" ? maxAttempts : null,
      dueDate: new Date(formData.dueDate as Date),
      lastDueDate: formData.lastDueDate ? new Date(formData.lastDueDate as Date) : null,
      entries: submission?.entries || [],
      createdAt: submission?.createdAt || new Date()
    };

    onSave(submissionData);
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
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
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

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                className={`w-full px-3 py-2 font-mono text-sm border ${errors.description ? "border-red-500" : "border-gray-300"
                  } focus:ring-2 focus:outline-none focus:ring-blue-500 focus:border-transparent`}
                rows={4}
                placeholder="Enter assignment description or instructions (Markdown Allowed)..."
              />
              {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
            </div>

            {/* Description Files */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Instruction Files (Optional)
              </label>

              {/* Dropzone */}
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
                />
                <label htmlFor="fileInput" className="cursor-pointer text-sm">
                  Drop files here or <span className="text-blue-600">browse</span>
                </label>
              </div>

              {/* Pills */}
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
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
                className="px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700"
              >
                {loading ? (
                  <div className="w-3 h-3 p-1 rounded-full border border-white border-t-transparent animate-spin"></div>
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