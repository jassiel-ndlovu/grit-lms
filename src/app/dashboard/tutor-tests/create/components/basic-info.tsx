/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { formatForDateTimeLocal, parseDateTimeLocal } from '@/lib/functions';
import { TestFormData } from '@/lib/test-creation-types';

interface TestBasicInfoProps {
  formData: TestFormData;
  setFormData: React.Dispatch<React.SetStateAction<TestFormData>>;
  courses: AppTypes.Course[];
  editMode: boolean;
}

const TestBasicInfo: React.FC<TestBasicInfoProps> = ({
  formData,
  setFormData,
  courses,
  editMode
}) => {
  const updateField = (field: keyof TestFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Basic Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Test Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title || ''}
            onChange={(e) => updateField('title', e.target.value)}
            className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
            placeholder="Enter test title..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Course <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.courseId || ''}
            onChange={(e) => updateField('courseId', e.target.value)}
            className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
            disabled={editMode}
          >
            <option value="">Select a course</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
          {editMode && (
            <p className="text-xs text-gray-500 mt-1">
              Course cannot be changed when editing
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => updateField('description', e.target.value)}
          rows={3}
          className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
          placeholder="Brief description of what this test covers..."
        />
      </div>

      {/* Pre-Test Instructions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Pre-Test Instructions
        </label>
        <textarea
          value={formData.preTestInstructions || ''}
          onChange={(e) => updateField('preTestInstructions', e.target.value)}
          rows={4}
          className="w-full text-sm px-3 py-2 border border-gray-300 rounded font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
          placeholder="Instructions to show before students start the test (Markdown supported)..."
        />
        <p className="text-xs text-gray-500 mt-1">
          These instructions will be displayed to students before they begin the test. Markdown formatting is supported.
        </p>
      </div>

      {/* Date and Time Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Due Date <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            value={formData.dueDate ? formatForDateTimeLocal(formData.dueDate) : ""}
            onChange={(e) => updateField('dueDate', parseDateTimeLocal(e.target.value))}
            className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Time Limit (minutes)
          </label>
          <input
            type="number"
            min="1"
            value={formData.timeLimit ?? ''}
            onChange={(e) => updateField('timeLimit', e.target.value ? parseInt(e.target.value) : null)}
            className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
            placeholder="Leave empty for no time limit"
          />
          <p className="text-xs text-gray-500 mt-1">
            Optional. Students will see a countdown timer if set.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TestBasicInfo;