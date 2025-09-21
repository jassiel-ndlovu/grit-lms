import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Download,
  Plus,
  Upload,
  FileText,
  GripVertical,
  AlertCircle
} from 'lucide-react';
import { QuestionManagerProps } from '@/lib/test-creation-types';
import QuestionCard from './question-card';
import { SortableQuestionItem } from './sortable-question-item';

interface ExtendedQuestionManagerProps extends QuestionManagerProps {
  selectedSubQuestionId?: string | null;
}

export const QuestionsManager: React.FC<ExtendedQuestionManagerProps> = ({
  questions,
  addQuestion,
  addSubQuestion,
  removeQuestion,
  updateQuestion,
  duplicateQuestion,
  moveQuestion,
  exportQuestionsToJson,
  onImport,
  fileHandling,
  fileUploadRef
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
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
        moveQuestion(oldIndex, newIndex);
      }
    }

    setActiveId(null);
  };

  const getActiveQuestion = () => {
    if (!activeId) return null;
    return questions.find(q => q.id === activeId) || null;
  };

  const activeQuestion = getActiveQuestion();

  return (
    <div className="bg-white min-h-full">
      {/* Header with Actions */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-20 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">Question Editor</h3>
            {questions && questions.length > 0 && (
              <div className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                Editing Question
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onImport}
              className="flex items-center gap-2 text-sm px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 hover:shadow-sm border border-gray-200"
              title="Import questions from JSON"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </button>

            <button
              onClick={exportQuestionsToJson}
              disabled={!questions || questions.length === 0}
              className="flex items-center gap-2 text-sm px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 hover:shadow-sm border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export questions to JSON"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              onClick={() => addQuestion()}
              className="flex items-center gap-2 text-sm px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
              title="Add new question"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          </div>
        </div>
      </div>

      {/* Questions List with Drag & Drop */}
      <div className="p-4">
        {questions && questions.length > 0 ? (
          <div className="space-y-4">
            {/* Drag and Drop Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-blue-800 text-sm">
                <GripVertical className="w-4 h-4" />
                <span className="font-medium">Drag & Drop:</span>
                <span>Use the grip handle to reorder questions</span>
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={questions.map(q => q.id as string)} strategy={verticalListSortingStrategy}>
                {questions.map((question, index) => (
                  <SortableQuestionItem
                    key={question.id}
                    id={question.id as string}
                    question={question}
                    index={index}
                    level={question.parentId ? 1 : 0}
                    onUpdate={updateQuestion}
                    onRemove={removeQuestion}
                    onDuplicate={duplicateQuestion}
                    onAddSubQuestion={addSubQuestion}
                    fileHandling={fileHandling}
                    fileUploadRef={fileUploadRef}
                    updateQuestionCallback={updateQuestion}
                    isSubQuestion={!!question.parentId}
                  />
                ))}
              </SortableContext>

              <DragOverlay>
                {activeQuestion ? (
                  <div className="opacity-60 scale-95 shadow-xl z-50 bg-blue-50 border-blue-200 border rounded-lg">
                    <QuestionCard
                      question={activeQuestion}
                      index={questions.findIndex(q => q.id === activeId) || 0}
                      level={activeQuestion.parentId ? 1 : 0}
                      onUpdate={updateQuestion}
                      onRemove={removeQuestion}
                      onDuplicate={duplicateQuestion}
                      onAddSubQuestion={addSubQuestion}
                      onMove={moveQuestion}
                      fileHandling={fileHandling}
                      fileUploadRef={fileUploadRef}
                      updateQuestionCallback={updateQuestion}
                      isSubQuestion={!!activeQuestion.parentId}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        ) : (
          /* Empty State (same as before) */
          <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No questions yet</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Start building your test by creating your first question. You can add different question types and organize them however you need.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => addQuestion()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Plus className="w-5 h-5" />
                Create First Question
              </button>

              <span className="text-gray-400 hidden sm:inline">or</span>

              <button
                onClick={onImport}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-200 transition-all duration-200"
              >
                <Upload className="w-5 h-5" />
                Import Questions
              </button>
            </div>

            {/* Quick Tips */}
            <div className="mt-8 bg-white rounded-lg p-4 max-w-lg mx-auto border border-gray-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-left">
                  <h4 className="text-sm font-medium text-gray-900 mb-1">Quick Tips</h4>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Support for 11 different question types</li>
                    <li>• Drag and drop to reorder questions</li>
                    <li>• Import/export for bulk management</li>
                    <li>• Add sub-questions for complex scenarios</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};