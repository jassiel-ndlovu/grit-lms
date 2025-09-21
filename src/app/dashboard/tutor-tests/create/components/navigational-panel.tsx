// components/navigation-panel-dnd.tsx
import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { BookOpen, Calculator, Plus, ChevronRight, ChevronDown } from 'lucide-react';
import { ExtendedTestQuestion } from '@/lib/test-creation-types';
import { SortableNavigationItem } from './sortable-navigation-item';

interface NavigationPanelProps {
  questions: ExtendedTestQuestion[];
  selectedQuestionId: string | null;
  setSelectedQuestionId: (id: string | null) => void;
  onAddQuestion: () => void;
  onImport: () => void;
  onExport: () => void;
  hasQuestions: boolean;
  totalPoints: number;
  flatQuestions: ExtendedTestQuestion[];
  onMoveQuestion: (fromIndex: number, toIndex: number) => void;
}

export const NavigationPanel: React.FC<NavigationPanelProps> = ({
  questions,
  selectedQuestionId,
  setSelectedQuestionId,
  onAddQuestion,
  onImport,
  onExport,
  hasQuestions,
  totalPoints,
  flatQuestions,
  onMoveQuestion
}) => {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex(q => q.id === active.id);
      const newIndex = questions.findIndex(q => q.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        onMoveQuestion(oldIndex, newIndex);
      }
    }

    setActiveId(null);
  };

  const toggleQuestionExpansion = (questionId: string) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto shadow-sm">
      {/* Navigation Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Questions Navigator</h3>
          <button
            onClick={onAddQuestion}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>

        {/* Enhanced Quick Stats */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-white p-3 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-1 text-gray-600 mb-1">
              <BookOpen className="w-4 h-4 text-blue-500" />
              Questions
            </div>
            <div className="text-lg font-bold text-gray-900">{flatQuestions.length}</div>
          </div>
          <div className="bg-white p-3 rounded-lg border shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-1 text-gray-600 mb-1">
              <Calculator className="w-4 h-4 text-green-500" />
              Total Points
            </div>
            <div className="text-lg font-bold text-gray-900">{totalPoints}</div>
          </div>
        </div>
      </div>

      {/* Question Navigation */}
      <div className="p-2">
        {questions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium mb-1">No questions yet</p>
            <p className="text-xs text-gray-400 mb-3">Start building your test</p>
            <button
              onClick={onAddQuestion}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              Add your first question
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={questions.map(q => q.id as string)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {questions.map((question, index) => (
                  <SortableNavigationItem
                    key={question.id}
                    id={question.id as string}
                    question={question}
                    index={index}
                    selectedQuestionId={selectedQuestionId}
                    setSelectedQuestionId={setSelectedQuestionId}
                    expandedQuestions={expandedQuestions}
                    toggleQuestionExpansion={toggleQuestionExpansion}
                    isDragging={activeId === question.id}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-t border-gray-200 mt-auto bg-gray-50">
        <div className="space-y-2">
          <button
            onClick={onImport}
            className="w-full text-center px-3 py-2 text-sm text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 rounded-md transition-all duration-200 hover:shadow-sm"
          >
            Import Questions
          </button>
          <button
            onClick={onExport}
            disabled={!hasQuestions}
            className="w-full text-center px-3 py-2 text-sm text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 rounded-md transition-all duration-200 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export Questions
          </button>
        </div>
      </div>
    </div>
  );
};