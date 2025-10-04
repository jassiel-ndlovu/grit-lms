/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback } from 'react';
import { deleteFile, extractImageUrlsFromMarkdown } from '@/lib/blob';
import { formatDate } from '@/lib/functions';
import { $Enums } from '@/generated/prisma';
import { TestFormData, ExtendedTestQuestion, QuestionExport, MLTestSchema } from '@/lib/test-creation-types';

interface UseTestOperationsProps {
  formData: TestFormData;
  setFormData: (data: TestFormData | ((prev: TestFormData) => TestFormData)) => void;
  questions: ExtendedTestQuestion[];
  setQuestions: (questions: ExtendedTestQuestion[]) => void;
  uploadedImages: Set<string>;
  uploadedFiles: Set<string>;
  setUploadedImages: (images: Set<string>) => void;
  setUploadedFiles: (files: Set<string>) => void;
  editMode: boolean;
  createTest: (courseId: string, testData: Partial<AppTypes.Test>) => Promise<AppTypes.Test | void>;
  updateTest: (testId: string, testData: Partial<AppTypes.Test>) => Promise<AppTypes.Test | void>;
  createEvent: (courseId: string, eventData: any) => Promise<AppTypes.CourseEvent | void>;
  updateEvent: (courseId: string, eventData: any) => Promise<AppTypes.CourseEvent | void>;
  setLoading: (loading: boolean) => void;
  router: any;
}

