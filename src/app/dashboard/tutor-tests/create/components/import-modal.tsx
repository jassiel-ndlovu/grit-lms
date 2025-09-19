import React, { useState } from 'react';
import { X } from 'lucide-react';
import { QuestionType } from '@/generated/prisma';
import { MLTestSchema, ExtendedTestQuestion } from '@/lib/test-creation-types';

interface ImportModalProps {
  onClose: () => void;
  onSuccess: (data: MLTestSchema) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const ImportModal: React.FC<ImportModalProps> = ({ onClose, onSuccess, fileInputRef }) => {
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        setImportJson(content);
        setImportError('');
      } catch (error) {
        setImportError("Failed to read file");
        console.error("Import error:", error);
      }
    };
    reader.onerror = () => {
      setImportError("Failed to read file");
    };
    reader.readAsText(file);
  };

  const organizeQuestionsHierarchy = (flatQuestions: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
    const questionMap = new Map<string, ExtendedTestQuestion>();
    const rootQuestions: ExtendedTestQuestion[] = [];

    // First pass: create map of all questions
    flatQuestions.forEach(q => {
      questionMap.set(q.id as string, { ...q, subQuestions: [] });
    });

    // Second pass: organize hierarchy
    flatQuestions.forEach(q => {
      const question = questionMap.get(q.id as string)!;
      if (q.parentId && questionMap.has(q.parentId)) {
        const parent = questionMap.get(q.parentId)!;
        if (!parent.subQuestions) parent.subQuestions = [];
        parent.subQuestions.push(question);
      } else {
        rootQuestions.push(question);
      }
    });

    // Sort by order
    const sortByOrder = (questions: ExtendedTestQuestion[]) => {
      questions.sort((a, b) => (a.order || 0) - (b.order || 0));
      questions.forEach(q => {
        if (q.subQuestions) {
          sortByOrder(q.subQuestions);
        }
      });
    };

    sortByOrder(rootQuestions);
    return rootQuestions;
  };

  const importQuestionsFromJson = async () => {
    if (isImporting) return;
    
    setIsImporting(true);
    setImportError('');

    try {
      if (!importJson.trim()) {
        throw new Error("Please paste JSON data or upload a file");
      }

      const parsedData: MLTestSchema = JSON.parse(importJson);

      if (!Array.isArray(parsedData.questions)) {
        throw new Error("JSON should contain a questions array");
      }

      if (parsedData.questions.length === 0) {
        throw new Error("Questions array cannot be empty");
      }

      // Validate and transform questions
      const importedQuestions: ExtendedTestQuestion[] = parsedData.questions.map((q, i) => {
        // Validate required fields
        if (!q.question || q.question.trim() === '') {
          throw new Error(`Question ${i + 1} is missing question text`);
        }

        if (!q.type) {
          throw new Error(`Question ${i + 1} is missing question type`);
        }

        // Validate question type
        if (!Object.values(QuestionType).includes(q.type)) {
          throw new Error(`Question ${i + 1} has invalid question type: ${q.type}`);
        }

        // Validate points
        if (q.points === undefined || q.points === null || q.points < 0) {
          throw new Error(`Question ${i + 1} has invalid points value`);
        }

        return {
          id: `imported-${Date.now()}-${i}`,
          question: q.question.trim(),
          type: q.type,
          points: q.points,
          options: q.options || (q.type === QuestionType.MULTIPLE_CHOICE || q.type === QuestionType.MULTI_SELECT ? ['', '', '', ''] : []),
          answer: q.answer !== undefined ? q.answer : '',
          language: q.language || null,
          matchPairs: q.matchPairs || null,
          reorderItems: q.reorderItems || [],
          blankCount: q.blankCount || (q.type === QuestionType.FILL_IN_THE_BLANK ? 1 : null),
          order: q.order || i,
          parentId: q.parentId || null,
          subQuestions: [],
          isExpanded: false,
        };
      });

      // Organize into hierarchy if there are parent-child relationships
      const hierarchicalQuestions = organizeQuestionsHierarchy(importedQuestions);

      // Prepare the full import data
      const importData: MLTestSchema = {
        ...parsedData,
        // @ts-expect-error subQuestions can be undefined
        questions: hierarchicalQuestions
      };

      onSuccess(importData);
      setImportJson('');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Invalid JSON format or structure";
      setImportError(errorMessage);
      console.error("JSON import error:", error);
    } finally {
      setIsImporting(false);
    }
  };

  const exampleJson = {
    title: "Sample Math Test",
    description: "A sample test demonstrating various question types",
    preTestInstructions: "Read each question carefully. Show your work where applicable.",
    dueDate: "2024-12-31T23:59:59.000Z",
    timeLimit: 60,
    questions: [
      {
        question: "What is 2 + 2?",
        type: "MULTIPLE_CHOICE",
        points: 10,
        options: ["3", "4", "5", "6"],
        answer: "4",
        order: 0,
        parentId: null
      },
      {
        question: "The sky is blue.",
        type: "TRUE_FALSE",
        points: 5,
        answer: true,
        order: 1,
        parentId: null
      }
    ]
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Import Questions from JSON</h3>
            <p className="text-sm text-gray-500 mt-1">
              Upload a file or paste JSON data to import questions
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload JSON File
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json"
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
              />
            </div>

            {/* JSON Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or paste JSON data
              </label>
              <textarea
                value={importJson}
                onChange={(e) => {
                  setImportJson(e.target.value);
                  setImportError(''); // Clear errors when typing
                }}
                rows={12}
                className="w-full font-mono text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="Paste your JSON data here..."
              />
            </div>

            {/* Error Display */}
            {importError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex">
                  <div className="text-sm text-red-800">
                    <strong>Import Error:</strong> {importError}
                  </div>
                </div>
              </div>
            )}

            {/* Example JSON */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-3">Example JSON Structure:</h4>
              <pre className="text-xs text-blue-800 whitespace-pre-wrap overflow-x-auto bg-white p-3 rounded border">
                {JSON.stringify(exampleJson, null, 2)}
              </pre>
            </div>

            {/* Schema Documentation */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Supported Question Types:</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <div><code className="bg-gray-200 px-1 rounded">MULTIPLE_CHOICE</code> - Single answer</div>
                  <div><code className="bg-gray-200 px-1 rounded">MULTI_SELECT</code> - Multiple answers</div>
                  <div><code className="bg-gray-200 px-1 rounded">TRUE_FALSE</code> - True/False</div>
                  <div><code className="bg-gray-200 px-1 rounded">SHORT_ANSWER</code> - Brief text</div>
                  <div><code className="bg-gray-200 px-1 rounded">ESSAY</code> - Long text</div>
                  <div><code className="bg-gray-200 px-1 rounded">NUMERIC</code> - Number answer</div>
                </div>
                <div className="space-y-1">
                  <div><code className="bg-gray-200 px-1 rounded">CODE</code> - Programming code</div>
                  <div><code className="bg-gray-200 px-1 rounded">FILE_UPLOAD</code> - File submission</div>
                  <div><code className="bg-gray-200 px-1 rounded">MATCHING</code> - Match pairs</div>
                  <div><code className="bg-gray-200 px-1 rounded">REORDER</code> - Sort items</div>
                  <div><code className="bg-gray-200 px-1 rounded">FILL_IN_THE_BLANK</code> - Fill blanks</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            disabled={isImporting}
          >
            Cancel
          </button>
          <button
            onClick={importQuestionsFromJson}
            disabled={!importJson.trim() || isImporting}
            className="text-sm px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isImporting && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            {isImporting ? 'Importing...' : 'Import Questions'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;