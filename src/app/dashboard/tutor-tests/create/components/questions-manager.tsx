import React from 'react';
import { Download, Plus, Upload, FileText } from 'lucide-react';
import { QuestionManagerProps } from '@/lib/test-creation-types';
import QuestionCard from './question-card';

const QuestionsManager: React.FC<QuestionManagerProps> = ({
  questions,
  addQuestion,
  removeQuestion,
  updateQuestion,
  duplicateQuestion,
  moveQuestion,
  exportQuestionsToJson,
  onImport,
  fileHandling,
  fileUploadRef
}) => {
  return (
    <div className="bg-white">
      <div className="flex items-center justify-between p-2">
        <h3 className="text-lg font-medium text-gray-900">Questions</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onImport}
            className="flex items-center gap-2 text-sm px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button
            onClick={exportQuestionsToJson}
            disabled={!questions || questions.length === 0}
            className="flex items-center gap-2 text-sm px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => addQuestion()}
            className="flex items-center gap-2 text-sm px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {questions && questions.map((question, index) => (
          <QuestionCard
            key={question.id}
            question={question}
            index={index}
            level={0}
            onUpdate={updateQuestion}
            onRemove={removeQuestion}
            onDuplicate={duplicateQuestion}
            onAddSubQuestion={addQuestion}
            onMove={moveQuestion}
            fileHandling={fileHandling}
            fileUploadRef={fileUploadRef}
            updateQuestionCallback={updateQuestion}
          />
        ))}
      </div>

      {(!questions || questions.length === 0) && (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-2">No questions added yet</p>
          <p className="text-sm mb-4">Start building your test by adding your first question</p>
          <button
            onClick={() => addQuestion()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Question
          </button>
        </div>
      )}
    </div>
  );
};

export default QuestionsManager;