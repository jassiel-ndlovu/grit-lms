import React from 'react';
import { File } from 'lucide-react';
import { ExtendedTestQuestion, FileHandlingProps } from '@/lib/test-creation-types';
import LessonMarkdown from "@/app/components/markdown";

interface QuestionContentProps {
  question: ExtendedTestQuestion;
  onUpdate: (questionId: string, field: string, value: any) => void;
  fileHandling: FileHandlingProps;
  updateQuestionCallback: (questionId: string, field: string, value: any) => void;
}

const QuestionContent: React.FC<QuestionContentProps> = ({
  question,
  onUpdate,
  fileHandling,
  updateQuestionCallback
}) => {
  const { handleDrop, handleFileInput, isUploading } = fileHandling;
  const [dragCounter, setDragCounter] = React.useState(0);

  return (
    <div className="space-y-4">
      <div
        className="relative"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragCounter((c) => c + 1);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragCounter((c) => Math.max(c - 1, 0));
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragCounter(0);
          handleDrop(e, question.id as string, question.question as string, updateQuestionCallback);
        }}
      >
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Question Text
        </label>
        <textarea
          value={question.question || ''}
          onChange={(e) => onUpdate(question.id as string, 'question', e.target.value)}
          placeholder="Enter your question (Markdown supported)..."
          className="w-full font-mono text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
          rows={4}
        />

        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          {isUploading && (
            <div className="text-xs text-gray-500">Uploading...</div>
          )}
          <label className="cursor-pointer p-1 text-gray-500 hover:text-blue-600 transition-colors">
            <File className="w-4 h-4" />
            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => handleFileInput(e, question.id as string, question.question as string, updateQuestionCallback)}
              disabled={isUploading}
            />
          </label>
        </div>

        {dragCounter > 0 && (
          <div className="absolute inset-0 bg-blue-50 border-2 border-dashed border-blue-400 rounded flex items-center justify-center">
            <div className="text-blue-600 font-medium">Drop file here</div>
          </div>
        )}
      </div>

      <div className="p-3 bg-gray-50 rounded border">
        <label className="block text-sm font-medium text-gray-700 mb-2">Preview:</label>
        <div className="text-sm prose prose-sm max-w-none">
          <LessonMarkdown
            content={question.question || "*Type your question above...*"}
          />
        </div>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        <p><strong>Markdown Tips:</strong></p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Use **bold** and *italic* for emphasis</li>
          <li>Create code blocks with ```language</li>
          <li>Add links with [text](url)</li>
          <li>Drag and drop files to insert them</li>
        </ul>
      </div>
    </div>
  );
};

export default QuestionContent;