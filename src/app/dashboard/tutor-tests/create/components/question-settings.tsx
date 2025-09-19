import React from 'react';
import { QuestionType } from '@/generated/prisma';
import { ExtendedTestQuestion } from '@/lib/test-creation-types';

interface QuestionSettingsProps {
  question: ExtendedTestQuestion;
  onUpdate: (questionId: string, field: string, value: any) => void;
}

const QuestionSettings: React.FC<QuestionSettingsProps> = ({
  question,
  onUpdate
}) => {
  const questionTypes = [
    { value: QuestionType.MULTIPLE_CHOICE, label: 'Multiple Choice', description: 'Single correct answer from options' },
    { value: QuestionType.MULTI_SELECT, label: 'Multi-Select', description: 'Multiple correct answers from options' },
    { value: QuestionType.TRUE_FALSE, label: 'True/False', description: 'Binary choice question' },
    { value: QuestionType.SHORT_ANSWER, label: 'Short Answer', description: 'Brief text response' },
    { value: QuestionType.ESSAY, label: 'Essay', description: 'Long-form text response' },
    { value: QuestionType.FILE_UPLOAD, label: 'File Upload', description: 'Student uploads a file' },
    { value: QuestionType.CODE, label: 'Code', description: 'Programming code response' },
    { value: QuestionType.MATCHING, label: 'Matching', description: 'Match items from two lists' },
    { value: QuestionType.REORDER, label: 'Reorder', description: 'Arrange items in correct order' },
    { value: QuestionType.FILL_IN_THE_BLANK, label: 'Fill in the Blank', description: 'Complete missing words/phrases' },
    { value: QuestionType.NUMERIC, label: 'Numeric', description: 'Numerical answer required' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Question Type
          </label>
          <select
            value={question.type || QuestionType.MULTIPLE_CHOICE}
            onChange={(e) => onUpdate(question.id as string, 'type', e.target.value as QuestionType)}
            className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
          >
            {questionTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {questionTypes.find(t => t.value === question.type)?.description || 'Select a question type'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Points
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={question.points || 0}
            onChange={(e) => onUpdate(question.id as string, 'points', parseFloat(e.target.value) || 0)}
            className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
          />
          <p className="text-xs text-gray-500 mt-1">
            Points awarded for correct answer
          </p>
        </div>
      </div>

      {/* Question Type Specific Settings */}
      {question.type === QuestionType.CODE && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Programming Language
          </label>
          <input
            type="text"
            value={question.language || ''}
            onChange={(e) => onUpdate(question.id as string, 'language', e.target.value)}
            placeholder="e.g., JavaScript, Python, Java, C++"
            className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
          />
          <p className="text-xs text-gray-500 mt-1">
            Specify the programming language for syntax highlighting
          </p>
        </div>
      )}

      {question.type === QuestionType.FILL_IN_THE_BLANK && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Number of Blanks
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={question.blankCount || 1}
            onChange={(e) => onUpdate(question.id as string, 'blankCount', parseInt(e.target.value) || 1)}
            className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
          />
          <p className="text-xs text-gray-500 mt-1">
            How many blanks should students fill in?
          </p>
        </div>
      )}

      {/* Question Difficulty Indicator */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Question Guidelines</h4>
        <div className="text-xs text-blue-800 space-y-1">
          {question.type === QuestionType.MULTIPLE_CHOICE && (
            <ul className="list-disc list-inside space-y-0.5">
              <li>Provide 3-5 answer options</li>
              <li>Make distractors plausible but clearly incorrect</li>
              <li>Avoid "all of the above" or "none of the above"</li>
            </ul>
          )}
          {question.type === QuestionType.ESSAY && (
            <ul className="list-disc list-inside space-y-0.5">
              <li>Provide clear evaluation criteria</li>
              <li>Consider partial credit for key points</li>
              <li>Set appropriate point values for complexity</li>
            </ul>
          )}
          {question.type === QuestionType.CODE && (
            <ul className="list-disc list-inside space-y-0.5">
              <li>Provide sample input/output if applicable</li>
              <li>Consider partial credit for logic vs. syntax</li>
              <li>Specify any required functions or constraints</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionSettings;