// components/sortable-navigation-item.tsx
import React, { useCallback, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import { ExtendedTestQuestion } from '@/lib/test-creation-types';

interface SortableNavigationItemProps {
  id: string;
  question: ExtendedTestQuestion;
  index: number;
  selectedQuestionId: string | null;
  setSelectedQuestionId: (id: string) => void;
  expandedQuestions: Set<string>;
  toggleQuestionExpansion: (questionId: string) => void;
  isDragging: boolean;
  onSubQuestionsReorder?: (parentId: string, reorderedSubQuestions: ExtendedTestQuestion[]) => void;
}

// Sub-question sortable item component
const SortableSubQuestionItem: React.FC<{
  subQuestion: ExtendedTestQuestion;
  parentIndex: number;
  subIndex: number;
  selectedQuestionId: string | null;
  setSelectedQuestionId: (id: string) => void;
  isDragging: boolean;
}> = ({ subQuestion, parentIndex, subIndex, selectedQuestionId, setSelectedQuestionId, isDragging }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: subQuestion.id as string });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedQuestionId(subQuestion.id as string);
  }, [subQuestion.id, setSelectedQuestionId]);

  const handleDragHandleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`transition-all duration-200 ${isDragging ? 'opacity-50' : ''}`}
    >
      <button
        onClick={handleClick}
        className={`w-full text-left px-3 py-2 rounded-md text-xs transition-all duration-200 border ${
          selectedQuestionId === subQuestion.id
            ? 'bg-purple-50 text-purple-800 border-purple-200 shadow-sm ring-1 ring-purple-100'
            : 'hover:bg-purple-25 text-gray-600 border-gray-100 hover:border-purple-200'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            {/* Sub-question drag handle */}
            <div 
              {...listeners}
              onClick={handleDragHandleClick}
              className="cursor-grab active:cursor-grabbing p-0.5 text-purple-400 hover:text-purple-600"
            >
              <GripVertical className="w-2.5 h-2.5" />
            </div>
            <span className="w-1 h-1 bg-purple-400 rounded-full"></span>
            <span className="font-medium">Q{parentIndex + 1}.{subIndex + 1}</span>
          </div>
          <span className="text-gray-400 font-medium">{subQuestion.points || 0}pts</span>
        </div>
        <div className="truncate text-gray-500 pl-2">
          {subQuestion.question || 'Untitled sub-question'}
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="text-xs font-medium px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full">
            {subQuestion.type?.replace(/_/g, ' ').toLowerCase()}
          </div>
          {selectedQuestionId === subQuestion.id && (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-purple-600 font-medium">Active</span>
            </div>
          )}
        </div>
      </button>
    </div>
  );
};

export const SortableNavigationItem: React.FC<SortableNavigationItemProps> = ({
  id,
  question,
  index,
  selectedQuestionId,
  setSelectedQuestionId,
  expandedQuestions,
  toggleQuestionExpansion,
  isDragging,
  onSubQuestionsReorder
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const [activeSubQuestionId, setActiveSubQuestionId] = useState<string | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasSubQuestions = question.subQuestions && question.subQuestions.length > 0;
  const isExpanded = expandedQuestions.has(question.id as string);
  const subQuestions = question.subQuestions || [];

  // Sensors for sub-question DndContext
  const subQuestionSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Fixed click handler - only handle clicks, not drags
  const handleClick = useCallback((e: React.MouseEvent) => {
    // Prevent drag from triggering click
    if (e.defaultPrevented) return;
    
    setSelectedQuestionId(question.id as string);
  }, [question.id, setSelectedQuestionId]);

  const handleExpandClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleQuestionExpansion(question.id as string);
  }, [question.id, toggleQuestionExpansion]);

  // Separate handler for drag handle to prevent click interference
  const handleDragHandleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Handle sub-question drag end
  const handleSubQuestionDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onSubQuestionsReorder) {
      const oldIndex = subQuestions.findIndex(q => q.id === active.id);
      const newIndex = subQuestions.findIndex(q => q.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedSubQuestions = arrayMove(subQuestions, oldIndex, newIndex);
        onSubQuestionsReorder(question.id as string, reorderedSubQuestions);
      }
    }

    setActiveSubQuestionId(null);
  }, [subQuestions, question.id, onSubQuestionsReorder]);

  const handleSubQuestionDragStart = useCallback((event: DragStartEvent) => {
    setActiveSubQuestionId(event.active.id as string);
  }, []);

  const getActiveSubQuestion = () => {
    if (!activeSubQuestionId) return null;
    return subQuestions.find(q => q.id === activeSubQuestionId) || null;
  };

  const activeSubQuestion = getActiveSubQuestion();

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes}
      onClick={handleClick}
      className="cursor-pointer"
    >
      <div className={`transition-all duration-200 ${isDragging ? 'opacity-50' : ''}`}>
        {/* Parent Question */}
        <div
          className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-all duration-200 border ${
            selectedQuestionId === question.id
              ? 'bg-blue-50 text-blue-900 border-blue-200 shadow-md ring-2 ring-blue-100'
              : 'hover:bg-gray-50 text-gray-700 border-gray-100 hover:border-gray-200 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {/* Drag handle - ONLY for dragging, not clicking */}
              <div 
                {...listeners}
                onClick={handleDragHandleClick}
                className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600"
              >
                <GripVertical className="w-3 h-3" />
              </div>
              
              {/* Question number - clickable */}
              <span className="font-semibold">
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
                  +{subQuestions.length}
                </span>
              )}
            </div>
          </div>
          
          {/* Question content - clickable */}
          <div className="text-xs text-gray-500 mb-2 line-clamp-2">
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

        {/* Sub-questions with their own DndContext */}
        {hasSubQuestions && isExpanded && (
          <div className="ml-6 mt-2 space-y-1 border-l-2 border-purple-200 pl-3 bg-gradient-to-r from-purple-50/50 to-transparent rounded-r">
            <div className="text-xs font-medium text-purple-700 mb-2 pl-1">Sub-questions:</div>
            <DndContext
              sensors={subQuestionSensors}
              collisionDetection={closestCenter}
              onDragStart={handleSubQuestionDragStart}
              onDragEnd={handleSubQuestionDragEnd}
            >
              <SortableContext 
                items={subQuestions.map(q => q.id as string)} 
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-1">
                  {subQuestions.map((subQ, subIndex) => (
                    <SortableSubQuestionItem
                      key={subQ.id}
                      subQuestion={subQ}
                      parentIndex={index}
                      subIndex={subIndex}
                      selectedQuestionId={selectedQuestionId}
                      setSelectedQuestionId={setSelectedQuestionId}
                      isDragging={activeSubQuestionId === subQ.id}
                    />
                  ))}
                </div>
              </SortableContext>

              {/* Sub-question Drag Overlay */}
              <DragOverlay>
                {activeSubQuestion ? (
                  <div className="opacity-80 transform rotate-1 shadow-lg border border-purple-300 rounded-md">
                    <div className="bg-white p-2 rounded-md text-xs">
                      <div className="flex items-center gap-1 mb-1">
                        <GripVertical className="w-2.5 h-2.5 text-purple-500" />
                        <span className="font-medium">
                          Q{index + 1}.{subQuestions.findIndex(q => q.id === activeSubQuestionId) + 1}
                        </span>
                        <span className="text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full">
                          {activeSubQuestion.points || 0}pts
                        </span>
                      </div>
                      <div className="text-gray-600 truncate">
                        {activeSubQuestion.question || 'Untitled sub-question'}
                      </div>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}
      </div>
    </div>
  );
};