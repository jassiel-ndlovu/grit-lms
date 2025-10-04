/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useMemo } from 'react';
import { Upload, Trash2, ImageIcon, FileText, Download, ArrowRight } from 'lucide-react';
import LessonMarkdown from '@/app/components/markdown';
import { uploadFile, deleteFile } from '@/lib/blob';

interface QuestionInputProps {
  question: AppTypes.TestQuestion;
  answer: any;
  matchingAnswers: Record<string, string>;
  isUploading: boolean;
  onAnswerChange: (questionId: string, answer: any) => void;
  onMatchingAnswerChange: (questionId: string, leftItem: string, rightItem: string) => void;
}

type FileUploadAnswer = {
  fileUrl: string;
  fileType: string;
  fileName: string;
};

// Fisher-Yates shuffle algorithm
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const QuestionInput: React.FC<QuestionInputProps> = ({
  question,
  answer,
  matchingAnswers,
  onAnswerChange,
  onMatchingAnswerChange
}) => {
  const [dragOver, setDragOver] = useState(false);

  // Memoized shuffled options for various question types
  const shuffledOptions = useMemo(() => {
    const result: {
      multipleChoice?: string[];
      multiSelect?: string[];
      matching?: {
        leftItems: string[];
        rightItems: string[];
        originalPairs: Array<{ left: string; right: string }>;
      };
      reorder?: string[];
    } = {};

    // Shuffle Multiple Choice options
    if (question.type === 'MULTIPLE_CHOICE' && question.options) {
      result.multipleChoice = shuffleArray([...question.options]);
    }

    // Shuffle Multi-Select options
    if (question.type === 'MULTI_SELECT' && question.options) {
      result.multiSelect = shuffleArray([...question.options]);
    }

    // Shuffle Matching options (left and right independently)
    if (question.type === 'MATCHING' && question.matchPairs) {
      try {
        const pairs = Array.isArray(question.matchPairs)
          ? question.matchPairs
          : [];

        const leftItems = pairs.map((pair: any) => pair?.left || '');
        const rightItems = pairs.map((pair: any) => pair?.right || '');

        result.matching = {
          leftItems: shuffleArray(leftItems),
          rightItems: shuffleArray(rightItems),
          originalPairs: pairs as Array<{ left: string; right: string }>,
        };
      } catch (error) {
        console.error('Error processing matching pairs:', error);
        result.matching = {
          leftItems: [],
          rightItems: [],
          originalPairs: []
        };
      }
    }

    // Shuffle Reorder items
    if (question.type === 'REORDER' && question.reorderItems) {
      result.reorder = shuffleArray([...question.reorderItems]);
    }

    return result;
  }, [question.type, question.options, question.matchPairs, question.reorderItems]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;

    const fileUploadAnswer = Array.isArray(answer) ? answer as FileUploadAnswer[] : [];
    const allowedFileTypes = ['.png', '.jpeg', '.jpg', '.pdf', '.docx'];
    const maxFileSize = 4 * 1024 * 1024;

    const newFiles: FileUploadAnswer[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

      if (!allowedFileTypes.includes(fileExtension || '')) {
        errors.push(`${file.name}: Invalid file type. Allowed: ${allowedFileTypes.join(', ')}`);
        continue;
      }

      if (file.size > maxFileSize) {
        errors.push(`${file.name}: File too large. Maximum size is 4MB`);
        continue;
      }

      try {
        const fileUrl = await uploadFile(file);
        newFiles.push({
          fileName: file.name,
          fileType: file.type,
          fileUrl: fileUrl
        });
      } catch (error) {
        errors.push(`${file.name}: Upload failed`);
        console.error(error);
      }
    }

    if (errors.length > 0) {
      alert(`Upload errors:\n${errors.join('\n')}`);
    }

    if (newFiles.length > 0) {
      onAnswerChange(question.id, [...fileUploadAnswer, ...newFiles]);
    }
  };

  const handleFileDelete = async (fileUrl: string, index: number) => {
    try {
      await deleteFile(fileUrl);
      const updatedFiles = (answer as FileUploadAnswer[]).filter((_, i) => i !== index);
      onAnswerChange(question.id, updatedFiles.length > 0 ? updatedFiles : null);
    } catch (error) {
      console.error('File deletion error:', error);
      alert('Failed to delete file. Please try again.');
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('image')) return <ImageIcon className="w-4 h-4 text-blue-600" />;
    if (fileType.includes('pdf')) return <FileText className="w-4 h-4 text-red-600" />;
    return <FileText className="w-4 h-4 text-gray-600" />;
  };

  const renderFileUpload = () => {
    const fileUploadAnswer = Array.isArray(answer) ? answer as FileUploadAnswer[] : [];

    return (
      <div className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFileUpload(e.dataTransfer.files);
          }}
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Upload your files</h3>
          <p className="text-gray-600 mb-4">Drag and drop files here or click to browse</p>
          <p className="text-sm text-gray-500 mb-4">
            Supported formats: PNG, JPG, JPEG, PDF, DOCX (Max 4MB each)
          </p>
          <input
            type="file"
            multiple
            onChange={(e) => handleFileUpload(e.target.files)}
            accept=".png,.jpeg,.jpg,.pdf,.docx"
            className="hidden"
            id={`file-upload-${question.id}`}
          />
          <label
            htmlFor={`file-upload-${question.id}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 cursor-pointer transition-all duration-200"
          >
            <Upload className="w-4 h-4" />
            Choose Files
          </label>
        </div>

        {fileUploadAnswer.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Uploaded Files</h4>
            {fileUploadAnswer.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    {getFileIcon(file.fileType)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 truncate">{file.fileName}</p>
                    <p className="text-sm text-gray-500">
                      {file.fileType.includes('image') ? 'Image' :
                        file.fileType.includes('pdf') ? 'PDF' : 'Document'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={file.fileUrl}
                    download
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Download file"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleFileDelete(file.fileUrl, index)}
                    className="p-2 text-red-400 hover:text-red-600 transition-colors"
                    title="Delete file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMultipleChoice = () => (
    <div className="space-y-3">
      {shuffledOptions.multipleChoice?.map((option: string, index: number) => (
        <label key={index} className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
          <input
            type="radio"
            name={question.id}
            value={option}
            checked={answer === option}
            onChange={(e) => onAnswerChange(question.id, e.target.value)}
            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
          />
          <div className="flex-1">
            <LessonMarkdown content={option} />
          </div>
        </label>
      ))}
    </div>
  );

  const renderMultiSelect = () => {
    const multiSelectAnswer = Array.isArray(answer) ? answer as string[] : [];

    return (
      <div className="space-y-3">
        {shuffledOptions.multiSelect?.map((option: string, index: number) => (
          <label key={index} className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              value={option}
              checked={multiSelectAnswer.includes(option)}
              onChange={(e) => {
                const newAnswer = e.target.checked
                  ? [...multiSelectAnswer, option]
                  : multiSelectAnswer.filter(item => item !== option);
                onAnswerChange(question.id, newAnswer);
              }}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
            />
            <div className="flex-1">
              <LessonMarkdown content={option} />
            </div>
          </label>
        ))}
      </div>
    );
  };

  const renderTrueFalse = () => (
    <div className="grid grid-cols-2 gap-4 max-w-md">
      {['True', 'False'].map((option) => (
        <label key={option} className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
          <input
            type="radio"
            name={question.id}
            value={option}
            checked={answer === option}
            onChange={(e) => onAnswerChange(question.id, e.target.value)}
            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
          />
          <span className="font-medium text-gray-700">{option}</span>
        </label>
      ))}
    </div>
  );

  const renderTextArea = (placeholder: string, rows: number = 6) => (
    <textarea
      value={answer || ''}
      onChange={(e) => onAnswerChange(question.id, e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y transition-colors"
    />
  );

  const renderMatching = () => {
    const matchingData = shuffledOptions.matching;

    if (!matchingData) return null;

    // Helper function to create a plain text version for dropdown options
    const createPlainTextOption = (text: string): string => {
      // Remove Markdown formatting for dropdown display
      return text
        .replace(/#{1,6}\s/g, '') // Remove headers
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
        .replace(/\*(.*?)\*/g, '$1') // Remove italic
        .replace(/`(.*?)`/g, '$1') // Remove inline code
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
        .replace(/\n/g, ' ') // Replace newlines with spaces
        .trim()
        .substring(0, 80); // Limit length for dropdown
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Items */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Items</h4>
            <div className="space-y-3">
              {matchingData.leftItems.map((leftItem: string, index: number) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-sm font-medium text-gray-900">
                    <LessonMarkdown content={leftItem} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Matches */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Matches</h4>
            <div className="space-y-3">
              {matchingData.leftItems.map((leftItem: string, index: number) => (
                <div key={index} className="space-y-2">
                  <select
                    value={matchingAnswers[leftItem] || ''}
                    onChange={(e) => onMatchingAnswerChange(question.id, leftItem, e.target.value)}
                    className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                  >
                    <option value="">Select a match</option>
                    {matchingData.rightItems.map((rightItem: string, idx: number) => (
                      <option key={idx} value={rightItem}>
                        {createPlainTextOption(rightItem)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Instructions:</strong> Match each item on the left with the correct option from the dropdown.
            Each item has only one correct match. Selected matches will be displayed with proper formatting below each dropdown.
          </p>
        </div>

        {/* Progress Summary */}
        <div className={`p-4 rounded-lg border ${Object.keys(matchingAnswers).length === matchingData.leftItems.length
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
          <p className="text-sm font-medium">
            Progress: {Object.keys(matchingAnswers).length} of {matchingData.leftItems.length} items matched
            {Object.keys(matchingAnswers).length === matchingData.leftItems.length && ' ✓'}
          </p>
        </div>

        {/* Preview Section - Show all matches in one place */}
        {Object.keys(matchingAnswers).length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h5 className="font-medium text-gray-900 mb-3 text-sm">Your Matches Preview:</h5>
            <div className="space-y-3">
              {matchingData.leftItems.map((leftItem: string, index: number) => (
                <div key={index} className="flex items-start gap-4 p-3 bg-white rounded border">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      Item {index + 1}:
                    </div>
                    <div className="text-sm text-gray-700">
                      <LessonMarkdown content={leftItem} />
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-gray-400 mt-5 flex-shrink-0" />

                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      Your Match:
                    </div>
                    <div className="text-sm">
                      {matchingAnswers[leftItem] ? (
                        <div className="text-green-700">
                          <LessonMarkdown content={matchingAnswers[leftItem]} />
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Not yet matched</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderReorder = () => {
    const reorderItems = shuffledOptions.reorder || [];
    const reorderAnswer = Array.isArray(answer) ? answer as string[] : reorderItems;

    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Instructions:</strong> Drag and drop the items below to put them in the correct order.
          </p>
        </div>

        <div className="space-y-3">
          {reorderAnswer.map((item: string, index: number) => (
            <div
              key={index}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', index.toString());
                e.currentTarget.classList.add('opacity-50');
              }}
              onDragEnd={(e) => {
                e.currentTarget.classList.remove('opacity-50');
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('bg-blue-50');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('bg-blue-50');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('bg-blue-50');

                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = index;

                if (fromIndex === toIndex) return;

                const newOrder = [...reorderAnswer];
                const [movedItem] = newOrder.splice(fromIndex, 1);
                newOrder.splice(toIndex, 0, movedItem);
                onAnswerChange(question.id, newOrder);
              }}
              className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg bg-white cursor-grab hover:shadow-md transition-all duration-200 active:cursor-grabbing"
            >
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full flex items-center justify-center font-medium text-sm">
                {index + 1}
              </div>
              <div className="flex-1 text-sm">
                <LessonMarkdown content={item} />
              </div>
              <div className="flex-shrink-0 text-gray-400">
                ⋮⋮
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFillInTheBlank = () => {
    const blankCount = question.blankCount || 1;
    const blankAnswer = Array.isArray(answer) ? answer as string[] : new Array(blankCount).fill('');

    return (
      <div className="space-y-4">
        <div className="prose prose-sm max-w-none">
          <LessonMarkdown content={question.question} />
        </div>

        <div className="grid gap-4">
          {Array.from({ length: blankCount }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 min-w-[80px]">
                Blank {index + 1}:
              </label>
              <input
                type="text"
                value={blankAnswer[index] || ''}
                onChange={(e) => {
                  const newAnswer = [...blankAnswer];
                  newAnswer[index] = e.target.value;
                  onAnswerChange(question.id, newAnswer);
                }}
                className="flex-1 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={`Answer for blank ${index + 1}`}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderNumeric = () => (
    <input
      type="number"
      value={answer || ''}
      onChange={(e) => onAnswerChange(question.id, e.target.value)}
      className="w-full max-w-xs p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      placeholder="Enter a number"
      step="any"
    />
  );

  const renderCode = () => (
    <div className="space-y-3">
      {question.language && (
        <div className="text-sm text-gray-600">
          Programming language: <span className="font-medium">{question.language}</span>
        </div>
      )}
      <textarea
        value={answer || ''}
        onChange={(e) => onAnswerChange(question.id, e.target.value)}
        placeholder="Write your code here..."
        rows={12}
        className="w-full p-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-y"
      />
    </div>
  );

  switch (question.type) {
    case 'MULTIPLE_CHOICE':
      return renderMultipleChoice();
    case 'TRUE_FALSE':
      return renderTrueFalse();
    case 'SHORT_ANSWER':
      return renderTextArea('Enter your answer...', 4);
    case 'ESSAY':
      return renderTextArea('Write your essay here...', 12);
    case 'FILE_UPLOAD':
      return renderFileUpload();
    case 'MULTI_SELECT':
      return renderMultiSelect();
    case 'CODE':
      return renderCode();
    case 'MATCHING':
      return renderMatching();
    case 'REORDER':
      return renderReorder();
    case 'FILL_IN_THE_BLANK':
      return renderFillInTheBlank();
    case 'NUMERIC':
      return renderNumeric();
    default:
      return (
        <div className="text-center py-8 text-gray-500">
          Question type not supported: {question.type}
        </div>
      );
  }
};