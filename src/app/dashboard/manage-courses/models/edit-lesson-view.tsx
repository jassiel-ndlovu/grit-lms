/* eslint-disable @typescript-eslint/no-explicit-any */

import { uploadFile } from "@/lib/blob";
import { cleanUrl } from "@/lib/functions";
import { Plus, Save } from "lucide-react";
import { useRef, useState } from "react";

type EditLessonViewProps = {
  lesson: Partial<AppTypes.Lesson>;
  onUpdate: (key: keyof AppTypes.Lesson, value: any) => void;
  onSave: (newAttachmentUrls?: AppTypes.Attachment[]) => void;
  onCancel: () => void;
  onAddVideo: () => void;
  onRemoveVideo: (index: number) => void;
  onAddResource: () => void;
  onRemoveResource: (index: number) => void;
}

export default function EditLessonView({ lesson, onUpdate, onSave, onCancel, onAddVideo, onRemoveVideo, onAddResource, onRemoveResource }: EditLessonViewProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadUrls = async () => {
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

      return successfulUploads;
    } catch (error) {
      console.error("Error uploading files:", error);
      alert("Failed to upload some files. Please try again.");
    } finally {
      setIsUploading(false);
    }

    return null;
  }

  // upload files when change occurs
  const handleSave = async () => {
    const successfulUploads = await uploadUrls();

    // Create the new attachmentUrls array
    const newAttachmentUrls = [
      ...(successfulUploads?.map(url => ({
        title: cleanUrl(url?.split("/").pop() ?? "Undefined URL"),
        url: url,
      } as AppTypes.Attachment)) ?? [])
    ];

    // Update the state
    onUpdate("attachmentUrls", newAttachmentUrls);

    // Call onSave with the updated value directly
    onSave(newAttachmentUrls);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
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

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Edit Lesson</h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          Cancel
        </button>
      </div>

      <input
        type="text"
        value={lesson.title || ''}
        onChange={(e) => onUpdate("title", e.target.value)}
        placeholder="Lesson title..."
        className="text-xl font-semibold border-b border-gray-300 w-full focus:outline-none focus:border-blue-500 pb-2"
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
        <textarea
          value={lesson.description || ''}
          onChange={(e) => onUpdate("description", e.target.value)}
          rows={6}
          placeholder="Write your lesson description in Markdown..."
          className="w-full border border-gray-300 p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Video URLs</h3>
          <button
            onClick={onAddVideo}
            className="text-blue-600 text-sm hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Video
          </button>
        </div>
        {lesson.videoUrl && lesson.videoUrl.length > 0 ? (
          lesson.videoUrl.map((video, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="url"
                value={video || ''}
                onChange={(e) => {
                  const updated = [...(lesson.videoUrl || [])];
                  updated[idx] = e.target.value;
                  onUpdate("videoUrl", updated);
                }}
                placeholder="https://example.com/video.mp4"
                className="flex-1 text-sm border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={() => onRemoveVideo(idx)}
                className="text-red-500 hover:text-red-700 p-2"
              >
                &times;
              </button>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-sm italic">No videos added yet</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Resource Links</h3>

          {/* Resource Link Buttons */}
          <div className="flex gap-4">
            <button
              onClick={onAddResource}
              className="text-blue-600 text-sm hover:text-blue-700 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add Resource
            </button>
            {/* Import Files */}
            <label
              htmlFor="fileInput"
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Import File
            </label>
          </div>
        </div>
        {/* Dropzone for new files */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="h-48 flex flex-col items-center justify-center border border-dashed border-gray-300 rounded-lg p-6 text-gray-500 cursor-pointer hover:border-blue-400 hover:text-blue-500"
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

        <div className="text-gray-700 text-sm flex items-center">
          <div className="w-1/2 h-0 border-b border-b-gray-200" />
          <span className="mx-4 text-gray-700 font-medium">OR</span>
          <div className="w-1/2 h-0 border-t border-t-gray-200" />
        </div>

        {lesson.attachmentUrls && lesson.attachmentUrls.length > 0 ? (
          lesson.attachmentUrls.map((resource, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={resource?.title || ''}
                onChange={(e) => {
                  const updated = [...(lesson.attachmentUrls || [])];
                  updated[idx] = { ...updated[idx], title: e.target.value };
                  onUpdate("attachmentUrls", updated);
                }}
                placeholder="Resource title"
                className="w-1/3 text-sm border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
              />
              <input
                type="url"
                value={resource?.url || ''}
                onChange={(e) => {
                  const updated = [...(lesson.attachmentUrls || [])];
                  updated[idx] = { ...updated[idx], url: e.target.value };
                  onUpdate("attachmentUrls", updated);
                }}
                placeholder="https://example.com"
                className="w-2/3 text-sm border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => onRemoveResource(idx)}
                className="text-red-500 hover:text-red-700 p-2"
              >
                &times;
              </button>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-sm italic">No resources added yet</p>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <button
          onClick={handleSave}
          disabled={isUploading}
          className="flex items-center gap-2 bg-green-600 text-white text-sm px-6 py-2 hover:bg-green-700 transition"
        >
          {isUploading ? (
            <div className="w-4 h-4 border border-white border-t-transparent animate-spin rounded-full" />
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={isUploading}
          className="px-6 py-2 border border-gray-300 text-sm hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </>
  );
}