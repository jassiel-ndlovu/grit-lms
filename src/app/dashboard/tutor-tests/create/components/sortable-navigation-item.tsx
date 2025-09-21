// components/sortable-navigation-item.tsx
import React, { useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import { ExtendedTestQuestion } from '@/lib/test-creation-types';

interface SortableNavigationItemProps {
  id: string;
  question: ExtendedTestQuestion;
  index: number;
  selectedQuestionId: string | null;
  setSelectedQuestionId: (id: string | null) => void;
  expandedQuestions: Set<string>;
  toggleQuestionExpansion: (questionId: string) => void;
  isDragging: boolean;
}

export const SortableNavigationItem: React.FC<SortableNavigationItemProps> = ({
  id,
  question,
  index,
  selectedQuestionId,
  setSelectedQuestionId,
  expandedQuestions,
  toggleQuestionExpansion,
  isDragging
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasSubQuestions = question.subQuestions && question.subQuestions.length > 0;
  const isExpanded = expandedQuestions.has(question.id as string);

  // Handle click separately from drag
  const handleClick = useCallback((e: React.MouseEvent) => {
    // Prevent the drag event from interfering with the click
    e.stopPropagation();
    e.preventDefault();
    setSelectedQuestionId(question.id as string);
  }, [question.id, setSelectedQuestionId]);

  const handleExpandClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleQuestionExpansion(question.id as string);
  }, [question.id, toggleQuestionExpansion]);

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className={`transition-all duration-200 ${isDragging ? 'opacity-50' : ''}`}>
        {/* Parent Question */}
        <div
          className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-all duration-200 cursor-pointer border ${
            selectedQuestionId === question.id
              ? 'bg-blue-50 text-blue-900 border-blue-200 shadow-md ring-2 ring-blue-100'
              : 'hover:bg-gray-50 text-gray-700 border-gray-100 hover:border-gray-200 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {/* Drag handle - apply listeners to the grip icon only */}
              <div {...listeners} className="cursor-move p-1 text-gray-400 hover:text-gray-600">
                <GripVertical className="w-3 h-3" />
              </div>
              
              {/* Clickable question number */}
              <span 
                onClick={handleClick}
                className="font-semibold cursor-pointer"
              >
                Q{index + 1}
              </span>
              
              {hasSubQuestions && (
                <button
                  onClick={handleExpandClick}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium px-2 py-1 bg-white rounded-full border">
                {question.points || 0}pts
              </span>
              {hasSubQuestions && (
                <span className="text-xs font-medium px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                  +{(question.subQuestions as ExtendedTestQuestion[]).length}
                </span>
              )}
            </div>
          </div>
          
          {/* Clickable question content */}
          <div 
            onClick={handleClick}
            className="text-xs text-gray-500 mb-2 line-clamp-2 cursor-pointer"
          >
            {question.question || 'Untitled question'}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
              {question.type?.replace(/_/g, ' ').toLowerCase()}
            </div>
            {selectedQuestionId === question.id && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-blue-600 font-medium">Active</span>
              </div>
            )}
          </div>
        </div>

        {/* Sub-questions */}
        {hasSubQuestions && isExpanded && (
          <div className="ml-6 mt-2 space-y-1 border-l-2 border-purple-200 pl-3 bg-gradient-to-r from-purple-50/50 to-transparent rounded-r">
            <div className="text-xs font-medium text-purple-700 mb-2 pl-1">Sub-questions:</div>
            {(question.subQuestions as ExtendedTestQuestion[]).map((subQ, subIndex) => (
              <button
                key={subQ.id}
                onClick={() => setSelectedQuestionId(subQ.id as string)}
                className={`w-full text-left px-3 py-2 rounded-md text-xs transition-all duration-200 border ${
                  selectedQuestionId === subQ.id
                    ? 'bg-purple-50 text-purple-800 border-purple-200 shadow-sm ring-1 ring-purple-100'
                    : 'hover:bg-purple-25 text-gray-600 border-gray-100 hover:border-purple-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <span className="w-1 h-1 bg-purple-400 rounded-full"></span>
                    <span className="font-medium">Q{index + 1}.{subIndex + 1}</span>
                  </div>
                  <span className="text-gray-400 font-medium">{subQ.points || 0}pts</span>
                </div>
                <div className="truncate text-gray-500 pl-2">
                  {subQ.question || 'Untitled sub-question'}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs font-medium px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full">
                    {subQ.type?.replace(/_/g, ' ').toLowerCase()}
                  </div>
                  {selectedQuestionId === subQ.id && (
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-purple-600 font-medium">Active</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};