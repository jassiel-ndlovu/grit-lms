/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import LessonMarkdown from "@/app/components/markdown";
import { useCourses } from "@/context/CourseContext";
import { useProfile } from "@/context/ProfileContext";
import { useTests } from "@/context/TestContext";
import { $Enums, QuestionType } from "@/generated/prisma";
import { deleteFile, uploadFile } from "@/lib/blob";
import { parseDateTimeLocal, formatForDateTimeLocal, extractImageUrlsFromMarkdown, formatDate } from "@/lib/functions";
import {
  ArrowLeft, Download, FileText, Plus, Trash2, Upload, File, FileTextIcon,
  Copy, ChevronRight, ChevronDown, Eye, EyeOff, GripVertical, Edit3, Save
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import TestCreationSkeleton from "../../skeletons/create-test-skeleton";
import { useParams, useRouter } from "next/navigation";
import { useEvents } from "@/context/EventContext";

type TestQuestion = AppTypes.TestQuestion;

interface QuestionExport {
  question: string;
  type: QuestionType;
  points: number;
  options?: string[];
  answer?: any;
  language?: string | null;
  matchPairs?: Array<{ left: string, right: string }> | null;
  reorderItems?: string[];
  blankCount?: number | null;
  order?: number;
  parentId?: string | null;
}

interface MLTestSchema {
  title: string;
  description?: string;
  preTestInstructions?: string;
  dueDate: string;
  timeLimit?: number;
  questions: Array<{
    question: string;
    type: QuestionType;
    points: number;
    options?: string[];
    answer?: any;
    language?: string;
    matchPairs?: Array<{ left: string, right: string }>;
    reorderItems?: string[];
    blankCount?: number;
    order?: number;
    parentId?: string | null;
  }>;
}

interface ExtendedTestQuestion extends Omit<Partial<TestQuestion>, "subQuestions"> {
  subQuestions?: ExtendedTestQuestion[];
  isExpanded?: boolean;
}

type QuestionTab = 'content' | 'settings' | 'answer';

export default function CreateTestPage() {
  const { loading: courseLoading, fetchCoursesByTutorId } = useCourses();
  const { loading: testLoading, fetchTestById, createTest, updateTest } = useTests();
  const { loading: eventsLoading, createEvent, updateEvent } = useEvents();
  const { profile } = useProfile();
  const { id } = useParams();
  const router = useRouter();

  const editMode = id !== undefined || id != null;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [courses, setCourses] = useState<AppTypes.Course[]>([]);
  const [importJson, setImportJson] = useState<string>("");
  const [importError, setImportError] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [uploadedImages, setUploadedImages] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<Set<string>>(new Set());
  const [activeQuestionTabs, setActiveQuestionTabs] = useState<Record<string, QuestionTab>>({});
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState<Partial<Omit<AppTypes.Test, "questions"> & { questions: ExtendedTestQuestion[] }>>({
    title: '',
    description: '',
    preTestInstructions: '',
    courseId: '',
    dueDate: new Date(),
    timeLimit: undefined,
    isActive: true,
    questions: [{
      id: "",
      question: '',
      type: QuestionType.MULTIPLE_CHOICE,
      points: 1,
      options: ['', '', '', ''],
      answer: '',
      language: '',
      matchPairs: null,
      reorderItems: [],
      blankCount: 0,
      createdAt: new Date(),
      testId: id ? id as string : "",
      order: 0,
      parentId: null,
      subQuestions: [],
      parent: null,
      isExpanded: false,
    }],
  });

  // Utility functions
  const generateId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const getQuestionTab = (questionId: string): QuestionTab => {
    return activeQuestionTabs[questionId] || 'content';
  };

  const setQuestionTab = (questionId: string, tab: QuestionTab) => {
    setActiveQuestionTabs(prev => ({ ...prev, [questionId]: tab }));
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

  const isQuestionExpanded = (questionId: string) => {
    return expandedQuestions.has(questionId);
  };

  // Flatten questions for easier manipulation
  const flattenQuestions = (questions: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
    const flattened: ExtendedTestQuestion[] = [];

    questions.forEach(question => {
      flattened.push(question);
      if (question.subQuestions) {
        flattened.push(...flattenQuestions(question.subQuestions));
      }
    });

    return flattened;
  };

  // Organize questions into hierarchy
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

  // Update question order
  const updateQuestionOrder = () => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions?.map((q, index) => ({
        ...q,
        order: index
      })) || []
    }));
  };

  // fetch courses
  useEffect(() => {
    if (!profile?.id) return;

    const fetch = async () => {
      setLoading(true);

      const fetchedCourses = await fetchCoursesByTutorId(profile.id) as AppTypes.Course[];

      setCourses(fetchedCourses);
      setLoading(false);
    }

    fetch();
  }, [profile?.id, fetchCoursesByTutorId]);

  // fetch test, if editing
  useEffect(() => {
    if (!editMode || !id) return;

    const fetch = async () => {
      setLoading(true);

      const test = await fetchTestById(id as string) as AppTypes.Test;

      // Convert flat questions to hierarchical structure
      const hierarchicalQuestions = organizeQuestionsHierarchy(
        test.questions.map((q) => ({
          ...q,
          options: q.options || ['', '', '', ''],
          language: q.language || '',
          matchPairs: q.matchPairs || null,
          reorderItems: q.reorderItems || [],
          blankCount: q.blankCount || 0,
          order: q.order || 0,
          parentId: q.parentId || null,
          subQuestions: [],
          isExpanded: false,
        }))
      );

      setFormData({
        ...test,
        dueDate: new Date(test.dueDate),
        questions: hierarchicalQuestions
      });
      setLoading(false);
    }

    fetch();
  }, [editMode, id, fetchTestById]);

  const toggleDraftStatus = () => {
    setFormData(prev => ({
      ...prev,
      isActive: !prev.isActive
    }));
  };

  // Question manipulation functions
  const addQuestion = (parentId?: string) => {
    const newQuestion: ExtendedTestQuestion = {
      id: generateId(),
      question: '',
      type: QuestionType.MULTIPLE_CHOICE,
      points: 1,
      options: ['', '', '', ''],
      answer: '',
      language: '',
      matchPairs: null,
      reorderItems: [],
      blankCount: 0,
      order: 0,
      parentId: parentId || null,
      subQuestions: [],
      isExpanded: false,
    };

    setFormData(prev => {
      const questions = [...(prev.questions || [])];

      if (parentId) {
        // Add as sub-question
        const addSubQuestion = (qs: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
          return qs.map(q => {
            if (q.id === parentId) {
              return {
                ...q,
                subQuestions: [...(q.subQuestions || []), newQuestion],
                isExpanded: true
              };
            }
            if (q.subQuestions) {
              return { ...q, subQuestions: addSubQuestion(q.subQuestions) };
            }
            return q;
          });
        };

        return { ...prev, questions: addSubQuestion(questions) };
      } else {
        // Add as root question
        newQuestion.order = questions.length;
        return { ...prev, questions: [...questions, newQuestion] };
      }
    });

    // Set initial tab for new question
    setQuestionTab(newQuestion.id as string, 'content');
    if (parentId) {
      setExpandedQuestions(prev => new Set([...prev, parentId]));
    }
  };

  const duplicateQuestion = (questionId: string) => {
    setFormData(prev => {
      const duplicateQuestionRecursive = (qs: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
        const newQuestions: ExtendedTestQuestion[] = [];

        qs.forEach(q => {
          newQuestions.push(q);
          if (q.id === questionId) {
            // Create duplicate
            const duplicate: ExtendedTestQuestion = {
              ...q,
              id: generateId(),
              subQuestions: q.subQuestions ? duplicateSubQuestions(q.subQuestions) : []
            };
            newQuestions.push(duplicate);
          }
        });

        return newQuestions.map(q => ({
          ...q,
          subQuestions: q.subQuestions ? duplicateQuestionRecursive(q.subQuestions) : []
        }));
      };

      const duplicateSubQuestions = (subQs: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
        return subQs.map(sq => ({
          ...sq,
          id: generateId(),
          subQuestions: sq.subQuestions ? duplicateSubQuestions(sq.subQuestions) : []
        }));
      };

      return { ...prev, questions: duplicateQuestionRecursive(prev.questions || []) };
    });
  };

  const removeQuestion = (questionId: string) => {
    setFormData(prev => {
      const removeRecursive = (qs: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
        return qs
          .filter(q => q.id !== questionId)
          .map(q => ({
            ...q,
            subQuestions: q.subQuestions ? removeRecursive(q.subQuestions) : []
          }));
      };

      return { ...prev, questions: removeRecursive(prev.questions || []) };
    });

    // Clean up state
    setActiveQuestionTabs(prev => {
      const { [questionId]: _, ...rest } = prev;
      return rest;
    });
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      newSet.delete(questionId);
      return newSet;
    });
  };

  const updateQuestion = (questionId: string, field: string, value: any) => {
    setFormData(prev => {
      const updateRecursive = (qs: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
        return qs.map(q => {
          if (q.id === questionId) {
            return { ...q, [field]: value };
          }
          if (q.subQuestions) {
            return { ...q, subQuestions: updateRecursive(q.subQuestions) };
          }
          return q;
        });
      };

      return { ...prev, questions: updateRecursive(prev.questions || []) };
    });
  };

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= (formData.questions?.length || 0)) return;

    setFormData(prev => {
      const questions = [...(prev.questions || [])];
      const [movedQuestion] = questions.splice(fromIndex, 1);
      questions.splice(toIndex, 0, movedQuestion);

      // Update order
      return {
        ...prev,
        questions: questions.map((q, index) => ({ ...q, order: index }))
      };
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragItem.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverItem.current = index;
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null) {
      moveQuestion(dragItem.current, dragOverItem.current);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // File handling functions
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        setImportJson(content);
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

  const handleDrop = (e: React.DragEvent, questionId: string) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const supportedFiles = files.filter(file =>
      file.type.startsWith('image/') ||
      file.type === 'application/pdf' ||
      file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    if (supportedFiles.length > 0) {
      handleQuestionFileUpload(supportedFiles[0], questionId);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, questionId: string) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleQuestionFileUpload(files[0], questionId);
    }
    e.target.value = '';
  };

  const handleQuestionFileUpload = async (file: File, questionId: string) => {
    setIsUploading(true);
    try {
      const fileUrl = await uploadFile(file);

      if (file.type.startsWith('image/')) {
        setUploadedImages(prev => new Set(prev).add(fileUrl));
      } else {
        setUploadedFiles(prev => new Set(prev).add(fileUrl));
      }

      // Find the question and update it
      const findAndUpdateQuestion = (questions: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
        return questions.map(q => {
          if (q.id === questionId) {
            const currentQuestion = q.question || "";
            let markdownLink = '';
            if (file.type.startsWith('image/')) {
              markdownLink = `\n![${file.name}](${fileUrl})\n`;
            } else {
              markdownLink = `\n[${file.name}](${fileUrl})\n`;
            }
            return { ...q, question: currentQuestion + markdownLink };
          }
          if (q.subQuestions) {
            return { ...q, subQuestions: findAndUpdateQuestion(q.subQuestions) };
          }
          return q;
        });
      };

      setFormData(prev => ({
        ...prev,
        questions: findAndUpdateQuestion(prev.questions || [])
      }));
    } catch (error) {
      console.error("Failed to upload file:", error);
      alert("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const exportQuestionsToJson = () => {
    if (!formData.questions || formData.questions.length === 0) {
      alert("No questions to export");
      return;
    }

    const flatQuestions = flattenQuestions(formData.questions);
    const questionsToExport: QuestionExport[] = flatQuestions.map(q => ({
      question: q.question || '',
      type: q.type || QuestionType.MULTIPLE_CHOICE,
      points: q.points || 0,
      options: q.options,
      answer: q.answer,
      language: q.language || null,
      matchPairs: q.matchPairs as Array<{ left: string, right: string }> | null | undefined,
      reorderItems: q.reorderItems,
      blankCount: q.blankCount || null,
      order: q.order ?? undefined,
      parentId: q.parentId
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
  };

  const importQuestionsFromJson = () => {
    try {
      if (!importJson.trim()) {
        setImportError("Please paste JSON data");
        return;
      }

      const parsedData: MLTestSchema = JSON.parse(importJson);

      if (!Array.isArray(parsedData.questions)) {
        setImportError("JSON should contain a questions array");
        return;
      }

      if (parsedData.title) {
        setFormData(prev => ({
          ...prev,
          title: parsedData.title,
          description: parsedData.description || prev.description,
          preTestInstructions: parsedData.preTestInstructions || prev.preTestInstructions,
          dueDate: parsedData.dueDate ? new Date(parsedData.dueDate) : prev.dueDate,
          timeLimit: parsedData.timeLimit || prev.timeLimit
        }));
      }

      const importedQuestions: ExtendedTestQuestion[] = parsedData.questions.map((q, i) => ({
        id: `imported-${Date.now()}-${i}`,
        question: q.question || '',
        type: q.type || QuestionType.MULTIPLE_CHOICE,
        points: q.points || 1,
        options: q.options || ['', '', '', ''],
        answer: q.answer !== undefined ? q.answer : '',
        language: q.language || null,
        matchPairs: q.matchPairs || null,
        reorderItems: q.reorderItems || [],
        blankCount: q.blankCount || null,
        order: q.order || i,
        parentId: q.parentId || null,
        subQuestions: [],
        isExpanded: false,
      }));

      const hierarchicalQuestions = organizeQuestionsHierarchy(importedQuestions);

      setFormData(prev => ({
        ...prev,
        questions: hierarchicalQuestions
      }));

      setShowImportModal(false);
      setImportJson("");
      setImportError("");
    } catch (error) {
      setImportError("Invalid JSON format");
      console.error("JSON import error:", error);
    }
  };

  const extractDocumentUrlsFromMarkdown = (markdown: string): string[] => {
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
  };

  const handleSubmit = async () => {
    const flatQuestions = flattenQuestions(formData.questions || []);
    const totalPoints = flatQuestions.reduce((sum, q) => sum + (q.points || 0), 0);

    // File cleanup logic (unchanged from original)
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
      questions: flatQuestions,
      totalPoints,
      isActive: formData.isActive !== undefined ? formData.isActive : true
    };

    setLoading(true);
    try {
      if (editMode) {
        await updateTest(id as string, testData);
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
      console.error('Error creating test:', error);
    } finally {
      setLoading(false);
    }

    setUploadedImages(new Set());
    setUploadedFiles(new Set());
  };

  // Question rendering functions
  const renderQuestionTabs = (question: ExtendedTestQuestion) => {
    const currentTab = getQuestionTab(question.id as string);
    const tabs: { id: QuestionTab; label: string }[] = [
      { id: 'content', label: 'Content' },
      { id: 'settings', label: 'Settings' },
      { id: 'answer', label: 'Answer' }
    ];

    return (
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setQuestionTab(question.id as string, tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${currentTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    );
  };

  const renderQuestionContent = (question: ExtendedTestQuestion) => {
    return (
      <div className="space-y-4">
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Question Text
          </label>
          <textarea
            value={question.question}
            onChange={(e) => updateQuestion(question.id as string, 'question', e.target.value)}
            placeholder="Enter your question (Markdown supported)..."
            className="w-full font-mono text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            rows={4}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => handleDrop(e, question.id as string)}
          />

          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            {isUploading && (
              <div className="text-xs text-gray-500">Uploading...</div>
            )}
            <label className="cursor-pointer p-1 text-gray-500 hover:text-blue-600">
              <File className="w-4 h-4" />
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => handleFileInput(e, question.id as string)}
                disabled={isUploading}
              />
            </label>
          </div>

          {dragOver && (
            <div className="absolute inset-0 bg-blue-50 border-2 border-dashed border-blue-400 rounded flex items-center justify-center">
              <div className="text-blue-600 font-medium">Drop file here</div>
            </div>
          )}
        </div>

        <div className="p-3 bg-gray-50 rounded border">
          <label className="block text-sm font-medium text-gray-700 mb-2">Preview:</label>
          <div className="text-sm">
            <LessonMarkdown
              content={question.question || "*Type your question above...*"}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderQuestionSettings = (question: ExtendedTestQuestion) => {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Question Type
            </label>
            <select
              value={question.type}
              onChange={(e) => updateQuestion(question.id as string, 'type', e.target.value as QuestionType)}
              className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            >
              <option value={QuestionType.MULTIPLE_CHOICE}>Multiple Choice</option>
              <option value={QuestionType.MULTI_SELECT}>Multi-Select</option>
              <option value={QuestionType.TRUE_FALSE}>True/False</option>
              <option value={QuestionType.SHORT_ANSWER}>Short Answer</option>
              <option value={QuestionType.ESSAY}>Essay</option>
              <option value={QuestionType.FILE_UPLOAD}>File Upload</option>
              <option value={QuestionType.CODE}>Code</option>
              <option value={QuestionType.MATCHING}>Matching</option>
              <option value={QuestionType.REORDER}>Reorder</option>
              <option value={QuestionType.FILL_IN_THE_BLANK}>Fill in the Blank</option>
              <option value={QuestionType.NUMERIC}>Numeric</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Points
            </label>
            <input
              type="number"
              value={question.points || 0}
              onChange={(e) => updateQuestion(question.id as string, 'points', parseInt(e.target.value) || 0)}
              className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              min="0"
            />
          </div>
        </div>

        {question.type === QuestionType.CODE && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Programming Language
            </label>
            <input
              type="text"
              value={question.language || ''}
              onChange={(e) => updateQuestion(question.id as string, 'language', e.target.value)}
              placeholder="e.g., JavaScript, Python, Java"
              className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}

        {question.type === QuestionType.FILL_IN_THE_BLANK && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Blanks
            </label>
            <input
              type="number"
              min="1"
              value={question.blankCount || 1}
              onChange={(e) => updateQuestion(question.id as string, 'blankCount', parseInt(e.target.value))}
              className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}
      </div>
    );
  };

  const renderQuestionAnswer = (question: ExtendedTestQuestion) => {
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
              onClick={() => updateQuestion(question.id as string, 'answer', '')}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center cursor-pointer hover:border-blue-400 transition-colors"
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => handleDrop(e, question.id as string)}
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
              onChange={(e) => handleFileInput(e, question.id as string)}
            />
          </div>
        )}

        <div className="mt-2 text-xs text-gray-500">
          <p>You can either provide a text answer below or upload a file with the answer.</p>
          <p>If both are provided, the file will take precedence.</p>
        </div>
      </div>
    );

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
                      updateQuestion(question.id as string, 'options', newOptions);
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                    className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newOptions = [...(question.options || [])];
                      newOptions.splice(optIndex, 1);
                      updateQuestion(question.id as string, 'options', newOptions);
                    }}
                    className="text-red-500 hover:text-red-700 p-1"
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
                  updateQuestion(question.id as string, 'options', newOptions);
                }}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
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
                onChange={(e) => updateQuestion(question.id as string, 'answer', e.target.value)}
                placeholder={question.type === QuestionType.MULTI_SELECT ?
                  "Correct answers (comma-separated, e.g., A, C)" :
                  "Correct answer (e.g., A)"}
                className="w-full text-sm px-3 py-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
              />
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
                onChange={(e) => updateQuestion(question.id as string, 'answer', e.target.value)}
                placeholder="Expected code answer"
                rows={6}
                className="w-full font-mono text-sm px-3 py-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
              />
            </div>
            {renderFileUploadOption()}
          </div>
        );

      case QuestionType.MATCHING:
        const matchPairsArray = Array.isArray(question.matchPairs)
          ? question.matchPairs as Array<{ left?: string, right?: string }>
          : [];

        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Matching Pairs:</label>
              {matchPairsArray.map((pair, pairIndex) => (
                <div key={pairIndex} className="grid grid-cols-2 gap-2 items-center mb-2">
                  <input
                    type="text"
                    value={pair.left || ''}
                    onChange={(e) => {
                      const newPairs = [...matchPairsArray];
                      newPairs[pairIndex] = { ...newPairs[pairIndex], left: e.target.value };
                      updateQuestion(question.id as string, 'matchPairs', newPairs);
                    }}
                    placeholder="Left item"
                    className="text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pair.right || ''}
                      onChange={(e) => {
                        const newPairs = [...matchPairsArray];
                        newPairs[pairIndex] = { ...newPairs[pairIndex], right: e.target.value };
                        updateQuestion(question.id as string, 'matchPairs', newPairs);
                      }}
                      placeholder="Right item"
                      className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newPairs = [...matchPairsArray];
                        newPairs.splice(pairIndex, 1);
                        updateQuestion(question.id as string, 'matchPairs', newPairs);
                      }}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const newPairs = [...matchPairsArray, { left: '', right: '' }];
                  updateQuestion(question.id as string, 'matchPairs', newPairs);
                }}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <Plus className="w-4 h-4" />
                Add Matching Pair
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correct Answer (JSON format)
              </label>
              <textarea
                value={typeof question.answer === 'string' &&
                  !question.answer.startsWith('http://') &&
                  !question.answer.startsWith('https://')
                  ? question.answer : ''}
                onChange={(e) => updateQuestion(question.id as string, 'answer', e.target.value)}
                placeholder='{"left1": "right1", "left2": "right2"}'
                rows={3}
                className="w-full font-mono text-sm px-3 py-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
              />
            </div>

            {renderFileUploadOption()}
          </div>
        );

      case QuestionType.REORDER:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Items to Reorder:</label>
              {(question.reorderItems || []).map((item, itemIndex) => (
                <div key={itemIndex} className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-gray-500 w-6">{itemIndex + 1}.</span>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const newItems = [...(question.reorderItems || [])];
                      newItems[itemIndex] = e.target.value;
                      updateQuestion(question.id as string, 'reorderItems', newItems);
                    }}
                    placeholder={`Item ${itemIndex + 1}`}
                    className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newItems = [...(question.reorderItems || [])];
                      newItems.splice(itemIndex, 1);
                      updateQuestion(question.id as string, 'reorderItems', newItems);
                    }}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const newItems = [...(question.reorderItems || []), ''];
                  updateQuestion(question.id as string, 'reorderItems', newItems);
                }}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correct Order (comma-separated indices)
              </label>
              <input
                type="text"
                value={typeof question.answer === 'string' &&
                  !question.answer.startsWith('http://') &&
                  !question.answer.startsWith('https://')
                  ? question.answer : ''}
                onChange={(e) => updateQuestion(question.id as string, 'answer', e.target.value)}
                placeholder="e.g., 3,1,2,4"
                className="w-full text-sm px-3 py-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the correct order using numbers corresponding to the item positions above.
              </p>
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
                  onChange={(e) => updateQuestion(question.id as string, 'answer', e.target.value)}
                  placeholder="Correct answer"
                  className="w-full text-sm px-3 py-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
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
                        updateQuestion(question.id as string, 'answer', newAnswers);
                      }}
                      placeholder={`Blank ${blankIndex + 1} answer`}
                      className="w-full text-sm px-3 py-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
                    />
                  ))}
                </div>
              )}
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
                onChange={(e) => updateQuestion(question.id as string, 'answer', parseFloat(e.target.value))}
                placeholder="Correct numeric answer"
                className="w-full text-sm px-3 py-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
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
                    updateQuestion(question.id as string, 'answer', e.target.value === 'true');
                  } else {
                    updateQuestion(question.id as string, 'answer', e.target.value);
                  }
                }}
                className="w-full text-sm px-3 py-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
              >
                <option value="">Select correct answer</option>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
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
                    onClick={() => updateQuestion(question.id as string, 'answer', '')}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => handleDrop(e, question.id as string)}
                  onClick={() => fileUploadRef.current?.click()}
                >
                  <File className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    Drag & drop or click to upload correct answer file
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Supports PDF, Word documents, and images
                  </p>
                </div>
              )}
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
                onChange={(e) => updateQuestion(question.id as string, 'answer', e.target.value)}
                placeholder="Expected answer"
                rows={question.type === QuestionType.ESSAY ? 6 : 3}
                className="w-full text-sm px-3 py-2 border border-green-500 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
              />
            </div>
            {renderFileUploadOption()}
          </div>
        );
    }
  };

  const renderQuestion = (question: ExtendedTestQuestion, index: number, level: number = 0) => {
    const currentTab = getQuestionTab(question.id as string);
    const hasSubQuestions = question.subQuestions && question.subQuestions.length > 0;
    const isExpanded = isQuestionExpanded(question.id as string);

    return (
      <div key={question.id} className={`border border-gray-200 rounded-lg ${level > 0 ? 'ml-8 mt-2' : ''}`}>
        {/* Question Header */}
        <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            {level === 0 && (
              <div
                className="cursor-move p-1 text-gray-400 hover:text-gray-600"
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
              >
                <GripVertical className="w-4 h-4" />
              </div>
            )}

            <h4 className="text-sm font-medium text-gray-900">
              {level === 0 ? `Question ${index + 1}` : `Sub-question ${(question.id as string).slice(-3)}`}
              <span className="text-gray-500 ml-2">({question.points || 0} pts)</span>
            </h4>

            {hasSubQuestions && (
              <button
                onClick={() => toggleQuestionExpansion(question.id as string)}
                className="text-gray-500 hover:text-gray-700"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => duplicateQuestion(question.id as string)}
              className="text-gray-500 hover:text-blue-600 p-1"
              title="Duplicate question"
            >
              <Copy className="w-4 h-4" />
            </button>

            {level === 0 && (
              <button
                onClick={() => addQuestion(question.id)}
                className="text-gray-500 hover:text-green-600 p-1"
                title="Add sub-question"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => removeQuestion(question.id as string)}
              className="text-gray-500 hover:text-red-600 p-1"
              title="Delete question"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Question Content */}
        <div className="p-4">
          {renderQuestionTabs(question)}

          <div className="mt-4">
            {currentTab === 'content' && renderQuestionContent(question)}
            {currentTab === 'settings' && renderQuestionSettings(question)}
            {currentTab === 'answer' && renderQuestionAnswer(question)}
          </div>
        </div>

        {/* Sub-questions */}
        {hasSubQuestions && isExpanded && (
          <div className="border-t border-gray-200 bg-gray-25 p-2">
            <div className="space-y-2">
              {question.subQuestions!.map((subQuestion, subIndex) =>
                renderQuestion(subQuestion, subIndex, level + 1)
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTestPreview = () => {
    const flatQuestions = flattenQuestions(formData.questions || []);

    return (
      <div className="max-w-4xl mx-auto p-6 bg-white">
        <div className="mb-8 text-center border-b border-gray-200 pb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{formData.title || 'Untitled Test'}</h1>
          {formData.description && (
            <p className="text-gray-600 mb-4">{formData.description}</p>
          )}
          <div className="flex justify-center gap-6 text-sm text-gray-500">
            <span>Total Questions: {flatQuestions.length}</span>
            <span>Total Points: {flatQuestions.reduce((sum, q) => sum + (q.points || 0), 0)}</span>
            {formData.timeLimit && <span>Time Limit: {formData.timeLimit} minutes</span>}
          </div>
        </div>

        {formData.preTestInstructions && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Instructions:</h3>
            <div className="text-blue-800">
              <LessonMarkdown content={formData.preTestInstructions} />
            </div>
          </div>
        )}

        <div className="space-y-6">
          {flatQuestions.map((question, index) => (
            <div key={question.id} className="border border-gray-200 rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Question {index + 1} {question.parentId ? '(Sub-question)' : ''}
                </h3>
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {question.points || 0} pts
                </span>
              </div>

              <div className="mb-4">
                <LessonMarkdown content={question.question || '*No question text*'} />
              </div>

              {question.type === QuestionType.MULTIPLE_CHOICE && question.options && (
                <div className="space-y-2">
                  {question.options.map((option, optIndex) => (
                    <div key={optIndex} className="flex items-center gap-2">
                      <input type="radio" disabled className="text-blue-600" />
                      <span>{String.fromCharCode(65 + optIndex)}. {option}</span>
                    </div>
                  ))}
                </div>
              )}

              {question.type === QuestionType.MULTI_SELECT && question.options && (
                <div className="space-y-2">
                  {question.options.map((option, optIndex) => (
                    <div key={optIndex} className="flex items-center gap-2">
                      <input type="checkbox" disabled className="text-blue-600" />
                      <span>{String.fromCharCode(65 + optIndex)}. {option}</span>
                    </div>
                  ))}
                </div>
              )}

              {question.type === QuestionType.TRUE_FALSE && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="radio" disabled />
                    <span>True</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="radio" disabled />
                    <span>False</span>
                  </div>
                </div>
              )}

              {question.type === QuestionType.SHORT_ANSWER && (
                <input
                  type="text"
                  disabled
                  placeholder="Student will type their answer here..."
                  className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50"
                />
              )}

              {question.type === QuestionType.ESSAY && (
                <textarea
                  disabled
                  placeholder="Student will type their essay answer here..."
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50"
                />
              )}

              {question.type === QuestionType.CODE && (
                <div className="space-y-2">
                  {question.language && (
                    <div className="text-sm text-gray-600">Language: {question.language}</div>
                  )}
                  <textarea
                    disabled
                    placeholder="Student will write their code here..."
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 font-mono text-sm"
                  />
                </div>
              )}

              {question.type === QuestionType.FILE_UPLOAD && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
                  <File className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Student will upload their file here</p>
                </div>
              )}

              {question.type === QuestionType.NUMERIC && (
                <input
                  type="number"
                  disabled
                  placeholder="Student will enter a number here..."
                  className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50"
                />
              )}

              {question.type === QuestionType.FILL_IN_THE_BLANK && (
                <div className="space-y-2">
                  {Array.from({ length: question.blankCount || 1 }).map((_, blankIndex) => (
                    <div key={blankIndex} className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Blank {blankIndex + 1}:</span>
                      <input
                        type="text"
                        disabled
                        placeholder="Student answer here..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded bg-gray-50"
                      />
                    </div>
                  ))}
                </div>
              )}

              {question.type === QuestionType.MATCHING && question.matchPairs && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Left Items:</h4>
                    <div className="space-y-1">
                      {(question.matchPairs as Array<{ left: string, right: string }>).map((pair, index) => (
                        <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                          {pair.left}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Right Items:</h4>
                    <div className="space-y-1">
                      {(question.matchPairs as Array<{ left: string, right: string }>).map((pair, index) => (
                        <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                          {pair.right}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {question.type === QuestionType.REORDER && question.reorderItems && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Items to reorder:</h4>
                  <div className="space-y-1">
                    {question.reorderItems.map((item, index) => (
                      <div key={index} className="p-2 bg-gray-50 rounded text-sm flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-gray-400" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if ((loading && !formData.title) || courseLoading || testLoading || eventsLoading) {
    return <TestCreationSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/dashboard/tutor-tests")}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                {editMode ? 'Edit Test' : 'Create New Test'}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${showPreview
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showPreview ? 'Hide Preview' : 'Preview Test'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
        {showPreview ? (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Test Preview</h2>
              <p className="text-sm text-gray-600 mt-1">This is how students will see the test</p>
            </div>
            {renderTestPreview()}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm">
            {/* Form Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Test Details
                </h2>
              </div>

              {/* Draft/Active Toggle Button */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">
                  {formData.isActive ? 'Active' : 'Draft'}
                </span>
                <button
                  type="button"
                  onClick={toggleDraftStatus}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.isActive ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${formData.isActive ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Test Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    placeholder="Enter test title..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course *
                  </label>
                  <select
                    value={formData.courseId}
                    onChange={(e) => setFormData(prev => ({ ...prev, courseId: e.target.value }))}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    disabled={editMode}
                  >
                    <option value="">Select a course</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>{course.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  placeholder="Test description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pre-Test Instructions
                </label>
                <textarea
                  value={formData.preTestInstructions as string}
                  onChange={(e) => setFormData(prev => ({ ...prev, preTestInstructions: e.target.value }))}
                  rows={3}
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  placeholder="Instructions to show before students start the test (Markdown supported)..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.dueDate ? formatForDateTimeLocal(formData.dueDate) : ""}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        dueDate: parseDateTimeLocal(e.target.value)
                      }))}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time Limit (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.timeLimit ?? ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, timeLimit: parseInt(e.target.value) || null }))}
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    placeholder="In minutes"
                  />
                </div>
              </div>

              <hr className="border-gray-300" />

              {/* Questions */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-medium text-gray-900">Questions</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="flex items-center gap-2 text-sm px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Import
                    </button>
                    <button
                      onClick={exportQuestionsToJson}
                      disabled={!formData.questions || formData.questions.length === 0}
                      className="flex items-center gap-2 text-sm px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
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
                  {formData.questions && formData.questions.map((question, index) =>
                    renderQuestion(question, index)
                  )}
                </div>

                {(!formData.questions || formData.questions.length === 0) && (
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
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
              <div className="text-sm text-gray-600">
                Total Questions: {flattenQuestions(formData.questions || []).length} |
                Total Points: {flattenQuestions(formData.questions || []).reduce((sum, q) => sum + (q.points || 0), 0)}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => window.history.back()}
                  className="text-sm px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !formData.title || !formData.courseId || !formData.dueDate || !formData.questions || !formData.questions.length}
                  className="text-sm px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  {loading
                    ? (editMode ? 'Updating...' : 'Creating...')
                    : (editMode ? 'Update Test' : 'Create Test')
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Import Dialog */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white h-[90vh] overflow-y-auto rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Import Questions from JSON</h3>
              <p className="text-sm text-gray-500 mt-1">
                Paste JSON data or upload a file. This will replace all current questions.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload JSON File
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".json"
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Or paste JSON data
                </label>
                <textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  rows={10}
                  className="w-full font-mono text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  placeholder={`Example JSON structure:
{
  "title": "Test Title",
  "description": "Test description",
  "preTestInstructions": "Instructions for students",
  "dueDate": "2024-12-31T23:59:59.000Z",
  "timeLimit": 60,
  "questions": [
    {
      "question": "What is 2+2? (Markdown **supported**)",
      "type": "MULTIPLE_CHOICE",
      "points": 10,
      "options": ["2", "3", "4", "5"],
      "answer": "4",
      "order": 0,
      "parentId": null
    }
  ]
}`}
                />
              </div>

              {importError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  Error: {importError}
                </div>
              )}

              {/* JSON Schema Explanation */}
              <div className="bg-blue-50 p-4 rounded-md">
                <h4 className="font-medium text-blue-900 mb-2">Enhanced JSON Schema:</h4>
                <pre className="text-xs text-blue-800 whitespace-pre-wrap">
                  {`{
  "title": "string",                    // Test title
  "description": "string",              // Test description (optional)
  "preTestInstructions": "string",      // Instructions (optional, Markdown supported)
  "dueDate": "ISO string",              // Due date in ISO format
  "timeLimit": number,                  // Time limit in minutes (optional)
  "questions": [
    {
      "question": "string",             // Question text (Markdown supported)
      "type": "QuestionType",           // Question type
      "points": number,                 // Points for this question
      "options": ["string"],            // For multiple choice/multi-select (optional)
      "answer": "any",                  // Correct answer (type depends on question type)
      "language": "string",             // For code questions (optional)
      "matchPairs": [{"left": "string", "right": "string"}], // For matching
      "reorderItems": ["string"],       // For reorder questions
      "blankCount": number,             // For fill in the blank
      "order": number,                  // Question order (optional)
      "parentId": "string"              // Parent question ID for sub-questions (optional)
    }
  ]
}`}
                </pre>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportJson("");
                  setImportError("");
                }}
                className="text-sm px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={importQuestionsFromJson}
                className="text-sm px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Import Questions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}