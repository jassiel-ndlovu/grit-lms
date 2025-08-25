/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCourses } from "@/context/CourseContext";
import { QuestionType, TestQuestion } from "@/generated/prisma";
import { parseDateTimeLocal, formatForDateTimeLocal } from "@/lib/functions";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";

interface TestDialogProps {
  onClose: () => void;
  onSave: (courseId: string, testData: Partial<AppTypes.Test>) => Promise<void>;
  onUpdate?: (testId: string, testData: Partial<AppTypes.Test>) => Promise<void>;
  loading?: boolean;
  editingTest?: AppTypes.Test | null;
}

export default function TestDialog({
  onClose,
  onSave,
  onUpdate,
  loading = false,
  editingTest = null
}: TestDialogProps) {
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
      type: QuestionType.MULTIPLE_CHOICE,
      points: 1,
      options: ['', '', '', ''],
      answer: '',
      language: '',
      matchPairs: null,
      reorderItems: [],
      blankCount: 0,
    }],
  });

  useEffect(() => {
    if (editingTest) {
      setFormData({
        ...editingTest,
        dueDate: new Date(editingTest.dueDate),
        questions: editingTest.questions.map(q => ({
          ...q,
          // Ensure all question fields are properly initialized
          options: q.options || ['', '', '', ''],
          language: q.language || '',
          matchPairs: q.matchPairs || null,
          reorderItems: q.reorderItems || [],
          blankCount: q.blankCount || 0,
        }))
      });
    }
  }, [editingTest]);

  const addQuestion = () => {
    // @ts-expect-error testid is not required for creation
    setFormData(prev => ({
      ...prev,
      questions: [
        ...(prev.questions || []),
        {
          id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          question: '',
          type: QuestionType.MULTIPLE_CHOICE,
          points: 10,
          options: ['', '', '', ''],
          answer: '',
          language: '',
          matchPairs: null,
          reorderItems: [],
          blankCount: 0,
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
      isActive: formData.isActive !== undefined ? formData.isActive : true
    };

    if (editingTest && onUpdate) {
      await onUpdate(editingTest.id, testData);
    } else {
      await onSave(formData.courseId || '', testData);
    }
  };

  const renderQuestionFields = (question: Partial<TestQuestion>, index: number) => {
    switch (question.type) {
      case QuestionType.MULTIPLE_CHOICE:
      case QuestionType.MULTI_SELECT:
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Options:</label>
            {(question.options || []).map((option, optIndex) => (
              <div key={optIndex} className="flex items-center gap-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...(question.options || [])];
                    newOptions[optIndex] = e.target.value;
                    updateQuestion(index, 'options', newOptions);
                  }}
                  placeholder={`Option ${optIndex + 1}`}
                  className="flex-1 font-mono text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newOptions = [...(question.options || [])];
                    newOptions.splice(optIndex, 1);
                    updateQuestion(index, 'options', newOptions);
                  }}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const newOptions = [...(question.options || []), ''];
                updateQuestion(index, 'options', newOptions);
              }}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <Plus className="w-4 h-4" />
              Add Option
            </button>

            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correct Answer{question.type === QuestionType.MULTI_SELECT ? 's (comma-separated)' : ''}
              </label>
              <input
                type="text"
                value={typeof question.answer === 'string' ? question.answer : ''}
                onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
                placeholder={question.type === QuestionType.MULTI_SELECT ?
                  "Correct answers (comma-separated, e.g., A, C)" :
                  "Correct answer (e.g., A)"}
                className="w-full font-mono text-sm px-3 py-2 border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
              />
            </div>
          </div>
        );

      case QuestionType.CODE:
        return (
          <div className="space-y-2">
            <input
              type="text"
              value={question.language || ''}
              onChange={(e) => updateQuestion(index, 'language', e.target.value)}
              placeholder="Programming language (e.g., JavaScript, Python)"
              className="w-full font-mono text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            />
            <textarea
              value={typeof question.answer === 'string' ? question.answer : ''}
              onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
              placeholder="Expected code answer"
              rows={4}
              className="w-full font-mono text-sm px-3 py-2 border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
            />
          </div>
        );

      // case QuestionType.MATCHING:
      //   return (
      //     <div className="space-y-3">
      //       <label className="block text-sm font-medium text-gray-700">Matching Pairs:</label>

      //       {(question.matchPairs && Array.isArray(question.matchPairs) ? question.matchPairs : []).map((pair: any, pairIndex) => (
      //         <div key={pairIndex} className="grid grid-cols-2 gap-2 items-center">
      //           <input
      //             type="text"
      //             value={pair.left || ''}
      //             onChange={(e) => {
      //               const newPairs = Array.isArray(question.matchPairs) ? [...question.matchPairs] : [];
      //               newPairs[pairIndex] = Array.isArray(newPairs[pairIndex]) ? { ...newPairs[pairIndex], left: e.target.value } : { left: e.target.value };
      //               updateQuestion(index, 'matchPairs', newPairs);
      //             }}
      //             placeholder="Left item"
      //             className="text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
      //           />
      //           <div className="flex items-center gap-2">
      //             <input
      //               type="text"
      //               value={pair.right || ''}
      //               onChange={(e) => {
      //                 const newPairs = Array.isArray(question.matchPairs) ? [...question.matchPairs] : [];
      //                 newPairs[pairIndex] = Array.isArray(newPairs[pairIndex]) ? { ...newPairs[pairIndex], right: e.target.value } : { right: e.target.value };
      //                 updateQuestion(index, 'matchPairs', newPairs);
      //               }}
      //               placeholder="Right item"
      //               className="flex-1 text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
      //             />
      //             <button
      //               type="button"
      //               onClick={() => {
      //                 const newPairs = Array.isArray(question.matchPairs) ? [...question.matchPairs] : [];
      //                 newPairs.splice(pairIndex, 1);
      //                 updateQuestion(index, 'matchPairs', newPairs);
      //               }}
      //               className="text-red-500 hover:text-red-700 p-2"
      //             >
      //               <Trash2 className="w-4 h-4" />
      //             </button>
      //           </div>
      //         </div>
      //       ))}

      //       <button
      //         type="button"
      //         onClick={() => {
      //           const newPairs = [...(question.matchPairs || []), { left: '', right: '' }];
      //           updateQuestion(index, 'matchPairs', newPairs);
      //         }}
      //         className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      //       >
      //         <Plus className="w-4 h-4" />
      //         Add Matching Pair
      //       </button>
      //     </div>
      //   );

      case QuestionType.REORDER:
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Items to Reorder:</label>

            {(question.reorderItems || []).map((item, itemIndex) => (
              <div key={itemIndex} className="flex items-center gap-2">
                <span className="text-sm text-gray-500 w-6">{itemIndex + 1}.</span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newItems = [...(question.reorderItems || [])];
                    newItems[itemIndex] = e.target.value;
                    updateQuestion(index, 'reorderItems', newItems);
                  }}
                  placeholder={`Item ${itemIndex + 1}`}
                  className="flex-1 text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newItems = [...(question.reorderItems || [])];
                    newItems.splice(itemIndex, 1);
                    updateQuestion(index, 'reorderItems', newItems);
                  }}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                const newItems = [...(question.reorderItems || []), ''];
                updateQuestion(index, 'reorderItems', newItems);
              }}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>

            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correct Order (comma-separated indices)
              </label>
              <input
                type="text"
                value={Array.isArray(question.answer) ? question.answer.join(',') : ''}
                onChange={(e) => updateQuestion(index, 'answer', e.target.value.split(',').map(item => item.trim()))}
                placeholder="e.g., 3,1,2,4"
                className="w-full font-mono text-sm px-3 py-2 border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the correct order using numbers corresponding to the item positions above.
              </p>
            </div>
          </div>
        );

      case QuestionType.FILL_IN_THE_BLANK:
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Blanks
                </label>
                <input
                  type="number"
                  min="1"
                  value={question.blankCount || 1}
                  onChange={(e) => updateQuestion(index, 'blankCount', parseInt(e.target.value))}
                  className="w-full text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correct Answers {question.blankCount && question.blankCount > 1 ? '(one per line)' : ''}
              </label>
              {question.blankCount === 1 ? (
                <input
                  type="text"
                  value={typeof question.answer === 'string' ? question.answer : ''}
                  onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
                  placeholder="Correct answer"
                  className="w-full font-mono text-sm px-3 py-2 border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
                />
              ) : (
                <div className="space-y-2">
                  {Array.from({ length: question.blankCount || 1 }).map((_, blankIndex) => (
                    <input
                      key={blankIndex}
                      type="text"
                      value={Array.isArray(question.answer) ? question.answer[blankIndex] as string || '' : ''}
                      onChange={(e) => {
                        const newAnswers = Array.isArray(question.answer) ? [...question.answer] : [];
                        newAnswers[blankIndex] = e.target.value;
                        updateQuestion(index, 'answer', newAnswers);
                      }}
                      placeholder={`Blank ${blankIndex + 1} answer`}
                      className="w-full font-mono text-sm px-3 py-2 border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case QuestionType.NUMERIC:
        return (
          <div className="space-y-2">
            <input
              type="number"
              value={typeof question.answer === 'number' ? question.answer : ''}
              onChange={(e) => updateQuestion(index, 'answer', parseFloat(e.target.value))}
              placeholder="Correct numeric answer"
              className="w-full font-mono text-sm px-3 py-2 border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
            />
          </div>
        );

      case QuestionType.TRUE_FALSE:
        return (
          <div className="space-y-2">
            <select
              value={typeof question.answer === 'boolean' ? question.answer.toString() : ''}
              onChange={(e) => updateQuestion(index, 'answer', e.target.value === 'true')}
              className="w-full text-sm px-3 py-2 border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
            >
              <option value="">Select correct answer</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          </div>
        );

      case QuestionType.SHORT_ANSWER:
      case QuestionType.ESSAY:
        return (
          <div className="space-y-2">
            <textarea
              value={typeof question.answer === 'string' ? question.answer : ''}
              onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
              placeholder="Expected answer"
              rows={question.type === QuestionType.ESSAY ? 6 : 3}
              className="w-full font-mono text-sm px-3 py-2 border border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
            />
          </div>
        );

      case QuestionType.FILE_UPLOAD:
        return (
          <div className="text-sm text-gray-500 italic">
            Students will upload files for this question. No answer field needed.
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 p-6 border-b border-gray-200 bg-gray-100">
          <div className="w-10 h-10 bg-blue-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">
            {editingTest ? 'Edit Test' : 'Create New Test'}
          </h2>
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
                disabled={!!editingTest}
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
                placeholder="In minutes"
              />
            </div>
          </div>

          {editingTest && (
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive !== undefined ? formData.isActive : true}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Active Test</span>
              </label>
            </div>
          )}

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
                        <option value={QuestionType.MULTI_SELECT}>Multi-Select</option>
                        <option value={QuestionType.TRUE_FALSE}>True/False</option>
                        <option value={QuestionType.SHORT_ANSWER}>Short Answer</option>
                        <option value={QuestionType.ESSAY}>Essay</option>
                        <option value={QuestionType.FILE_UPLOAD}>File Upload</option>
                        <option value={QuestionType.CODE}>Code</option>
                        <option value={QuestionType.MATCHING}>Matching</option>
                        <option value={QuestionType.REORDER}>Reorder</option>
                        <option value={QuestionType.FILL_IN_THE_BLANK}>Fill in the Blank</option>
                        <option value={QuestionType.NUMERIC}>Numeric</option>
                      </select>

                      <input
                        type="number"
                        value={question.points || 0}
                        onChange={(e) => updateQuestion(index, 'points', parseInt(e.target.value))}
                        placeholder="Points"
                        className="text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    {renderQuestionFields(question, index)}
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
            {loading
              ? (editingTest ? 'Updating...' : 'Creating...')
              : (editingTest ? 'Update Test' : 'Create Test')
            }
          </button>
        </div>
      </div>
    </div>
  );
}