export const useTestOperations = ({
  formData,
  questions,
  uploadedImages,
  uploadedFiles,
  setUploadedImages,
  setUploadedFiles,
  editMode,
  createTest,
  updateTest,
  createEvent,
  updateEvent,
  router
}: UseTestOperationsProps) => {

  const flattenQuestions = useCallback((questionsToFlatten: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
    const flattened: ExtendedTestQuestion[] = [];
    questionsToFlatten.forEach(question => {
      flattened.push(question);
      if (question.subQuestions) {
        flattened.push(...flattenQuestions(question.subQuestions));
      }
    });
    return flattened;
  }, []);

  const organizeQuestionsHierarchy = useCallback((flatQuestions: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
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
    const sortByOrder = (questionsToSort: ExtendedTestQuestion[]) => {
      questionsToSort.sort((a, b) => (a.order || 0) - (b.order || 0));
      questionsToSort.forEach(q => {
        if (q.subQuestions) {
          sortByOrder(q.subQuestions);
        }
      });
    };

    sortByOrder(rootQuestions);
    return rootQuestions;
  }, []);

  const extractDocumentUrlsFromMarkdown = useCallback((markdown: string): string[] => {
    const urls: string[] = [];
    const linkRegex = /(?!!)\[.*?\]\((.*?)\)/g;
    let match;

    while ((match = linkRegex.exec(markdown)) !== null) {
      const url = match[1];
      if (url && (url.endsWith('.pdf') || url.endsWith('.doc') || url.endsWith('.docx') ||
        url.includes('/files/') || url.includes('/uploads/'))) {
        urls.push(url);
      }
    }

    return urls;
  }, []);

  // Helper function to recursively transform questions for export with proper IDs and hierarchy
  const transformQuestionsForExport = useCallback((questionsToTransform: ExtendedTestQuestion[], parentId: string | null = null): QuestionExport[] => {
    return questionsToTransform.map((q, index) => {
      const questionExport: QuestionExport = {
        id: q.id || `temp-${Date.now()}-${index}`, // Provide temporary ID if missing
        question: q.question || '',
        type: q.type || 'MULTIPLE_CHOICE',
        points: q.points || 0,
        options: q.options,
        answer: q.answer,
        language: q.language || undefined,
        matchPairs: q.matchPairs as Array<{ left: string, right: string }> | undefined,
        reorderItems: q.reorderItems,
        blankCount: q.blankCount || undefined,
        order: q.order ?? index, // Use provided order or index as fallback
        parentId: parentId, // Set parentId for hierarchy
      };

      // Recursively transform subquestions
      if (q.subQuestions && q.subQuestions.length > 0) {
        questionExport.subQuestions = transformQuestionsForExport(q.subQuestions, q.id as string);
      }

      return questionExport;
    });
  }, []);

  // Function to normalize imported questions with proper IDs and hierarchy
  const normalizeImportedQuestions = useCallback((questionsToNormalize: QuestionExport[], parentId: string | null = null): ExtendedTestQuestion[] => {
    return questionsToNormalize.map((q, index) => {
      const normalizedQuestion: ExtendedTestQuestion = {
        id: q.id || `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID if missing
        question: q.question,
        type: q.type,
        points: q.points,
        options: q.options,
        answer: q.answer,
        language: q.language,
        matchPairs: q.matchPairs,
        reorderItems: q.reorderItems,
        blankCount: q.blankCount,
        order: q.order ?? index, // Use provided order or index as fallback
        parentId: parentId, // Set parentId for proper hierarchy
        isExpanded: true, // Default to expanded for imported questions
      };

      // Recursively normalize subquestions
      if (q.subQuestions && q.subQuestions.length > 0) {
        normalizedQuestion.subQuestions = normalizeImportedQuestions(q.subQuestions, normalizedQuestion.id as string);
      }

      return normalizedQuestion;
    });
  }, []);

  const exportTestToJson = useCallback(() => {
    if (!questions || questions.length === 0) {
      alert("No questions to export");
      return;
    }

    // Create the complete test schema with hierarchy
    const testToExport: MLTestSchema = {
      title: formData.title || 'Untitled Test',
      description: formData.description || '',
      preTestInstructions: formData.preTestInstructions || '',
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : new Date().toISOString(),
      timeLimit: formData.timeLimit || 60,
      questions: transformQuestionsForExport(questions) // This now includes proper hierarchy
    };

    const jsonString = JSON.stringify(testToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `test-${formData.title ? formData.title.toLowerCase().replace(/\s+/g, '-') : 'export'}-${timestamp}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [questions, formData, transformQuestionsForExport]);

  // Legacy export function for backward compatibility (exports only questions as flat array)
  const exportQuestionsToJson = useCallback(() => {
    if (!questions || questions.length === 0) {
      alert("No questions to export");
      return;
    }

    const flatQuestions = flattenQuestions(questions);
    const questionsToExport: QuestionExport[] = flatQuestions.map((q, index) => ({
      id: q.id,
      question: q.question || '',
      type: q.type || 'MULTIPLE_CHOICE',
      points: q.points || 0,
      options: q.options,
      answer: q.answer,
      language: q.language || undefined,
      matchPairs: q.matchPairs as Array<{ left: string, right: string }> | undefined,
      reorderItems: q.reorderItems,
      blankCount: q.blankCount || undefined,
      order: q.order ?? index,
      parentId: q.parentId,
      // Note: subQuestions are not included in flat export
    }));

    const jsonString = JSON.stringify(questionsToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `test-questions-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [questions, flattenQuestions]);

  const importQuestionsFromJson = useCallback((jsonData: string): { testSchema: MLTestSchema; normalizedQuestions: ExtendedTestQuestion[] } => {
    if (!jsonData.trim()) {
      throw new Error("Please paste JSON data");
    }

    const parsedData = JSON.parse(jsonData);

    // Handle both formats: complete test schema or just questions array
    let testSchema: MLTestSchema;
    let questionsToImport: QuestionExport[];

    if (Array.isArray(parsedData)) {
      // Legacy format: just questions array
      testSchema = {
        title: 'Imported Test',
        dueDate: new Date().toISOString(),
        description: '',
        preTestInstructions: '',
        questions: parsedData
      };
      questionsToImport = parsedData;
    } else if (parsedData.questions && Array.isArray(parsedData.questions)) {
      // New format: complete test schema
      testSchema = parsedData as MLTestSchema;
      questionsToImport = parsedData.questions;
    } else {
      throw new Error("Invalid JSON format: should contain a questions array or complete test schema");
    }

    // Normalize the imported questions with proper IDs and hierarchy
    const normalizedQuestions = normalizeImportedQuestions(questionsToImport);

    return {
      testSchema,
      normalizedQuestions
    };
  }, [normalizeImportedQuestions]);

  const handleSubmit = useCallback(async () => {
    const flatQuestions = flattenQuestions(questions);
    const totalPoints = flatQuestions.reduce((sum, q) => sum + (q.points || 0), 0);

    // File cleanup logic
    const allFileUrls = new Set<string>();
    flatQuestions.forEach(question => {
      if (question.question) {
        const imageUrls = extractImageUrlsFromMarkdown(question.question);
        imageUrls.forEach(url => allFileUrls.add(url));

        const documentUrls = extractDocumentUrlsFromMarkdown(question.question);
        documentUrls.forEach(url => allFileUrls.add(url));
      }

      if (typeof question.answer === 'string' &&
        (question.answer.startsWith('http://') || question.answer.startsWith('https://'))) {
        allFileUrls.add(question.answer);
      }
    });

    const allUploadedFiles = new Set([...uploadedImages, ...uploadedFiles]);
    const unusedFiles = Array.from(allUploadedFiles).filter(
      url => !allFileUrls.has(url)
    );

    if (unusedFiles.length > 0) {
      try {
        await Promise.allSettled(
          unusedFiles.map(url => deleteFile(url).catch(err => {
            console.error(`Failed to delete file ${url}:`, err);
          }))
        );
        console.log(`Cleaned up ${unusedFiles.length} unused files`);
      } catch (error) {
        console.error("Error cleaning up files:", error);
      }
    }

    const testData: Partial<AppTypes.Test> = {
      title: formData.title,
      description: formData.description,
      preTestInstructions: formData.preTestInstructions,
      courseId: formData.courseId,
      dueDate: new Date(formData.dueDate || ''),
      timeLimit: formData.timeLimit,
      // @ts-expect-error subQuestions can be undefined
      questions: questions,
      totalPoints,
      isActive: formData.isActive !== undefined ? formData.isActive : true
    };

    try {
      if (editMode) {
        await updateTest(formData.id as string, testData);
        await updateEvent(formData.courseId || "", {
          courseId: formData.courseId,
          date: formData.dueDate,
          description: `Test "${formData.title}" updated, due on "${formData.dueDate ? formatDate(formData.dueDate) : ""}".`,
          title: formData.title,
          type: $Enums.EventType.TEST,
        });
      } else {
        const test = await createTest(formData.courseId || "", testData) as AppTypes.Test;
        await createEvent(formData.courseId || "", {
          courseId: formData.courseId,
          date: formData.dueDate,
          description: `Test "${formData.title}" created, due on "${formData.dueDate ? formatDate(formData.dueDate) : ""}".`,
          title: formData.title,
          type: $Enums.EventType.TEST,
        });

        router.push(`/dashboard/tutor-tests/create/${test.id}`);
      }
    } catch (error) {
      console.error('Error saving test:', error);
      throw error;
    }

    setUploadedImages(new Set());
    setUploadedFiles(new Set());
  }, [
    questions,
    flattenQuestions,
    extractDocumentUrlsFromMarkdown,
    uploadedImages,
    uploadedFiles,
    formData,
    editMode,
    updateTest,
    updateEvent,
    createTest,
    createEvent,
    router,
    setUploadedImages,
    setUploadedFiles
  ]);

  return {
    exportTestToJson,
    exportQuestionsToJson,
    importQuestionsFromJson,
    handleSubmit,
    flattenQuestions,
    organizeQuestionsHierarchy,
    transformQuestionsForExport,
    normalizeImportedQuestions
  };
};