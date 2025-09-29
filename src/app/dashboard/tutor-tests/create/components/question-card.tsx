import React, { useState, useRef } from 'react';
import { Copy, ChevronRight, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { ExtendedTestQuestion, FileHandlingProps, QuestionTab } from '@/lib/test-creation-types';
import QuestionContent from './question-content';
import QuestionAnswer from './question-answer';
import QuestionSettings from './question-settings';
import QuestionTabs from './question-tabs';

interface QuestionCardProps {
  question: ExtendedTestQuestion;
  index: number;
  level: number;
  onUpdate: (questionId: string, field: string, value: any) => void;
  onRemove: (questionId: string) => void;
  onDuplicate: (questionId: string) => void;
  onAddSubQuestion: (parentId: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  fileHandling: FileHandlingProps;
  fileUploadRef: React.RefObject<HTMLInputElement>;
  updateQuestionCallback: (questionId: string, field: string, value: any) => void;
  isSubQuestion?: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  level,
  onUpdate,
  onRemove,
  onDuplicate,
  onAddSubQuestion,
  onMove,
  fileHandling,
  fileUploadRef,
  updateQuestionCallback,
  isSubQuestion = false
}) => {
  const [activeTab, setActiveTab] = useState<QuestionTab>('content');
  const [isExpanded, setIsExpanded] = useState(true);

  console.log("QuestionCard index", index, "QuestionCard order", question.order);

  const hasSubQuestions = question.subQuestions && question.subQuestions.length > 0;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'content':
        return (
          <QuestionContent
            question={question}
            onUpdate={onUpdate}
            fileHandling={fileHandling}
            updateQuestionCallback={updateQuestionCallback}
          />
        );
      case 'settings':
        return (
          <QuestionSettings
            question={question}
            onUpdate={onUpdate}
          />
        );
      case 'answer':
        return (
          <QuestionAnswer
            question={question}
            onUpdate={onUpdate}
            fileUploadRef={fileUploadRef}
            fileHandling={fileHandling}
            updateQuestionCallback={updateQuestionCallback}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`border border-gray-200 rounded-r-lg ${level > 0 ? 'ml-8 mt-2 border-l-2 border-l-purple-500' : ''}`}>
      {/* Question Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-gray-900">
            {level === 0 ? `Question ${index + 1}` : `Sub-question ${index + 1}`}
            <span className="text-gray-500 ml-2">({question.points || 0} pts)</span>
          </h4>

          {hasSubQuestions && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onDuplicate(question.id as string)}
            className="text-gray-500 hover:text-blue-600 p-1 transition-colors"
            title="Duplicate question"
          >
            <Copy className="w-4 h-4" />
          </button>

          {/* Only show add sub-question button for parent questions, not subquestions */}
          {level === 0 && !isSubQuestion && (
            <button
              onClick={() => onAddSubQuestion(question.id as string)}
              className="text-gray-500 hover:text-green-600 p-1 transition-colors"
              title="Add sub-question"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => onRemove(question.id as string)}
            className="text-gray-500 hover:text-red-600 p-1 transition-colors"
            title="Delete question"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Question Content */}
      <div className="p-4">
        <QuestionTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div className="mt-4">
          {renderTabContent()}
        </div>
      </div>

      {/* Sub-questions */}
      {hasSubQuestions && isExpanded && (
        <div className="border-t border-gray-200 bg-gray-25 p-2">
          <div className="space-y-2">
            {question.subQuestions!.map((subQuestion, subIndex) => (
              <QuestionCard
                key={subQuestion.id}
                question={subQuestion}
                index={subIndex}
                level={level + 1}
                onUpdate={onUpdate}
                onRemove={onRemove}
                onDuplicate={onDuplicate}
                onAddSubQuestion={onAddSubQuestion}
                onMove={onMove}
                fileHandling={fileHandling}
                fileUploadRef={fileUploadRef}
                updateQuestionCallback={updateQuestionCallback}
                isSubQuestion={true}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionCard;