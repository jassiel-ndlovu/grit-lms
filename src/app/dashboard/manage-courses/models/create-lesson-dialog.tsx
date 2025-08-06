/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import React, { useState } from 'react';
import { X, BookOpen, Plus, Trash2, Link, Video } from 'lucide-react';

interface CreateLessonDialogProps {
  courseId: string;
  courseName: string;
  onClose: () => void;
  onSave: (lesson: Partial<AppTypes.Lesson>) => Promise<void>;
  loading?: boolean;
  serverError?: string | null;
}

export default function CreateLessonDialog({ courseId, courseName, onClose, onSave, loading = false, serverError }: CreateLessonDialogProps) {
  const [formData, setFormData] = useState<Partial<AppTypes.Lesson>>({
    title: '',
    description: '',
    videoUrl: [''],
    attachmentUrls: [
      // @ts-expect-error id and lessonId are not required for creation
      { title: '', url: '' }
    ]
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!(formData.title as string).trim()) {
      newErrors.title = 'Lesson title is required';
    }

    if (!(formData.description as string).trim()) {
      newErrors.description = 'Lesson description is required';
    }

    // Validate video URLs
    (formData.videoUrl as string[]).forEach((url, index) => {
      if (url.trim() && !isValidUrl(url)) {
        newErrors[`video_${index}`] = 'Please enter a valid URL';
      }
    });

    // Validate resource links
    (formData.attachmentUrls as AppTypes.Attachment[]).forEach((resource, index) => {
      if (resource.title.trim() && !resource.url.trim()) {
        newErrors[`resource_url_${index}`] = 'URL is required when title is provided';
      }
      if (resource.url.trim() && !resource.title.trim()) {
        newErrors[`resource_title_${index}`] = 'Title is required when URL is provided';
      }
      if (resource.url.trim() && !isValidUrl(resource.url)) {
        newErrors[`resource_url_${index}`] = 'Please enter a valid URL';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch (e) {
      console.error('Invalid URL:', string, e);
      setErrors(prev => ({ ...prev, video_0: 'Invalid URL format' }));
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    // Clean up the data before saving
    const cleanedData: Partial<AppTypes.Lesson> = {
      title: (formData.title as string).trim(),
      description: (formData.description as string).trim(),
      courseId,
      videoUrl: (formData.videoUrl as string[]).filter(url => url.trim() !== ''),
      attachmentUrls: (formData.attachmentUrls as AppTypes.Attachment[]).filter(
        resource => resource.title.trim() !== '' && resource.url.trim() !== ''
      ),
    };

    try {
      await onSave(cleanedData);
      onClose();
    } catch (error) {
      console.error('Error creating lesson:', error);
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear related errors
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const addVideoUrl = () => {
    updateFormData('videoUrl', [...(formData.videoUrl as string[]), '']);
  };

  const removeVideoUrl = (index: number) => {
    const updated = (formData.videoUrl as string[]).filter((_, i) => i !== index);
    updateFormData('videoUrl', updated.length ? updated : ['']);
  };

  const updateVideoUrl = (index: number, value: string) => {
    const updated = [...(formData.videoUrl as string[])];
    updated[index] = value;
    updateFormData('videoUrl', updated);
    // Clear specific video error
    if (errors[`video_${index}`]) {
      setErrors(prev => ({ ...prev, [`video_${index}`]: '' }));
    }
  };

  const addResourceLink = () => {
    updateFormData('resourceLinks', [...(formData.attachmentUrls as AppTypes.Attachment[]), { title: '', url: '' }]);
  };

  const removeResourceLink = (index: number) => {
    const updated = (formData.attachmentUrls as AppTypes.Attachment[]).filter((_, i) => i !== index);
    updateFormData('resourceLinks', updated.length ? updated : [{ title: '', url: '' }]);
  };

  const updateResourceLink = (index: number, field: 'title' | 'url', value: string) => {
    const updated = [...(formData.attachmentUrls as AppTypes.Attachment[])];
    updated[index][field] = value;
    updateFormData('resourceLinks', updated);
    // Clear specific resource errors
    const errorKey = `resource_${field}_${index}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 bg-opacity-50 flex items-center justify-center z-50 p-4"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Create Lesson</h2>
              <p className="text-sm text-gray-500">{courseName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(90vh-140px)] overflow-y-auto">
          {/* Lesson Title */}
          {serverError && (
              <div className="text-red-600 bg-red-100 border border-red-300 rounded px-4 py-2 mb-4 text-sm">
                {serverError}
              </div>
            )}
          <div>
            <label htmlFor="lesson-title" className="block text-sm font-medium text-gray-700 mb-2">
              Lesson Title *
            </label>
            <input
              id="lesson-title"
              type="text"
              value={formData.title}
              onChange={(e) => updateFormData('title', e.target.value)}
              placeholder="Enter lesson title..."
              className={`w-full text-gray-900 text-sm px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors ${errors.title ? 'border-red-300' : 'border-gray-300'}`}
              disabled={loading}
              maxLength={200}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600" role="alert">{errors.title}</p>
            )}
          </div>

          {/* Lesson Description */}
          <div>
            <label htmlFor="lesson-description" className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              id="lesson-description"
              value={formData.description as string}
              onChange={(e) => updateFormData('description', e.target.value)}
              placeholder="Write your lesson description in Markdown format...

                # Example Lesson Content

                This lesson will cover:
                - Key concepts
                - Practical examples
                - Exercises

                ## Learning Objectives
                By the end of this lesson, you will be able to..."
              rows={6}
              className={`w-full px-3 py-2 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none font-mono text-gray-900 text-sm transition-colors ${errors.description ? 'border-red-300' : 'border-gray-300'
                }`}
              disabled={loading}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600" role="alert">{errors.description}</p>
            )}
            
            <p className="mt-1 text-xs text-gray-500">
              You can use Markdown formatting for rich text content
            </p>
          </div>

          {/* Video URLs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Video URLs (Optional)
              </label>
              <button
                type="button"
                onClick={addVideoUrl}
                disabled={loading}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add Video
              </button>
            </div>
            <div className="space-y-3">
              {(formData.videoUrl as string[]).map((url, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-gray-400 mt-2.5 flex-shrink-0" />
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => updateVideoUrl(index, e.target.value)}
                        placeholder="https://example.com/video.mp4"
                        className={`flex-1 px-3 py-2 border text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors ${errors[`video_${index}`] ? 'border-red-300' : 'border-gray-300'
                          }`}
                        disabled={loading}
                      />
                      {(formData.videoUrl as string[]).length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeVideoUrl(index)}
                          disabled={loading}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          aria-label={`Remove video ${index + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {errors[`video_${index}`] && (
                      <p className="mt-1 text-sm text-red-600 ml-6" role="alert">
                        {errors[`video_${index}`]}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resource Links */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Resource Links (Optional)
              </label>
              <button
                type="button"
                onClick={addResourceLink}
                disabled={loading}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add Resource
              </button>
            </div>
            <div className="space-y-3">
              {(formData.attachmentUrls as AppTypes.Attachment[]).map((resource, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Link className="w-4 h-4 text-gray-400 mt-2.5 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={resource.title}
                        onChange={(e) => updateResourceLink(index, 'title', e.target.value)}
                        placeholder="Resource title (e.g., Additional Reading, Practice Exercises)"
                        className={`w-full px-3 py-2 border text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors ${errors[`resource_title_${index}`] ? 'border-red-300' : 'border-gray-300'
                          }`}
                        disabled={loading}
                        maxLength={100}
                      />
                      <input
                        type="url"
                        value={resource.url}
                        onChange={(e) => updateResourceLink(index, 'url', e.target.value)}
                        placeholder="https://example.com"
                        className={`w-full px-3 py-2 border text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors ${errors[`resource_url_${index}`] ? 'border-red-300' : 'border-gray-300'
                          }`}
                        disabled={loading}
                      />
                    </div>
                    {(formData.attachmentUrls as AppTypes.Attachment[]).length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeResourceLink(index)}
                        disabled={loading}
                        className="p-2 text-red-500 text-sm hover:text-red-700 hover:bg-red-50 mt-1 transition-colors disabled:opacity-50"
                        aria-label={`Remove resource ${index + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {(errors[`resource_title_${index}`] || errors[`resource_url_${index}`]) && (
                    <div className="ml-6 space-y-1">
                      {errors[`resource_title_${index}`] && (
                        <p className="text-sm text-red-600" role="alert">
                          {errors[`resource_title_${index}`]}
                        </p>
                      )}
                      {errors[`resource_url_${index}`] && (
                        <p className="text-sm text-red-600" role="alert">
                          {errors[`resource_url_${index}`]}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 text-sm border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !(formData.title as string).trim() || !(formData.description as string).trim()}
            className="px-6 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating...
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4" />
                Create Lesson
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}