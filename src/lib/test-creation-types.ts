import { QuestionType } from "@/generated/prisma";

export interface ExtendedTestQuestion extends Omit<Partial<AppTypes.TestQuestion>, "subQuestions"> {
  subQuestions?: ExtendedTestQuestion[];
  isExpanded?: boolean;
}

export interface QuestionExport {
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

export interface MLTestSchema {
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

export type QuestionTab = 'content' | 'settings' | 'answer';

export interface TestFormData extends Partial<Omit<AppTypes.Test, "questions">> {
  questions?: ExtendedTestQuestion[];
}

export interface FileHandlingProps {
  handleQuestionFileUpload: (
    file: File, 
    questionId: string, 
    currentQuestionText: string,
    updateQuestionCallback: (questionId: string, field: string, value: any) => void
  ) => Promise<void>;
  handleDrop: (
    e: React.DragEvent,
    questionId: string, 
    currentQuestionText: string,
    updateQuestionCallback: (questionId: string, field: string, value: any) => void
  ) => void;
  handleFileInput: (
    e: React.ChangeEvent<HTMLInputElement>,
    questionId: string, 
    currentQuestionText: string,
    updateQuestionCallback: (questionId: string, field: string, value: any) => void
  ) => void;
  isUploading: boolean;
  dragOver: boolean;
  setDragOver: (dragOver: boolean) => void;
}

export interface QuestionManagerProps {
  questions: ExtendedTestQuestion[];
  addQuestion: (parentId?: string) => void;
  addSubQuestion: (parentId: string) => void;
  removeQuestion: (questionId: string) => void;
  updateQuestion: (questionId: string, field: string, value: any) => void;
  duplicateQuestion: (questionId: string) => void;
  moveQuestion: (fromIndex: number, toIndex: number) => void;
  exportQuestionsToJson: () => void;
  onImport: () => void;
  fileHandling: FileHandlingProps;
  fileUploadRef: React.RefObject<HTMLInputElement>;
}