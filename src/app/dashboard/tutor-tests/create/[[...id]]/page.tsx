/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import LessonMarkdown from "@/app/components/markdown";
import { useCourses } from "@/context/CourseContext";
import { useProfile } from "@/context/ProfileContext";
import { useTests } from "@/context/TestContext";
import { $Enums, QuestionType, TestQuestion } from "@/generated/prisma";
import { deleteFile, uploadFile } from "@/lib/blob";
import { parseDateTimeLocal, formatForDateTimeLocal, extractImageUrlsFromMarkdown, formatDate } from "@/lib/functions";
import { ArrowLeft, Download, FileText, Plus, Trash2, Upload, File, FileTextIcon } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import TestCreationSkeleton from "../../skeletons/create-test-skeleton";
import { useParams, useRouter } from "next/navigation";
import { useEvents } from "@/context/EventContext";

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
}

// JSON Schema for ML-generated tests
interface MLTestSchema {
  title: string;
  description?: string;
  preTestInstructions?: string;
  dueDate: string; // ISO string
  timeLimit?: number;
  questions: Array<{
    question: string; // Markdown supported
    type: QuestionType;
    points: number;
    options?: string[]; // For multiple choice/multi-select
    answer?: any; // Type depends on question type
    language?: string; // For code questions
    matchPairs?: Array<{ left: string, right: string }>; // For matching questions
    reorderItems?: string[]; // For reorder questions
    blankCount?: number; // For fill in the blank
  }>;
}

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

  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [courses, setCourses] = useState<AppTypes.Course[]>([]);
  const [importJson, setImportJson] = useState<string>("");
  const [importError, setImportError] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [uploadedImages, setUploadedImages] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<Partial<AppTypes.Test & { questions: Partial<TestQuestion>[] }>>({
    title: '',
    description: '',
    preTestInstructions: '',
    courseId: '',
    dueDate: new Date(),
    timeLimit: undefined,
    isActive: true, // Default to active
    // @ts-expect-error testId is not required for creation
    questions: [{
      id: "1",
      question: '',
      type: QuestionType.MULTIPLE_CHOICE,
      points: 1,
      options: ['', '', '', ''],
      answer: '',
      language: '',
      matchPairs: null,
      reorderItems: [],
      blankCount: 0,
    }],
  });

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
  }, [profile?.id, fetchCoursesByTutorId])

  // fetch test, if editing
  useEffect(() => {
    if (!editMode || !id) return;

    const fetch = async () => {
      setLoading(true);

      const test = await fetchTestById(id as string) as AppTypes.Test;

      setFormData({
        ...test,
        dueDate: new Date(test.dueDate),
        questions: test.questions.map(q => ({
          ...q,
          // Ensure all question fields are properly initialized
          options: q.options || ['', '', '', ''],
          language: q.language || '',
          matchPairs: q.matchPairs || null,
          reorderItems: q.reorderItems || [],
          blankCount: q.blankCount || 0,
        }))
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

  const handleDrop = (e: React.DragEvent, questionIndex: number) => {
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
      handleQuestionFileUpload(supportedFiles[0], questionIndex);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>, questionIndex: number) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleQuestionFileUpload(files[0], questionIndex);
    }
    e.target.value = ''; // Reset input
  };

  const handleQuestionFileUpload = async (file: File, questionIndex: number) => {
    setIsUploading(true);
    try {
      const fileUrl = await uploadFile(file);

      // Track this uploaded file
      if (file.type.startsWith('image/')) {
        setUploadedImages(prev => new Set(prev).add(fileUrl));
      } else {
        setUploadedFiles(prev => new Set(prev).add(fileUrl));
      }

      // Get current question text
      const currentQuestion = formData.questions?.[questionIndex]?.question || "";

      // Create appropriate Markdown based on file type
      let markdownLink = '';
      if (file.type.startsWith('image/')) {
        // For images: ![filename](url)
        markdownLink = `\n![${file.name}](${fileUrl})\n`;
      } else {
        // For documents: [filename](url)
        markdownLink = `\n[${file.name}](${fileUrl})\n`;
      }

      const newQuestionText = currentQuestion + markdownLink;

      // Update the question text
      updateQuestion(questionIndex, 'question', newQuestionText);
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

    const questionsToExport: QuestionExport[] = formData.questions.map(q => ({
      question: q.question || '',
      type: q.type || QuestionType.MULTIPLE_CHOICE,
      points: q.points || 0,
      options: q.options,
      answer: q.answer,
      language: q.language || null,
      matchPairs: q.matchPairs as Array<{ left: string, right: string }> | null | undefined,
      reorderItems: q.reorderItems,
      blankCount: q.blankCount || null
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

      // Update test details if provided
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

      const importedQuestions: Partial<TestQuestion>[] = parsedData.questions.map((q, i) => ({
        id: `imported-${Date.now()}-${i}`,
        question: q.question || '',
        type: q.type || QuestionType.MULTIPLE_CHOICE,
        points: q.points || 1,
        options: q.options || ['', '', '', ''],
        answer: q.answer !== undefined ? q.answer : '',
        language: q.language || null,
        matchPairs: q.matchPairs || null,
        reorderItems: q.reorderItems || [],
        blankCount: q.blankCount || null
      }));

      // @ts-expect-error id is not declared on frontend
      setFormData(prev => ({
        ...prev,
        questions: importedQuestions
      }));

      setShowImportModal(false);
      setImportJson("");
      setImportError("");
    } catch (error) {
      setImportError("Invalid JSON format");
      console.error("JSON import error:", error);
    }
  };

  const addQuestion = () => {
    // @ts-expect-error testid is not required for creation
    setFormData(prev => ({
      ...prev,
      questions: [
        ...(prev.questions || []),
        {
          id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          question: '',
          type: QuestionType.MULTIPLE_CHOICE,
          points: 10,
          options: ['', '', '', ''],
          answer: '',
          language: '',
          matchPairs: null,
          reorderItems: [],
          blankCount: 0,
        }
      ]
    }));
  };

  const removeQuestion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      questions: (prev.questions || []).filter((_, i) => i !== index)
    }));
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      questions: (prev.questions || []).map((q, i) => i === index ? { ...q, [field]: value } : q)
    }));
  };

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= (formData.questions?.length || 0)) return;

    setFormData(prev => {
      const questions = [...(prev.questions || [])];
      const [movedQuestion] = questions.splice(fromIndex, 1);
      questions.splice(toIndex, 0, movedQuestion);
      return { ...prev, questions };
    });
  };

  const extractDocumentUrlsFromMarkdown = (markdown: string): string[] => {
    const urls: string[] = [];

    // Match markdown links without the ! prefix: [text](url)
    const linkRegex = /(?!!)\[.*?\]\((.*?)\)/g;
    let match;

    while ((match = linkRegex.exec(markdown)) !== null) {
      const url = match[1];
      // Only include URLs that look like file URLs (not web pages)
      if (url && (url.endsWith('.pdf') || url.endsWith('.doc') || url.endsWith('.docx') ||
        url.includes('/files/') || url.includes('/uploads/'))) {
        urls.push(url);
      }
    }

    return urls;
  };

  const handleSubmit = async () => {
    const totalPoints = (formData.questions || []).reduce((sum, q) => sum + (q.points || 0), 0);

    // Extract all file URLs from all questions (both images and documents)
    const allFileUrls = new Set<string>();
    (formData.questions || []).forEach(question => {
      if (question.question) {
        // Extract image URLs from markdown
        const imageUrls = extractImageUrlsFromMarkdown(question.question);
        imageUrls.forEach(url => allFileUrls.add(url));

        // Extract document URLs from markdown (links in format [filename](url))
        const documentUrls = extractDocumentUrlsFromMarkdown(question.question);
        documentUrls.forEach(url => allFileUrls.add(url));
      }

      // Check if answer itself is a file URL
      if (typeof question.answer === 'string' &&
        (question.answer.startsWith('http://') || question.answer.startsWith('https://'))) {
        allFileUrls.add(question.answer);
      }
    });

    // Find files that were uploaded but are no longer used
    const allUploadedFiles = new Set([...uploadedImages, ...uploadedFiles]);
    const unusedFiles = Array.from(allUploadedFiles).filter(
      url => !allFileUrls.has(url)
    );

    // Clean up unused files
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

    // If editing, also check for files that were removed from existing content
    if (editMode && formData.questions) {
      try {
        const oldFiles = new Set<string>();
        formData.questions.forEach(question => {
          if (question.question) {
            const imageUrls = extractImageUrlsFromMarkdown(question.question);
            imageUrls.forEach(url => oldFiles.add(url));

            const documentUrls = extractDocumentUrlsFromMarkdown(question.question);
            documentUrls.forEach(url => oldFiles.add(url));
          }

          // Check if answer was a file URL
          if (typeof question.answer === 'string' &&
            (question.answer.startsWith('http://') || question.answer.startsWith('https://'))) {
            oldFiles.add(question.answer);
          }
        });

        // Find files that were in the old version but not in the new one
        const removedFiles = Array.from(oldFiles).filter(
          url => !allFileUrls.has(url)
        );

        // Clean up files that were completely removed
        if (removedFiles.length > 0) {
          await Promise.allSettled(
            removedFiles.map(url => deleteFile(url).catch(err => {
              console.error(`Failed to delete removed file ${url}:`, err);
            }))
          );
          console.log(`Cleaned up ${removedFiles.length} removed files`);
        }
      } catch (error) {
        console.error("Error cleaning up removed files:", error);
      }
    }

    const testData: Partial<AppTypes.Test> = {
      title: formData.title,
      description: formData.description,
      preTestInstructions: formData.preTestInstructions,
      courseId: formData.courseId,
      dueDate: new Date(formData.dueDate || ''),
      timeLimit: formData.timeLimit,
      questions: formData.questions,
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
          description: `Test "${formData.title}" created, due on the "${formData.dueDate ? formatDate(formData.dueDate) : ""}.`,
          title: formData.title,
          type: $Enums.EventType.TEST,
        });
      } else {
        const test = await createTest(formData.courseId || "", testData) as AppTypes.Test;
        await createEvent(formData.courseId || "", {
          courseId: formData.courseId,
          date: formData.dueDate,
          description: `Test "${formData.title}" created, due on the "${formData.dueDate ? formatDate(formData.dueDate) : ""}.`,
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

    // Reset uploaded files tracking after successful submission
    setUploadedImages(new Set());
    setUploadedFiles(new Set());
  };

  const renderQuestionFields = (question: Partial<TestQuestion>, index: number) => {
    // Common file upload section for all question types
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
              onClick={() => updateQuestion(index, 'answer', '')}
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
            onDrop={(e) => handleDrop(e, index)}
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
              onChange={(e) => handleFileInput(e, index)}
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
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Options:</label>
            {(question.options || []).map((option, optIndex) => (
              <div key={optIndex} className="flex items-center gap-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...(question.options || [])];
                    newOptions[optIndex] = e.target.value;
                    updateQuestion(index, 'options', newOptions);
                  }}
                  placeholder={`Option ${optIndex + 1}`}
                  className="flex-1 font-mono text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newOptions = [...(question.options || [])];
                    newOptions.splice(optIndex, 1);
                    updateQuestion(index, 'options', newOptions);
                  }}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const newOptions = [...(question.options || []), ''];
                updateQuestion(index, 'options', newOptions);
              }}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <Plus className="w-4 h-4" />
              Add Option
            </button>

            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correct Answer{question.type === QuestionType.MULTI_SELECT ? 's (comma-separated)' : ''}
              </label>
              <input
                type="text"
                value={typeof question.answer === 'string' &&
                  !question.answer.startsWith('http://') &&
                  !question.answer.startsWith('https://')
                  ? question.answer : ''}
                onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
                placeholder={question.type === QuestionType.MULTI_SELECT ?
                  "Correct answers (comma-separated, e.g., A, C)" :
                  "Correct answer (e.g., A)"}
                className="w-full font-mono text-sm px-3 py-2 border border-green-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
              />
            </div>

            {renderFileUploadOption()}
          </div>
        );

      case QuestionType.CODE:
        return (
          <div className="space-y-2">
            <input
              type="text"
              value={question.language || ''}
              onChange={(e) => updateQuestion(index, 'language', e.target.value)}
              placeholder="Programming language (e.g., JavaScript, Python)"
              className="w-full font-mono text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            />
            <textarea
              value={typeof question.answer === 'string' &&
                !question.answer.startsWith('http://') &&
                !question.answer.startsWith('https://')
                ? question.answer : ''}
              onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
              placeholder="Expected code answer"
              rows={4}
              className="w-full font-mono text-sm px-3 py-2 border border-green-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
            />

            {renderFileUploadOption()}
          </div>
        );

      case QuestionType.MATCHING:
        const matchPairsArray = Array.isArray(question.matchPairs)
          ? question.matchPairs as Array<{ left?: string, right?: string }>
          : [];

        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Matching Pairs:</label>

            {matchPairsArray.map((pair, pairIndex) => (
              <div key={pairIndex} className="grid grid-cols-2 gap-2 items-center">
                <input
                  type="text"
                  value={pair.left || ''}
                  onChange={(e) => {
                    const newPairs = [...matchPairsArray];
                    newPairs[pairIndex] = { ...newPairs[pairIndex], left: e.target.value };
                    updateQuestion(index, 'matchPairs', newPairs);
                  }}
                  placeholder="Left item"
                  className="text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pair.right || ''}
                    onChange={(e) => {
                      const newPairs = [...matchPairsArray];
                      newPairs[pairIndex] = { ...newPairs[pairIndex], right: e.target.value };
                      updateQuestion(index, 'matchPairs', newPairs);
                    }}
                    placeholder="Right item"
                    className="flex-1 text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newPairs = [...matchPairsArray];
                      newPairs.splice(pairIndex, 1);
                      updateQuestion(index, 'matchPairs', newPairs);
                    }}
                    className="text-red-500 hover:text-red-700 p-2"
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
                updateQuestion(index, 'matchPairs', newPairs);
              }}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <Plus className="w-4 h-4" />
              Add Matching Pair
            </button>

            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correct Answer (JSON format)
              </label>
              <textarea
                value={typeof question.answer === 'string' &&
                  !question.answer.startsWith('http://') &&
                  !question.answer.startsWith('https://')
                  ? question.answer : ''}
                onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
                placeholder='{"left1": "right1", "left2": "right2"}'
                rows={3}
                className="w-full font-mono text-sm px-3 py-2 border border-green-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
              />
            </div>

            {renderFileUploadOption()}
          </div>
        );

      case QuestionType.REORDER:
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Items to Reorder:</label>

            {(question.reorderItems || []).map((item, itemIndex) => (
              <div key={itemIndex} className="flex items-center gap-2">
                <span className="text-sm text-gray-500 w-6">{itemIndex + 1}.</span>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newItems = [...(question.reorderItems || [])];
                    newItems[itemIndex] = e.target.value;
                    updateQuestion(index, 'reorderItems', newItems);
                  }}
                  placeholder={`Item ${itemIndex + 1}`}
                  className="flex-1 text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newItems = [...(question.reorderItems || [])];
                    newItems.splice(itemIndex, 1);
                    updateQuestion(index, 'reorderItems', newItems);
                  }}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                const newItems = [...(question.reorderItems || []), ''];
                updateQuestion(index, 'reorderItems', newItems);
              }}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>

            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correct Order (comma-separated indices)
              </label>
              <input
                type="text"
                value={typeof question.answer === 'string' &&
                  !question.answer.startsWith('http://') &&
                  !question.answer.startsWith('https://')
                  ? question.answer : ''}
                onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
                placeholder="e.g., 3,1,2,4"
                className="w-full font-mono text-sm px-3 py-2 border border-green-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
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
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Blanks
                </label>
                <input
                  type="number"
                  min="1"
                  value={question.blankCount || 1}
                  onChange={(e) => updateQuestion(index, 'blankCount', parseInt(e.target.value))}
                  className="w-full text-sm px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correct Answers {question.blankCount && question.blankCount > 1 ? '(one per line)' : ''}
              </label>
              {question.blankCount === 1 ? (
                <input
                  type="text"
                  value={typeof question.answer === 'string' &&
                    !question.answer.startsWith('http://') &&
                    !question.answer.startsWith('https://')
                    ? question.answer : ''}
                  onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
                  placeholder="Correct answer"
                  className="w-full font-mono text-sm px-3 py-2 border border-green-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
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
                        updateQuestion(index, 'answer', newAnswers);
                      }}
                      placeholder={`Blank ${blankIndex + 1} answer`}
                      className="w-full font-mono text-sm px-3 py-2 border border-green-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
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
          <div className="space-y-2">
            <input
              type="number"
              step="any"
              value={typeof question.answer === 'number' ? question.answer :
                typeof question.answer === 'string' &&
                  !question.answer.startsWith('http://') &&
                  !question.answer.startsWith('https://')
                  ? question.answer : ''}
              onChange={(e) => updateQuestion(index, 'answer', parseFloat(e.target.value))}
              placeholder="Correct numeric answer"
              className="w-full font-mono text-sm px-3 py-2 border border-green-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
            />

            {renderFileUploadOption()}
          </div>
        );

      case QuestionType.TRUE_FALSE:
        return (
          <div className="space-y-2">
            <select
              value={typeof question.answer === 'boolean' ? question.answer.toString() :
                typeof question.answer === 'string' &&
                  !question.answer.startsWith('http://') &&
                  !question.answer.startsWith('https://')
                  ? question.answer : ''}
              onChange={(e) => {
                if (e.target.value === 'true' || e.target.value === 'false') {
                  updateQuestion(index, 'answer', e.target.value === 'true');
                } else {
                  updateQuestion(index, 'answer', e.target.value);
                }
              }}
              className="w-full text-sm px-3 py-2 border border-green-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
            >
              <option value="">Select correct answer</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>

            {renderFileUploadOption()}
          </div>
        );

      case QuestionType.SHORT_ANSWER:
      case QuestionType.ESSAY:
        return (
          <div className="space-y-2">
            <textarea
              value={typeof question.answer === 'string' &&
                !question.answer.startsWith('http://') &&
                !question.answer.startsWith('https://')
                ? question.answer : ''}
              onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
              placeholder="Expected answer"
              rows={question.type === QuestionType.ESSAY ? 6 : 3}
              className="w-full font-mono text-sm px-3 py-2 border border-green-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
            />

            {renderFileUploadOption()}
          </div>
        );

      case QuestionType.FILE_UPLOAD:
        return (
          <div className="space-y-3">
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
                  onClick={() => updateQuestion(index, 'answer', '')}
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
                onDrop={(e) => handleDrop(e, index)}
                onClick={() => fileUploadRef.current?.click()}
              >
                <File className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Drag & drop or click to upload correct answer file
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Supports PDF, Word documents, and images
                </p>
                <input
                  ref={fileUploadRef}
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  className="hidden"
                  onChange={(e) => handleFileInput(e, index)}
                />
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="space-y-2">
            <textarea
              value={typeof question.answer === 'string' &&
                !question.answer.startsWith('http://') &&
                !question.answer.startsWith('https://')
                ? question.answer : ''}
              onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
              placeholder="Expected answer"
              rows={3}
              className="w-full font-mono text-sm px-3 py-2 border border-green-500 focus:ring-2 focus:ring-green-500 focus:border-green-500 focus:outline-none"
            />

            {renderFileUploadOption()}
          </div>
        );
    }
  };

  if ((loading && !formData.title) || courseLoading || testLoading || eventsLoading) {
    return <TestCreationSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {editMode ? 'Edit Test' : 'Create New Test'}
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-6">
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
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.isActive ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  formData.isActive ? 'translate-x-6' : 'translate-x-1'
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
                placeholder="Instructions to show before students start the test..."
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
              <div className="flex items-center justify-between mb-4">
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
                    onClick={addQuestion}
                    className="flex items-center gap-2 text-sm px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Question
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {formData.questions && formData.questions.map((question, index) => (
                  <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-gray-900">
                          Question {index + 1}
                        </h4>
                        <div className="flex gap-1">
                          <button
                            onClick={() => moveQuestion(index, index - 1)}
                            disabled={index === 0}
                            className="text-gray-500 hover:text-gray-700 disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveQuestion(index, index + 1)}
                            disabled={index === (formData.questions?.length || 0) - 1}
                            className="text-gray-500 hover:text-gray-700 disabled:opacity-30"
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                      {formData.questions && formData.questions.length > 1 && (
                        <button
                          onClick={() => removeQuestion(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {/* Question and overlay */}
                      <div className="relative">
                        <textarea
                          value={question.question}
                          onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                          placeholder="Enter your question (Markdown supported)..."
                          className="w-full font-mono text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                          rows={4}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOver(true);
                          }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={(e) => handleDrop(e, index)}
                        />

                        {/* File upload button */}
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
                              onChange={(e) => handleFileInput(e, index)}
                              disabled={isUploading}
                            />
                          </label>
                        </div>

                        {/* Drag overlay */}
                        {dragOver && (
                          <div className="absolute inset-0 bg-blue-50 border-2 border-dashed border-blue-400 rounded flex items-center justify-center">
                            <div className="text-blue-600 font-medium">Drop image here</div>
                          </div>
                        )}
                      </div>

                      {/* Question Preview */}
                      <div className="mt-2 p-3 bg-gray-50 rounded border">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Preview:</label>
                        <div className="text-sm">
                          <LessonMarkdown
                            content={question.question || "*Type your question above...*"}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <select
                          value={question.type}
                          onChange={(e) => updateQuestion(index, 'type', e.target.value as QuestionType)}
                          className="text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
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

                        <input
                          type="number"
                          value={question.points || 0}
                          onChange={(e) => updateQuestion(index, 'points', parseInt(e.target.value) || 0)}
                          placeholder="Points"
                          className="text-sm px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        />
                      </div>

                      {renderQuestionFields(question, index)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => window.history.back()}
              className="text-sm px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Return to Tests
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !formData.title || !formData.courseId || !formData.dueDate || !formData.questions || !formData.questions.length}
              className="text-sm px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading
                ? (editMode ? 'Updating...' : 'Creating...')
                : (editMode ? 'Update Test' : 'Create Test')
              }
            </button>
          </div>
        </div>
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
      "answer": "4"
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
                <h4 className="font-medium text-blue-900 mb-2">JSON Schema for ML Models:</h4>
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
      "type": "QuestionType",           // One of: MULTIPLE_CHOICE, MULTI_SELECT, TRUE_FALSE, SHORT_ANSWER, ESSAY, FILE_UPLOAD, CODE, MATCHING, REORDER, FILL_IN_THE_BLANK, NUMERIC
      "points": number,                 // Points for this question
      "options": ["string"],            // For multiple choice/multi-select (optional)
      "answer": "any",                  // Correct answer (type depends on question type)
      "language": "string",             // For code questions (optional)
      "matchPairs": [{"left": "string", "right": "string"}], // For matching questions
      "reorderItems": ["string"],       // For reorder questions
      "blankCount": number              // For fill in the blank
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