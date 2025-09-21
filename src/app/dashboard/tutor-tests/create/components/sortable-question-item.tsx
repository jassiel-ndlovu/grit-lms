import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ExtendedTestQuestion, FileHandlingProps } from '@/lib/test-creation-types';
import QuestionCard from './question-card';
import { GripVertical } from 'lucide-react';

interface SortableQuestionItemProps {
  id: string;
  question: ExtendedTestQuestion;
  index: number;
  level: number;
  onUpdate: (questionId: string, field: string, value: any) => void;
  onRemove: (questionId: string) => void;
  onDuplicate: (questionId: string) => void;
  onAddSubQuestion: (parentId: string) => void;
  fileHandling: FileHandlingProps;
  fileUploadRef: React.RefObject<HTMLInputElement>;
  updateQuestionCallback: (questionId: string, field: string, value: any) => void;
  isSubQuestion: boolean;
}

export const SortableQuestionItem: React.FC<SortableQuestionItemProps> = ({
  id,
  question,
  index,
  level,
  onUpdate,
  onRemove,
  onDuplicate,
  onAddSubQuestion,
  fileHandling,
  fileUploadRef,
  updateQuestionCallback,
  isSubQuestion
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Dummy move function since dnd-kit handles the movement
  const dummyMove = () => {};

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className={`relative transition-all duration-200 ${isDragging ? 'opacity-50' : ''}`}>
        {/* Dedicated Drag Handle */}
        <div
          {...listeners}
          className="absolute left-0 top-0 bottom-0 w-10 z-20 flex items-center justify-center cursor-move group hover:bg-blue-50 rounded-l-lg transition-all duration-200"
          title="Drag to reorder questions"
        >
          <div className="bg-gray-100 group-hover:bg-white rounded-md border border-gray-200 group-hover:border-blue-300 p-1.5 transition-all duration-200 group-hover:shadow-md">
            <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
          </div>
        </div>

        {/* Question Card */}
        <div className="ml-4 relative border border-gray-200 rounded-lg bg-white">
          <QuestionCard
            question={question}
            index={index}
            level={level}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onDuplicate={onDuplicate}
            onAddSubQuestion={onAddSubQuestion}
            onMove={dummyMove}
            fileHandling={fileHandling}
            fileUploadRef={fileUploadRef}
            updateQuestionCallback={updateQuestionCallback}
            isSubQuestion={isSubQuestion}
          />
        </div>
      </div>
    </div>
  );
};