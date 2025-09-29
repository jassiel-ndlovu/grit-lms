import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
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
  const [copiedSchema, setCopiedSchema] = useState('');

  const handleCopySchema = (schemaType: string) => {
    let schemaContent = '';
    
    switch (schemaType) {
      case 'basic':
        schemaContent = JSON.stringify(basicExampleJson, null, 2);
        break;
      case 'subquestions':
        schemaContent = JSON.stringify(subQuestionsExampleJson, null, 2);
        break;
      case 'matching':
        schemaContent = JSON.stringify(matchingExampleJson, null, 2);
        break;
      default:
        schemaContent = JSON.stringify(basicExampleJson, null, 2);
    }
    
    navigator.clipboard.writeText(schemaContent);
    setCopiedSchema(schemaType);
    setTimeout(() => setCopiedSchema(''), 2000);
  };

  const basicExampleJson = {
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
        order: 0
      },
      {
        question: "The sky is blue.",
        type: "TRUE_FALSE",
        points: 5,
        answer: true,
        order: 1
      }
    ]
  };

  const subQuestionsExampleJson = {
    title: "Advanced Physics Test with Sub-questions",
    description: "Demonstrating hierarchical question structure",
    questions: [
      {
        id: "q1",
        question: "A car accelerates uniformly from rest to 20 m/s in 5 seconds.",
        type: "ESSAY",
        points: 0, // Parent questions can have 0 points if sub-questions carry the weight
        order: 0,
        subQuestions: [
          {
            id: "q1a",
            question: "Calculate the acceleration of the car.",
            type: "NUMERIC",
            points: 5,
            answer: 4,
            order: 0,
            parentId: "q1"
          },
          {
            id: "q1b",
            question: "What distance does the car travel during this time?",
            type: "NUMERIC",
            points: 5,
            answer: 50,
            order: 1,
            parentId: "q1"
          }
        ]
      },
      {
        id: "q2",
        question: "Chemical Reactions Analysis",
        type: "MULTIPLE_CHOICE",
        points: 10,
        options: ["Option A", "Option B", "Option C", "Option D"],
        answer: "Option B",
        order: 1,
        subQuestions: [
          {
            id: "q2a",
            question: "Explain why you chose this answer.",
            type: "SHORT_ANSWER",
            points: 5,
            answer: "Sample explanation text",
            order: 0,
            parentId: "q2"
          }
        ]
      }
    ]
  };

  const matchingExampleJson = {
    title: "Vocabulary Matching Test",
    questions: [
      {
        question: "Match the following terms with their definitions:",
        type: "MATCHING",
        points: 10,
        matchPairs: [
          { left: "Photosynthesis", right: "Process by which plants make food" },
          { left: "Mitosis", right: "Cell division process" },
          { left: "Ecosystem", right: "Community of interacting organisms" }
        ],
        answer: [
          { left: "Photosynthesis", right: "Process by which plants make food" },
          { left: "Mitosis", right: "Cell division process" },
          { left: "Ecosystem", right: "Community of interacting organisms" }
        ],
        order: 0
      },
      {
        question: "Reorder the steps of the scientific method:",
        type: "REORDER",
        points: 8,
        reorderItems: [
          "Form hypothesis",
          "Make observation",
          "Conduct experiment",
          "Analyze results"
        ],
        answer: [
          "Make observation",
          "Form hypothesis", 
          "Conduct experiment",
          "Analyze results"
        ],
        order: 1
      }
    ]
  };

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

    // First pass: create map of all questions with proper subQuestions array
    flatQuestions.forEach(q => {
      questionMap.set(q.id as string, { 
        ...q, 
        subQuestions: q.subQuestions || [],
        isExpanded: true // Default to expanded for imported questions
      });
    });

    // Second pass: organize hierarchy and validate parent-child relationships
    flatQuestions.forEach(q => {
      const question = questionMap.get(q.id as string)!;
      
      if (q.parentId) {
        if (questionMap.has(q.parentId)) {
          const parent = questionMap.get(q.parentId)!;
          if (!parent.subQuestions) parent.subQuestions = [];
          
          // Validate that parent and child have compatible types
          if (parent.type === QuestionType.ESSAY || parent.type === QuestionType.SHORT_ANSWER) {
            // Essay/short answer parents can have any type of sub-questions
            parent.subQuestions.push(question);
          } else if (parent.type === question.type) {
            // Same type nesting allowed
            parent.subQuestions.push(question);
          } else {
            console.warn(`Question ${q.id} has incompatible type with parent ${q.parentId}`);
            // Still add to hierarchy but log warning
            parent.subQuestions.push(question);
          }
        } else {
          console.warn(`Question ${q.id} references non-existent parent ${q.parentId}`);
          rootQuestions.push(question);
        }
      } else {
        rootQuestions.push(question);
      }
    });

    // Sort by order and recursively sort sub-questions
    const sortByOrder = (questions: ExtendedTestQuestion[]) => {
      questions.sort((a, b) => (a.order || 0) - (b.order || 0));
      questions.forEach(q => {
        if (q.subQuestions && q.subQuestions.length > 0) {
          sortByOrder(q.subQuestions);
        }
      });
    };

    sortByOrder(rootQuestions);
    return rootQuestions;
  };

  const validateQuestion = (q: any, index: number): ExtendedTestQuestion => {
    // Validate required fields
    if (!q.question || q.question.trim() === '') {
      throw new Error(`Question ${index + 1} is missing question text`);
    }

    if (!q.type) {
      throw new Error(`Question ${index + 1} is missing question type`);
    }

    // Validate question type
    if (!Object.values(QuestionType).includes(q.type)) {
      throw new Error(`Question ${index + 1} has invalid question type: ${q.type}`);
    }

    // Validate points (can be 0 for parent questions)
    if (q.points === undefined || q.points === null || q.points < 0) {
      throw new Error(`Question ${index + 1} has invalid points value`);
    }

    // Type-specific validations
    if ((q.type === QuestionType.MULTIPLE_CHOICE || q.type === QuestionType.MULTI_SELECT) && 
        (!q.options || !Array.isArray(q.options) || q.options.length === 0)) {
      throw new Error(`Question ${index + 1} (${q.type}) requires options array`);
    }

    if (q.type === QuestionType.MATCHING && (!q.matchPairs || !Array.isArray(q.matchPairs))) {
      throw new Error(`Question ${index + 1} (MATCHING) requires matchPairs array`);
    }

    if (q.type === QuestionType.REORDER && (!q.reorderItems || !Array.isArray(q.reorderItems))) {
      throw new Error(`Question ${index + 1} (REORDER) requires reorderItems array`);
    }

    if (q.type === QuestionType.FILL_IN_THE_BLANK && (!q.blankCount || q.blankCount < 1)) {
      throw new Error(`Question ${index + 1} (FILL_IN_THE_BLANK) requires blankCount >= 1`);
    }

    return {
      id: q.id || `imported-${Date.now()}-${index}`,
      question: q.question.trim(),
      type: q.type,
      points: q.points,
      options: q.options || [],
      answer: q.answer !== undefined ? q.answer : null,
      language: q.language || null,
      matchPairs: q.matchPairs || null,
      reorderItems: q.reorderItems || [],
      blankCount: q.blankCount || null,
      order: q.order !== undefined ? q.order : index,
      parentId: q.parentId || null,
      subQuestions: q.subQuestions,
      isExpanded: true,
    };
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

      // Validate and transform all questions
      const importedQuestions: ExtendedTestQuestion[] = parsedData.questions.map((q, i) => 
        validateQuestion(q, i)
      );
      
      // Organize into hierarchy
      const hierarchicalQuestions = organizeQuestionsHierarchy(importedQuestions);

      // Prepare the full import data
      const importData: MLTestSchema = {
        title: parsedData.title || "Imported Test",
        description: parsedData.description || "",
        preTestInstructions: parsedData.preTestInstructions || "",
        dueDate: parsedData.dueDate,
        timeLimit: parsedData.timeLimit,
        // @ts-expect-error question
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

  const SchemaCard = ({ title, description, example, type }: { 
    title: string; 
    description: string; 
    example: object;
    type: string;
  }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-medium text-gray-900">{title}</h4>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
        <button
          onClick={() => handleCopySchema(type)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
        >
          {copiedSchema === type ? (
            <Check className="w-3 h-3 text-green-600" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
          Copy
        </button>
      </div>
      <pre className="text-xs bg-gray-50 p-3 rounded border overflow-x-auto">
        {JSON.stringify(example, null, 2)}
      </pre>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Import Questions from JSON</h3>
            <p className="text-sm text-gray-500 mt-1">
              Upload a file or paste JSON data to import questions with full subquestion support
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
                  setImportError('');
                }}
                rows={8}
                className="w-full font-mono text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors"
                placeholder="Paste your JSON data here..."
              />
            </div>

            {/* Error Display */}
            {importError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="text-sm text-red-800">
                  <strong>Import Error:</strong> {importError}
                </div>
              </div>
            )}

            {/* Schema Templates */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">JSON Templates (Click to Copy):</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <SchemaCard
                  title="Basic Questions"
                  description="Simple multiple choice and true/false"
                  example={basicExampleJson}
                  type="basic"
                />
                <SchemaCard
                  title="With Sub-questions"
                  description="Hierarchical question structure"
                  example={subQuestionsExampleJson}
                  type="subquestions"
                />
                <SchemaCard
                  title="Interactive Types"
                  description="Matching and reorder questions"
                  example={matchingExampleJson}
                  type="matching"
                />
              </div>
            </div>

            {/* Quick Reference */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-3">Quick Reference:</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="font-medium mb-1">Hierarchical Fields:</div>
                  <code className="block bg-blue-100 px-1 rounded mb-1">parentId</code>
                  <code className="block bg-blue-100 px-1 rounded">subQuestions[]</code>
                </div>
                <div>
                  <div className="font-medium mb-1">Matching Type:</div>
                  <code className="block bg-blue-100 px-1 rounded mb-1">matchPairs: {"{left, right}[]"}</code>
                  <code className="block bg-blue-100 px-1 rounded">answer: same structure</code>
                </div>
                <div>
                  <div className="font-medium mb-1">Parent Questions:</div>
                  <div className="text-blue-800">Can have points: 0</div>
                  <div className="text-blue-800">Nest any question types</div>
                </div>
                <div>
                  <div className="font-medium mb-1">Validation:</div>
                  <div className="text-blue-800">Auto-hierarchy building</div>
                  <div className="text-blue-800">Type-specific checks</div>
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