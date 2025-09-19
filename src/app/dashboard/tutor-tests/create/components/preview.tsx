import React from 'react';
import { GripVertical, File } from 'lucide-react';
import { QuestionType } from '@/generated/prisma';
import { TestFormData, ExtendedTestQuestion } from '@/lib/test-creation-types';
import LessonMarkdown from "@/app/components/markdown";

interface TestPreviewProps {
  formData: TestFormData;
  questions: ExtendedTestQuestion[];
}

const TestPreview: React.FC<TestPreviewProps> = ({ formData, questions }) => {
  const flattenQuestions = (questionsToFlatten: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
    const flattened: ExtendedTestQuestion[] = [];
    questionsToFlatten.forEach(question => {
      flattened.push(question);
      if (question.subQuestions) {
        flattened.push(...flattenQuestions(question.subQuestions));
      }
    });
    return flattened;
  };

  const flatQuestions = flattenQuestions(questions);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white">
      <div className="mb-8 text-center border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {formData.title || 'Untitled Test'}
        </h1>
        {formData.description && (
          <p className="text-gray-600 mb-4">{formData.description}</p>
        )}
        <div className="flex justify-center gap-6 text-sm text-gray-500">
          <span>Total Questions: {flatQuestions.length}</span>
          <span>Total Points: {flatQuestions.reduce((sum, q) => sum + (q.points || 0), 0)}</span>
          {formData.timeLimit && <span>Time Limit: {formData.timeLimit} minutes</span>}
        </div>
      </div>

      {formData.preTestInstructions && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Instructions:</h3>
          <div className="text-blue-800 prose prose-sm max-w-none">
            <LessonMarkdown content={formData.preTestInstructions} />
          </div>
        </div>
      )}

      <div className="space-y-6">
        {flatQuestions.map((question, index) => (
          <div key={question.id} className="border border-gray-200 rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Question {index + 1} {question.parentId ? '(Sub-question)' : ''}
              </h3>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {question.points || 0} pts
              </span>
            </div>

            <div className="mb-4 prose prose-sm max-w-none">
              <LessonMarkdown content={question.question || '*No question text*'} />
            </div>

            {/* Question Type Specific Preview */}
            {question.type === QuestionType.MULTIPLE_CHOICE && question.options && (
              <div className="space-y-2">
                {question.options.map((option, optIndex) => (
                  <div key={optIndex} className="flex items-center gap-2">
                    <input type="radio" disabled className="text-blue-600" />
                    <span>{String.fromCharCode(65 + optIndex)}. {option}</span>
                  </div>
                ))}
              </div>
            )}

            {question.type === QuestionType.MULTI_SELECT && question.options && (
              <div className="space-y-2">
                {question.options.map((option, optIndex) => (
                  <div key={optIndex} className="flex items-center gap-2">
                    <input type="checkbox" disabled className="text-blue-600" />
                    <span>{String.fromCharCode(65 + optIndex)}. {option}</span>
                  </div>
                ))}
              </div>
            )}

            {question.type === QuestionType.TRUE_FALSE && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input type="radio" disabled />
                  <span>True</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="radio" disabled />
                  <span>False</span>
                </div>
              </div>
            )}

            {question.type === QuestionType.SHORT_ANSWER && (
              <input
                type="text"
                disabled
                placeholder="Student will type their answer here..."
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50"
              />
            )}

            {question.type === QuestionType.ESSAY && (
              <textarea
                disabled
                placeholder="Student will type their essay answer here..."
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50"
              />
            )}

            {question.type === QuestionType.CODE && (
              <div className="space-y-2">
                {question.language && (
                  <div className="text-sm text-gray-600">Language: {question.language}</div>
                )}
                <textarea
                  disabled
                  placeholder="Student will write their code here..."
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 font-mono text-sm"
                />
              </div>
            )}

            {question.type === QuestionType.FILE_UPLOAD && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
                <File className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Student will upload their file here</p>
              </div>
            )}

            {question.type === QuestionType.NUMERIC && (
              <input
                type="number"
                disabled
                placeholder="Student will enter a number here..."
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50"
              />
            )}

            {question.type === QuestionType.FILL_IN_THE_BLANK && (
              <div className="space-y-2">
                {Array.from({ length: question.blankCount || 1 }).map((_, blankIndex) => (
                  <div key={blankIndex} className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Blank {blankIndex + 1}:</span>
                    <input
                      type="text"
                      disabled
                      placeholder="Student answer here..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded bg-gray-50"
                    />
                  </div>
                ))}
              </div>
            )}

            {question.type === QuestionType.MATCHING && question.matchPairs && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Left Items:</h4>
                  <div className="space-y-1">
                    {(question.matchPairs as Array<{ left: string, right: string }>).map((pair, index) => (
                      <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                        {pair.left}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Right Items:</h4>
                  <div className="space-y-1">
                    {(question.matchPairs as Array<{ left: string, right: string }>).map((pair, index) => (
                      <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                        {pair.right}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {question.type === QuestionType.REORDER && question.reorderItems && (
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Items to reorder:</h4>
                <div className="space-y-1">
                  {question.reorderItems.map((item, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded text-sm flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-gray-400" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestPreview;