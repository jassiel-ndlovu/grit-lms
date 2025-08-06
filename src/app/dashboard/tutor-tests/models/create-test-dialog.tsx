/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCourses } from "@/context/CourseContext";
import { QuestionType, TestQuestion } from "@/generated/prisma";
import { parseDateTimeLocal, formatForDateTimeLocal } from "@/lib/functions";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface CreateTestDialogProps {
  onClose: () => void;
  onSave: (courseId: string, testData: Partial<AppTypes.Test>) => Promise<void>;
  loading?: boolean;
}

export default function CreateTestDialog({ onClose, onSave, loading = false }: CreateTestDialogProps) {
  const { courses } = useCourses();
  const [formData, setFormData] = useState<Partial<AppTypes.Test & { questions: Partial<TestQuestion>[] }>>({
    title: '',
    description: '',
    preTestInstructions: '',
    courseId: '',
    dueDate: new Date(),
    timeLimit: undefined,
    // @ts-expect-error testId is not required for creation
    questions: [{
      id: "1",
      question: '',
      type: QuestionType.FILE_UPLOAD,
      points: 1,
      options: ['', '', '', ''],
      answer: '',
    }],
  });

  const addQuestion = () => {
    // @ts-expect-error testid is not required for creation
    setFormData(prev => ({
      ...prev,
      questions: [
        ...(prev.questions || []),
        {
          id: "1",
          question: '',
          type: QuestionType.MULTIPLE_CHOICE,
          points: 10,
          options: ['', '', '', ''],
          answer: ''
        }
      ]
    }));
  };

  const removeQuestion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      questions: (prev.questions || []).filter((_, i) => i !== index)
    }));
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      questions: (prev.questions || []).map((q, i) => i === index ? { ...q, [field]: value } : q)
    }));
  };

  const handleSubmit = async () => {
    const totalPoints = (formData.questions || []).reduce((sum, q) => sum + (q.points || 0), 0);

    const testData: Partial<AppTypes.Test> = {
      title: formData.title,
      description: formData.description,
      preTestInstructions: formData.preTestInstructions,
      courseId: formData.courseId,
      dueDate: new Date(formData.dueDate || ''),
      timeLimit: formData.timeLimit,
      questions: formData.questions,
      totalPoints,
      isActive: true
    };

    await onSave(formData.courseId || '', testData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 p-6 border-b border-gray-200 bg-gray-100">
          <div className="w-10 h-10 bg-blue-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Create New Test</h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Title *
              </label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                placeholder="Enter test title..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Course *
              </label>
              <select
                value={formData.courseId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, courseId: e.target.value }))}
                className="w-full text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                disabled={!!formData.courseId}
              >
                <option value="">Select a course</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>{course.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              placeholder="Test description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pre-Test Instructions
            </label>
            <textarea
              value={formData.preTestInstructions || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, preTestInstructions: e.target.value }))}
              rows={3}
              className="w-full text-sm px-3 py-2 border border-gray-300 font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              placeholder="Instructions to show before students start the test..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date *
              </label>
              <input
                type="datetime-local"
                value={formData.dueDate ? formatForDateTimeLocal(formData.dueDate) : ""}
                onChange={(e) =>
                  setFormData(prev => ({
                    ...prev,
                    dueDate: parseDateTimeLocal(e.target.value)
                  }))}
                className="w-full text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Limit (minutes)
              </label>
              <input
                type="number"
                value={formData.timeLimit ?? ''}
                onChange={(e) => setFormData(prev => ({ ...prev, timeLimit: parseInt(e.target.value) }))}
                className="w-full text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Questions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Questions</h3>
              <button
                onClick={addQuestion}
                className="flex items-center gap-2 text-sm px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Question
              </button>
            </div>

            <div className="space-y-4">
              {(formData.questions || []).map((question, index) => (
                <div key={index} className="border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-900">Question {index + 1}</h4>
                    {formData.questions!.length > 1 && (
                      <button
                        onClick={() => removeQuestion(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={question.question || ''}
                      onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                      placeholder="Enter your question..."
                      className="w-full text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <select
                        value={question.type}
                        onChange={(e) => updateQuestion(index, 'type', e.target.value)}
                        className="text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                      >
                        <option value={QuestionType.MULTIPLE_CHOICE}>Multiple Choice</option>
                        <option value={QuestionType.SHORT_ANSWER}>Short Answer</option>
                        <option value={QuestionType.ESSAY}>Essay</option>
                        <option value={QuestionType.FILE_UPLOAD}>File Upload</option>
                      </select>

                      <input
                        type="number"
                        value={question.points || 0}
                        onChange={(e) => updateQuestion(index, 'points', parseInt(e.target.value))}
                        placeholder="Points"
                        className="text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    {question.type === QuestionType.MULTIPLE_CHOICE && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Options:</label>
                        {(question.options || []).map((option, optIndex) => (
                          <input
                            key={optIndex}
                            type="text"
                            value={option}
                            onChange={(e) => {
                              const newOptions = [...(question.options || [])];
                              newOptions[optIndex] = e.target.value;
                              updateQuestion(index, 'options', newOptions);
                            }}
                            placeholder={`Option ${optIndex + 1}`}
                            className="w-full text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                          />
                        ))}
                        <input
                          type="text"
                          value={question.answer?.toString() || ''}
                          onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
                          placeholder="Correct answer"
                          className="w-full text-sm px-3 py-2 border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !formData.title || !formData.courseId || !formData.dueDate || !formData.questions || !formData.questions.length}
            className="text-sm px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Test'}
          </button>
        </div>
      </div>
    </div>
  );
}
