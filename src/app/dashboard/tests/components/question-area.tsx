/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { ChevronLeft, ChevronRight, Eraser, Flag } from 'lucide-react';
import LessonMarkdown from '@/app/components/markdown';
import { QuestionInput } from './question-input';

interface QuestionAreaProps {
  test: AppTypes.Test;
  currentQuestionId: string; // Changed from index to ID
  answers: AppTypes.AnswerMap;
  matchingAnswers: Record<string, Record<string, string>>;
  isUploading: boolean;
  onQuestionChange: (questionId: string) => void; // Changed to accept questionId
  onAnswerChange: (questionId: string, answer: any) => void;
  onMatchingAnswerChange: (questionId: string, leftItem: string, rightItem: string) => void;
  onClearAnswer: (questionId: string) => void;
  onClearFileUploadAnswer: (questionId: string) => void;
  flatQuestions: AppTypes.TestQuestion[]; // Add flat list for navigation
}

export const QuestionArea: React.FC<QuestionAreaProps> = ({
  test,
  currentQuestionId,
  answers,
  matchingAnswers,
  isUploading,
  onQuestionChange,
  onAnswerChange,
  onMatchingAnswerChange,
  onClearAnswer,
  onClearFileUploadAnswer,
  flatQuestions
}) => {
  // Find current question and its position
  const currentQuestionIndex = flatQuestions.findIndex(q => q.id === currentQuestionId);
  const currentQuestion = flatQuestions[currentQuestionIndex];
  
  const hasPrevious = currentQuestionIndex > 0;
  const hasNext = currentQuestionIndex < flatQuestions.length - 1;

  // Get previous and next question IDs
  const previousQuestionId = hasPrevious ? flatQuestions[currentQuestionIndex - 1].id : null;
  const nextQuestionId = hasNext ? flatQuestions[currentQuestionIndex + 1].id : null;

  // Helper function to get question display number
  const getQuestionDisplayNumber = (question: AppTypes.TestQuestion): string => {
    if (!question.parentId) {
      // Root question - find its index in root questions
      const rootIndex = test.questions.findIndex(q => q.id === question.id);
      return `${rootIndex + 1}`;
    } else {
      // Sub-question - find parent and sub-question index
      const parent = test.questions.find(q => 
        q.subQuestions?.some(sq => sq.id === question.id)
      );
      if (parent) {
        const subIndex = parent.subQuestions?.findIndex(sq => sq.id === question.id) ?? -1;
        const parentIndex = test.questions.findIndex(q => q.id === parent.id);
        return `${parentIndex + 1}.${subIndex + 1}`;
      }
    }
    return '?';
  };

  const displayNumber = currentQuestion ? getQuestionDisplayNumber(currentQuestion) : '?';

  if (!currentQuestion) {
    return (
      <div className="bg-white/80 backdrop-blur-lg rounded-2xl border border-gray-200/60 shadow-sm p-8 text-center">
        <div className="text-gray-500">Question not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Question Card */}
      <div className="bg-white/80 backdrop-blur-lg rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
        {/* Question Header */}
        <div className="p-6 lg:p-8 border-b border-gray-200/60 bg-gradient-to-r from-gray-50 to-blue-50/30">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                  {displayNumber}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {currentQuestion.parentId ? `Part ${displayNumber}` : `Question ${displayNumber}`}
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                      {currentQuestion.points} {currentQuestion.points === 1 ? 'point' : 'points'}
                    </span>
                    <span>•</span>
                    <span className="capitalize">
                      {currentQuestion.type.replace(/_/g, ' ').toLowerCase()}
                    </span>
                    {currentQuestion.parentId && (
                      <>
                        <span>•</span>
                        <span className="text-orange-600">Sub-question</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">
                {currentQuestionIndex + 1} of {flatQuestions.length}
              </span>
            </div>
          </div>

          {/* Question Content */}
          <div className="prose prose-sm max-w-none">
            <LessonMarkdown content={currentQuestion.question} />
          </div>
        </div>

        {/* Answer Area */}
        <div className="p-6 lg:p-8">
          <QuestionInput
            question={currentQuestion}
            answer={answers[currentQuestion.id]}
            matchingAnswers={matchingAnswers[currentQuestion.id] || {}}
            isUploading={isUploading}
            onAnswerChange={onAnswerChange}
            onMatchingAnswerChange={onMatchingAnswerChange}
          />
        </div>

        {/* Navigation Footer */}
        <div className="px-6 lg:px-8 py-4 border-t border-gray-200/60 bg-gray-50/30">
          <div className="flex items-center justify-between">
            <button
              onClick={() => previousQuestionId && onQuestionChange(previousQuestionId)}
              disabled={!hasPrevious || isUploading}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="flex items-center gap-4">
              {answers[currentQuestion.id] && (
                <button
                  onClick={() => {
                    if (currentQuestion.type === 'FILE_UPLOAD') {
                      onClearFileUploadAnswer(currentQuestion.id);
                    } else {
                      onClearAnswer(currentQuestion.id);
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Eraser className="w-4 h-4" />
                  Clear Answer
                </button>
              )}
            </div>

            <button
              onClick={() => nextQuestionId && onQuestionChange(nextQuestionId)}
              disabled={!hasNext || isUploading}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      {/* <div className="flex justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {flatQuestions.map((question, index) => (
            <div
              key={question.id}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                question.id === currentQuestionId
                  ? 'bg-blue-600 scale-125'
                  : index < currentQuestionIndex
                  ? 'bg-green-500'
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div> */}
    </div>
  );
};