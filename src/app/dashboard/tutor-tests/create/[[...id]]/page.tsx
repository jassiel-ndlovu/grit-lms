/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, FileText, Eye, EyeOff, Info, HelpCircle, 
  Settings, BookOpen, Calculator, ArrowUpDown, Plus, 
  ChevronRight, ChevronDown, Edit3, Save, Clock
} from "lucide-react";
import { useCourses } from "@/context/CourseContext";
import { useProfile } from "@/context/ProfileContext";
import { useTests } from "@/context/TestContext";
import { useEvents } from "@/context/EventContext";
import TestCreationSkeleton from "../../skeletons/create-test-skeleton";
import { useTestForm } from "../hooks/test-form";
import { useQuestionManagement } from "../hooks/question-management";
import { useFileHandling } from "../hooks/file-handling";
import { useTestOperations } from "../hooks/test-operations";
import { ExtendedTestQuestion } from "@/lib/test-creation-types";
import TestPreview from "../components/preview";
import TestBasicInfo from "../components/basic-info";
import QuestionsManager from "../components/questions-manager";
import ImportModal from "../components/import-modal";

type TabType = 'metadata' | 'questions';

export default function CreateTestPage() {
  const { loading: courseLoading, fetchCoursesByTutorId } = useCourses();
  const { loading: testLoading, fetchTestById, createTest, updateTest } = useTests();
  const { loading: eventsLoading, createEvent, updateEvent } = useEvents();
  const { profile } = useProfile();
  const { id } = useParams();
  const router = useRouter();

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
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  // Custom hooks
  const { formData, setFormData, resetForm } = useTestForm();
  const {
    questions,
    addQuestion,
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
    importQuestionsFromJson,
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
      } catch (error) {
        console.error("Failed to fetch courses:", error);
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
      } catch (error) {
        console.error("Failed to fetch test:", error);
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
    } catch (error) {
      console.error('Error saving test:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDraftStatus = () => {
    setFormData(prev => ({
      ...prev,
      isActive: !prev.isActive
    }));
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
      setQuestions(importedData.questions);
    }
    
    setShowImportModal(false);
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

  const renderNavigationPanel = () => (
    <div className="w-80 bg-white border border-gray-200 overflow-y-auto">
      {/* Navigation Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Questions</h3>
          <button
            onClick={() => addQuestion()}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-white p-2 rounded border">
            <div className="flex items-center gap-1 text-gray-600 mb-1">
              <BookOpen className="w-3 h-3" />
              Questions
            </div>
            <div className="font-semibold text-gray-900">{flatQuestions.length}</div>
          </div>
          <div className="bg-white p-2 rounded border">
            <div className="flex items-center gap-1 text-gray-600 mb-1">
              <Calculator className="w-3 h-3" />
              Total Points
            </div>
            <div className="font-semibold text-gray-900">{totalPoints}</div>
          </div>
        </div>
      </div>

      {/* Question Navigation */}
      <div className="p-2">
        {questions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No questions yet</p>
            <button
              onClick={() => addQuestion()}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800"
            >
              Add your first question
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {questions.map((question, index) => (
              <div key={question.id}>
                <div
                  onClick={() => setSelectedQuestionId(question.id as string)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                    selectedQuestionId === question.id
                      ? 'bg-blue-100 text-blue-900 border border-blue-200'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="w-3 h-3 text-gray-400 cursor-move" />
                      <span className="font-medium">Q{index + 1}</span>
                      {question.subQuestions && question.subQuestions.length > 0 && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleQuestionExpansion(question.id as string);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {expandedQuestions.has(question.id as string) ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{question.points || 0}pts</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 truncate">
                    {question.question || 'Untitled question'}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    {question.type?.replace('_', ' ')}
                  </div>
                </div>

                {/* Sub-questions */}
                {question.subQuestions && 
                 question.subQuestions.length > 0 && 
                 expandedQuestions.has(question.id as string) && (
                  <div className="ml-4 mt-1 space-y-1">
                    {question.subQuestions.map((subQ, subIndex) => (
                      <button
                        key={subQ.id}
                        onClick={() => setSelectedQuestionId(subQ.id as string)}
                        className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                          selectedQuestionId === subQ.id
                            ? 'bg-blue-50 text-blue-800 border border-blue-100'
                            : 'hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>Q{index + 1}.{subIndex + 1}</span>
                          <span className="text-gray-400">{subQ.points || 0}pts</span>
                        </div>
                        <div className="truncate mt-1 text-gray-500">
                          {subQ.question || 'Untitled sub-question'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-4 border-t border-gray-200 mt-auto">
        <div className="space-y-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 border border-gray-100 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
          >
            Import Questions
          </button>
          <button
            onClick={exportQuestionsToJson}
            disabled={!hasQuestions}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 border border-gray-100 bg-gray-50 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export Questions
          </button>
        </div>
      </div>
    </div>
  );

  const renderQuestionEditor = () => {
    if (!selectedQuestion) {
      return (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Edit3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">Select a question to edit</p>
            <p className="text-sm">Choose a question from the navigation panel to start editing</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto">
        <QuestionsManager
          questions={[selectedQuestion]}
          addQuestion={addQuestion}
          removeQuestion={removeQuestion}
          updateQuestion={updateQuestion}
          duplicateQuestion={duplicateQuestion}
          moveQuestion={moveQuestion}
          exportQuestionsToJson={exportQuestionsToJson}
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
        />
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
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/dashboard/tutor-tests")}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                {editMode ? 'Edit Test' : 'Create New Test'}
              </h1>
              {formData.title && (
                <span className="text-lg text-gray-500">- {formData.title}</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Status Badge */}
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                formData.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {formData.isActive ? 'Active' : 'Draft'}
              </div>

              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  showPreview
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showPreview ? 'Hide Preview' : 'Preview Test'}
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mt-4 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('metadata')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'metadata'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Test Metadata
                  {!isMetadataValid && (
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  )}
                </div>
              </button>
              <button
                onClick={() => setActiveTab('questions')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'questions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  Questions ({flatQuestions.length})
                  {!hasQuestions && (
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
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
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
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
                <div className="bg-white rounded-lg shadow-sm">
                  {/* Form Header */}
                  <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <h2 className="text-xl font-semibold text-gray-900">Test Details</h2>
                    </div>

                    {/* Draft/Active Toggle */}
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
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                            formData.isActive ? 'translate-x-6' : 'translate-x-1'
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
              <div className="flex">
                {renderNavigationPanel()}
                {renderQuestionEditor()}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        {!showPreview && (
          <div className="bg-white border border-gray-200 px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600 flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  Total Questions: {flatQuestions.length}
                </div>
                <div className="flex items-center gap-1">
                  <Calculator className="w-4 h-4" />
                  Total Points: {totalPoints}
                </div>
                {formData.timeLimit && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Time Limit: {formData.timeLimit} min
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => router.push("/dashboard/tutor-tests")}
                  className="text-sm px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
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
                  className="text-sm px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  <Save className="w-4 h-4" />
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