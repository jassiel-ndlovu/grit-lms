import React from 'react';
import { Plus, Trash2, File, FileTextIcon } from 'lucide-react';
import { QuestionType } from '@/generated/prisma';
import { ExtendedTestQuestion, FileHandlingProps } from '@/lib/test-creation-types';

interface QuestionAnswerProps {
  question: ExtendedTestQuestion;
  onUpdate: (questionId: string, field: string, value: any) => void;
  fileUploadRef: React.RefObject<HTMLInputElement>;
  fileHandling: FileHandlingProps;
  updateQuestionCallback: (questionId: string, field: string, value: any) => void;
}

const QuestionAnswer: React.FC<QuestionAnswerProps> = ({
  question,
  onUpdate,
  fileUploadRef,
  fileHandling,
  updateQuestionCallback
}) => {
  const { handleDrop, handleFileInput } = fileHandling;

  const renderFileUploadOption = () => (
    <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
      <h4 className="text-sm font-medium text-gray-700 mb-2">Answer File Upload (Optional)</h4>

      {typeof question.answer === 'string' &&
        (question.answer.startsWith('http://') || question.answer.startsWith('https://')) ? (
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center gap-2">
            <FileTextIcon className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-800">
              File uploaded: {question.answer.split('/').pop()}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onUpdate(question.id as string, 'answer', '')}
            className="text-red-500 hover:text-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center cursor-pointer hover:border-blue-400 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, question.id as string, updateQuestionCallback)}
          onClick={() => fileUploadRef.current?.click()}
        >
          <File className="w-6 h-6 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">
            Drag & drop or click to upload answer file
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Supports PDF, Word documents, and images
          </p>
          <input
            ref={fileUploadRef}
            type="file"
            accept=".pdf,.doc,.docx,image/*"
            className="hidden"
            onChange={(e) => handleFileInput(e, question.id as string, updateQuestionCallback)}
          />
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500">
        <p>You can either provide a text answer below or upload a file with the answer.</p>
        <p>If both are provided, the file will take precedence.</p>
      </div>
    </div>
  );

  const renderAnswerInput = () => {
    switch (question.type) {
      case QuestionType.MULTIPLE_CHOICE:
      case QuestionType.MULTI_SELECT:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Options:</label>
              {(question.options || []).map((option, optIndex) => (
                <div key={optIndex} className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-500 w-8">{String.fromCharCode(65 + optIndex)}.</span>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...(question.options || [])];
                      newOptions[optIndex] = e.target.value;
                      onUpdate(question.id as string, 'options', newOptions);
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                    className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newOptions = [...(question.options || [])];
                      newOptions.splice(optIndex, 1);
                      onUpdate(question.id as string, 'options', newOptions);
                    }}
                    className="text-red-500 hover:text-red-700 p-1 transition-colors"
                    disabled={question.options && question.options.length <= 2}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const newOptions = [...(question.options || []), ''];
                  onUpdate(question.id as string, 'options', newOptions);
                }}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correct Answer{question.type === QuestionType.MULTI_SELECT ? 's (comma-separated)' : ''}
              </label>
              <input
                type="text"
                value={typeof question.answer === 'string' &&
                  !question.answer.startsWith('http://') &&
                  !question.answer.startsWith('https://')
                  ? question.answer : ''}
                onChange={(e) => onUpdate(question.id as string, 'answer', e.target.value)}
                placeholder={question.type === QuestionType.MULTI_SELECT ?
                  "Correct answers (comma-separated, e.g., A, C)" :
                  "Correct answer (e.g., A)"}
                className="w-full text-sm px-3 py-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none transition-colors"
              />
            </div>

            {renderFileUploadOption()}
          </div>
        );

      case QuestionType.TRUE_FALSE:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correct Answer
              </label>
              <select
                value={typeof question.answer === 'boolean' ? question.answer.toString() :
                  typeof question.answer === 'string' &&
                    !question.answer.startsWith('http://') &&
                    !question.answer.startsWith('https://')
                    ? question.answer : ''}
                onChange={(e) => {
                  if (e.target.value === 'true' || e.target.value === 'false') {
                    onUpdate(question.id as string, 'answer', e.target.value === 'true');
                  } else {
                    onUpdate(question.id as string, 'answer', e.target.value);
                  }
                }}
                className="w-full text-sm px-3 py-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none transition-colors"
              >
                <option value="">Select correct answer</option>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            </div>
            {renderFileUploadOption()}
          </div>
        );

      case QuestionType.NUMERIC:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correct Numeric Answer
              </label>
              <input
                type="number"
                step="any"
                value={typeof question.answer === 'number' ? question.answer :
                  typeof question.answer === 'string' &&
                    !question.answer.startsWith('http://') &&
                    !question.answer.startsWith('https://')
                    ? question.answer : ''}
                onChange={(e) => onUpdate(question.id as string, 'answer', parseFloat(e.target.value))}
                placeholder="Correct numeric answer"
                className="w-full text-sm px-3 py-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none transition-colors"
              />
            </div>
            {renderFileUploadOption()}
          </div>
        );

      case QuestionType.FILL_IN_THE_BLANK:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correct Answers {question.blankCount && question.blankCount > 1 ? '(one per blank)' : ''}
              </label>
              {question.blankCount === 1 ? (
                <input
                  type="text"
                  value={typeof question.answer === 'string' &&
                    !question.answer.startsWith('http://') &&
                    !question.answer.startsWith('https://')
                    ? question.answer : ''}
                  onChange={(e) => onUpdate(question.id as string, 'answer', e.target.value)}
                  placeholder="Correct answer"
                  className="w-full text-sm px-3 py-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none transition-colors"
                />
              ) : (
                <div className="space-y-2">
                  {Array.from({ length: question.blankCount || 1 }).map((_, blankIndex) => (
                    <input
                      key={blankIndex}
                      type="text"
                      value={Array.isArray(question.answer) ? question.answer[blankIndex] as string || '' : ''}
                      onChange={(e) => {
                        const newAnswers = Array.isArray(question.answer) ? [...question.answer] : [];
                        newAnswers[blankIndex] = e.target.value;
                        onUpdate(question.id as string, 'answer', newAnswers);
                      }}
                      placeholder={`Blank ${blankIndex + 1} answer`}
                      className="w-full text-sm px-3 py-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none transition-colors"
                    />
                  ))}
                </div>
              )}
            </div>
            {renderFileUploadOption()}
          </div>
        );

      case QuestionType.CODE:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expected Code Answer
              </label>
              <textarea
                value={typeof question.answer === 'string' &&
                  !question.answer.startsWith('http://') &&
                  !question.answer.startsWith('https://')
                  ? question.answer : ''}
                onChange={(e) => onUpdate(question.id as string, 'answer', e.target.value)}
                placeholder="Expected code answer"
                rows={6}
                className="w-full font-mono text-sm px-3 py-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none transition-colors"
              />
            </div>
            {renderFileUploadOption()}
          </div>
        );

      case QuestionType.FILE_UPLOAD:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Correct Answer File
              </label>
              {renderFileUploadOption()}
            </div>
          </div>
        );

      case QuestionType.SHORT_ANSWER:
      case QuestionType.ESSAY:
      default:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expected Answer
              </label>
              <textarea
                value={typeof question.answer === 'string' &&
                  !question.answer.startsWith('http://') &&
                  !question.answer.startsWith('https://')
                  ? question.answer : ''}
                onChange={(e) => onUpdate(question.id as string, 'answer', e.target.value)}
                placeholder="Expected answer"
                rows={question.type === QuestionType.ESSAY ? 6 : 3}
                className="w-full text-sm px-3 py-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none transition-colors"
              />
            </div>
            {renderFileUploadOption()}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {renderAnswerInput()}
      
      <div className="bg-green-50 p-4 rounded-lg">
        <h4 className="text-sm font-medium text-green-900 mb-2">Answer Guidelines</h4>
        <div className="text-xs text-green-800">
          <p>
            Provide clear, complete answers that help with automated grading. 
            For subjective questions, consider partial credit criteria.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QuestionAnswer;