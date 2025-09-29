/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, FileText, Eye, EyeOff, Info, HelpCircle,
  BookOpen, Calculator, Plus,
  Edit3, Save, Clock, Check,
  AlertTriangle, X, Loader2
} from "lucide-react";
import { useCourses } from "@/context/CourseContext";
import { useProfile } from "@/context/ProfileContext";
import { useTests } from "@/context/TestContext";
import { useEvents } from "@/context/EventContext";
import TestCreationSkeleton from "../../skeletons/create-test-skeleton";
import { useQuestionManagement } from "../hooks/use-question-management";
import { useToast } from "../hooks/use-toast";
import { ExtendedTestQuestion } from "@/lib/test-creation-types";
import TestPreview from "../components/preview";
import TestBasicInfo from "../components/basic-info";
import { QuestionsManager } from "../components/questions-manager";
import ImportModal from "../components/import-modal";
import { useTestForm } from "../hooks/use-test-form";
import { useFileHandling } from "../hooks/use-file-handling";
import { useTestOperations } from "../hooks/use-test-operations";
import { NavigationPanel } from "../components/navigational-panel";

type TabType = 'metadata' | 'questions';

export default function CreateTestPage() {
  const { loading: courseLoading, fetchCoursesByTutorId } = useCourses();
  const { loading: testLoading, fetchTestById, createTest, updateTest } = useTests();
  const { loading: eventsLoading, createEvent, updateEvent } = useEvents();
  const { profile } = useProfile();
  const { id } = useParams();
  const router = useRouter();
  const { toasts, addToast, removeToast } = useToast();

  const editMode = id !== undefined && id !== null;

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);

  // State
  const [activeTab, setActiveTab] = useState<TabType>('metadata');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<AppTypes.Course[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  // Custom hooks
  const { formData, setFormData } = useTestForm();
  const {
    questions,
    addQuestion,
    addSubQuestion,
    removeQuestion,
    updateQuestion,
    duplicateQuestion,
    moveQuestion,
    setQuestions,
    flattenQuestions
  } = useQuestionManagement(formData.questions || []);

  const {
    uploadedImages,
    uploadedFiles,
    isUploading,
    dragOver,
    setDragOver,
    handleQuestionFileUpload,
    handleDrop,
    handleFileInput,
    setUploadedImages,
    setUploadedFiles
  } = useFileHandling();

  const {
    exportQuestionsToJson,
    handleSubmit: performSubmit
  } = useTestOperations({
    formData,
    setFormData,
    questions,
    setQuestions,
    uploadedImages,
    uploadedFiles,
    setUploadedImages,
    setUploadedFiles,
    editMode,
    createTest,
    updateTest,
    createEvent,
    updateEvent,
    setLoading,
    router
  });

  // Enhanced question management with toast notifications
  const handleAddQuestion = () => {
    addQuestion();
    addToast({
      type: 'success',
      title: 'Question Added',
      message: 'New question has been added to your test'
    });
  };

  const handleAddSubQuestion = (parentId: string) => {
    addSubQuestion(parentId);
    addToast({
      type: 'success',
      title: 'Sub-question Added',
      message: 'New sub-question has been added to your test'
    });
  };

  const handleRemoveQuestion = (questionId: string) => {
    const questionIndex = questions.findIndex(q => q.id === questionId);
    removeQuestion(questionId);
    addToast({
      type: 'info',
      title: 'Question Removed',
      message: `Question ${questionIndex + 1} has been removed`
    });

    if (selectedQuestionId === questionId) {
      const remainingQuestions = questions.filter(q => q.id !== questionId);
      setSelectedQuestionId(remainingQuestions.length > 0 ? remainingQuestions[0].id as string : null);
    }
  };

  const handleDuplicateQuestion = (questionId: string) => {
    const questionIndex = questions.findIndex(q => q.id === questionId);
    duplicateQuestion(questionId);
    addToast({
      type: 'success',
      title: 'Question Duplicated',
      message: `Question ${questionIndex + 1} has been duplicated`
    });
  };

  const handleExportQuestions = () => {
    try {
      exportQuestionsToJson();
      addToast({
        type: 'success',
        title: 'Questions Exported',
        message: 'Questions have been exported successfully'
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: 'Failed to export questions. Please try again.'
      });
      console.error(error);
    }
  };

  // Auto-select first question when switching to questions tab
  useEffect(() => {
    if (activeTab === 'questions' && questions.length > 0 && !selectedQuestionId) {
      setSelectedQuestionId(questions[0].id as string);
    }
  }, [activeTab, questions, selectedQuestionId]);

  // Fetch courses on mount
  useEffect(() => {
    if (!profile?.id) return;

    const fetchCourses = async () => {
      setLoading(true);
      try {
        const fetchedCourses = await fetchCoursesByTutorId(profile.id) as AppTypes.Course[];
        setCourses(fetchedCourses);
        addToast({
          type: 'info',
          title: 'Courses Loaded',
          message: `${fetchedCourses.length} courses available`
        });
      } catch (error) {
        console.error("Failed to fetch courses:", error);
        addToast({
          type: 'error',
          title: 'Loading Failed',
          message: 'Failed to load courses. Please refresh the page.'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [profile?.id, fetchCoursesByTutorId]);

  // Fetch test data when editing
  useEffect(() => {
    if (!editMode || !id) return;

    const fetchTest = async () => {
      setLoading(true);
      try {
        const test = await fetchTestById(id as string) as AppTypes.Test;

        setFormData({
          ...test,
          dueDate: new Date(test.dueDate),
          questions: []
        });

        setQuestions(test.questions.map(q => ({
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
        } as ExtendedTestQuestion)));

        addToast({
          type: 'success',
          title: 'Test Loaded',
          message: `"${test.title}" loaded successfully`
        });
      } catch (error) {
        console.error("Failed to fetch test:", error);
        addToast({
          type: 'error',
          title: 'Loading Failed',
          message: 'Failed to load test data. Please try again.'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTest();
  }, [editMode, id, fetchTestById, setFormData, setQuestions]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await performSubmit();
      addToast({
        type: 'success',
        title: editMode ? 'Test Updated' : 'Test Created',
        message: `"${formData.title}" has been ${editMode ? 'updated' : 'created'} successfully`
      });
    } catch (error) {
      console.error('Error saving test:', error);
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: `Failed to ${editMode ? 'update' : 'create'} test. Please try again.`
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleDraftStatus = () => {
    const newStatus = !formData.isActive;
    setFormData(prev => ({
      ...prev,
      isActive: newStatus
    }));

    addToast({
      type: 'info',
      title: 'Status Changed',
      message: `Test is now ${newStatus ? 'Active' : 'Draft'}`
    });
  };

  const handleImportSuccess = (importedData: any) => {
    if (importedData.title) {
      setFormData(prev => ({
        ...prev,
        title: importedData.title,
        description: importedData.description || prev.description,
        preTestInstructions: importedData.preTestInstructions || prev.preTestInstructions,
        dueDate: importedData.dueDate ? new Date(importedData.dueDate) : prev.dueDate,
        timeLimit: importedData.timeLimit || prev.timeLimit
      }));
    }

    if (importedData.questions) {
      console.log("Imported Questions", importedData.questions)
      setQuestions(importedData.questions);
    }

    setShowImportModal(false);
    addToast({
      type: 'success',
      title: 'Import Successful',
      message: `${importedData.questions?.length || 0} questions imported`
    });
  };

  const handleQuestionsReorder = (reorderedQuestions: ExtendedTestQuestion[]) => {
    setQuestions(reorderedQuestions);
  };

  const handleSubQuestionsReorder = (parentId: string, reorderedSubQuestions: ExtendedTestQuestion[]) => {
    setQuestions(prevQuestions =>
      prevQuestions.map(question =>
        question.id === parentId
          ? { ...question, subQuestions: reorderedSubQuestions }
          : question
      )
    );
  };

  const findQuestionById = (id: string, questionsList: ExtendedTestQuestion[]): ExtendedTestQuestion | null => {
    for (const question of questionsList) {
      if (question.id === id) return question;
      if (question.subQuestions) {
        const found = findQuestionById(id, question.subQuestions);
        if (found) return found;
      }
    }
    return null;
  };

  const selectedQuestion = selectedQuestionId ? findQuestionById(selectedQuestionId, questions) : null;
  const flatQuestions = flattenQuestions(questions);

  // Validation checks
  const isMetadataValid = formData.title && formData.courseId && formData.dueDate;
  const hasQuestions = questions.length > 0;
  const totalPoints = flatQuestions.reduce((sum, q) => sum + (q.points || 0), 0);

  const renderToasts = () => (
    <div className="fixed top-24 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`w-64 bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all duration-300 ease-in-out ${toast.type === 'success' ? 'border-l-4 border-green-400' :
            toast.type === 'error' ? 'border-l-4 border-red-400' :
              toast.type === 'warning' ? 'border-l-4 border-yellow-400' :
                'border-l-4 border-blue-400'
            }`}
        >
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {toast.type === 'success' && <Check className="h-5 w-5 text-green-400" />}
                {toast.type === 'error' && <X className="h-5 w-5 text-red-400" />}
                {toast.type === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-400" />}
                {toast.type === 'info' && <Info className="h-5 w-5 text-blue-400" />}
              </div>
              <div className="ml-3 w-0 flex-1 pt-0.5">
                <p className="text-sm font-medium text-gray-900">{toast.title}</p>
                <p className="mt-1 text-sm text-gray-500">{toast.message}</p>
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
                  onClick={() => removeToast(toast.id)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderQuestionEditor = () => {
    if (!selectedQuestion) {
      return (
        <div className="flex-1 flex items-center justify-center text-gray-500 bg-gray-50">
          <div className="text-center p-8">
            <Edit3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-xl font-medium mb-2 text-gray-700">Select a question to edit</p>
            <p className="text-sm text-gray-500">Choose a question from the navigation panel to start editing</p>
            {questions.length === 0 && (
              <button
                onClick={handleAddQuestion}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create First Question
              </button>
            )}
          </div>
        </div>
      );
    }

    // Find if the selected question is a sub-question
    let parentQuestion: ExtendedTestQuestion | null = null;
    let isSubQuestion = false;

    for (const q of questions) {
      if (q.id === selectedQuestion.id) {
        parentQuestion = q;
        break;
      }
      if (q.subQuestions && q.subQuestions.some(sub => sub.id === selectedQuestion.id)) {
        parentQuestion = q;
        isSubQuestion = true;
        break;
      }
    }

    // If we're editing a sub-question, show only that sub-question in the editor
    const questionToEdit = isSubQuestion ? selectedQuestion : parentQuestion || selectedQuestion;

    return (
      <div className="flex-1 overflow-y-auto bg-white">
        <QuestionsManager
          questions={[questionToEdit]}
          addQuestion={handleAddQuestion}
          addSubQuestion={handleAddSubQuestion}
          removeQuestion={handleRemoveQuestion}
          updateQuestion={updateQuestion}
          duplicateQuestion={handleDuplicateQuestion}
          moveQuestion={moveQuestion}
          exportQuestionsToJson={handleExportQuestions}
          onImport={() => setShowImportModal(true)}
          fileHandling={{
            handleQuestionFileUpload,
            handleDrop,
            handleFileInput,
            isUploading,
            dragOver,
            setDragOver
          }}
          fileUploadRef={fileUploadRef as React.RefObject<HTMLInputElement>}
          selectedSubQuestionId={isSubQuestion ? selectedQuestion.id as string : null}
        />
      </div>
    );
  };

  if ((loading && !formData.title) || courseLoading || testLoading || eventsLoading) {
    return <TestCreationSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {renderToasts()}

      {/* Enhanced Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/dashboard/tutor-tests")}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {editMode ? 'Edit Test' : 'Create New Test'}
                </h1>
                {formData.title && (
                  <span className="text-sm text-gray-500 mt-1">&quot;{formData.title}&quot;</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Enhanced Status Badge */}
              <div className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 ${formData.isActive
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                }`}>
                <div className={`w-2 h-2 rounded-full ${formData.isActive ? 'bg-green-500' : 'bg-yellow-500'
                  }`}></div>
                {formData.isActive ? 'Active' : 'Draft'}
              </div>

              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${showPreview
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                  }`}
              >
                {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showPreview ? 'Hide Preview' : 'Preview Test'}
              </button>
            </div>
          </div>

          {/* Enhanced Tab Navigation */}
          <div className="mt-4 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('metadata')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${activeTab === 'metadata'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Test Metadata
                  {!isMetadataValid && (
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveTab('questions')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${activeTab === 'questions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Questions ({flatQuestions.length})
                  {!hasQuestions && (
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  )}
                </div>
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {showPreview ? (
          <div className="p-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h2 className="text-xl font-semibold text-gray-900">Test Preview</h2>
                <p className="text-sm text-gray-600 mt-1">This is how students will see the test</p>
              </div>
              <TestPreview formData={formData} questions={questions} />
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'metadata' ? (
              <div className="p-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  {/* Form Header */}
                  <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <h2 className="text-xl font-semibold text-gray-900">Test Details</h2>
                    </div>

                    {/* Enhanced Draft/Active Toggle */}
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">
                        {formData.isActive ? 'Active' : 'Draft'}
                      </span>
                      <button
                        type="button"
                        onClick={toggleDraftStatus}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${formData.isActive ? 'bg-green-600' : 'bg-gray-300'
                          }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-all duration-300 shadow-lg ${formData.isActive ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="p-6">
                    <TestBasicInfo
                      formData={formData}
                      setFormData={setFormData}
                      courses={courses}
                      editMode={editMode}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-[calc(100vh-200px)]">
                <NavigationPanel
                  questions={questions}
                  selectedQuestionId={selectedQuestionId}
                  setSelectedQuestionId={setSelectedQuestionId}
                  onAddQuestion={handleAddQuestion}
                  onImport={() => setShowImportModal(true)}
                  onExport={handleExportQuestions}
                  hasQuestions={hasQuestions}
                  totalPoints={totalPoints}
                  flatQuestions={flatQuestions}
                  onQuestionsReorder={handleQuestionsReorder}
                  onSubQuestionsReorder={handleSubQuestionsReorder}
                />
                {renderQuestionEditor()}
              </div>
            )}
          </>
        )}

        {/* Enhanced Footer */}
        {!showPreview && (
          <div className="bg-white border-t border-gray-200 shadow-lg">
            <div className="px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600 flex items-center gap-6">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
                    <BookOpen className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">Questions:</span>
                    <span className="font-bold text-gray-900">{flatQuestions.length}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
                    <Calculator className="w-4 h-4 text-green-500" />
                    <span className="font-medium">Points:</span>
                    <span className="font-bold text-gray-900">{totalPoints}</span>
                  </div>
                  {formData.timeLimit && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg">
                      <Clock className="w-4 h-4 text-orange-500" />
                      <span className="font-medium">Time:</span>
                      <span className="font-bold text-gray-900">{formData.timeLimit} min</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => router.push("/dashboard/tutor-tests")}
                    className="text-sm px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 hover:shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={
                      loading ||
                      !isMetadataValid ||
                      !hasQuestions
                    }
                    className="text-sm px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 flex items-center gap-2 shadow-sm hover:shadow-md disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {loading
                      ? (editMode ? 'Updating...' : 'Creating...')
                      : (editMode ? 'Update Test' : 'Create Test')
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={handleImportSuccess}
          fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
        />
      )}
    </div>
  );
}