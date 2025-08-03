import { $Enums, QuestionType } from "@/generated/prisma";

export {};

declare global {
  interface GritUser {
    id: string;
    name: string;
    email: string;
    role: $Enums.Role;
  }

  interface Tutor {
    id: string;
    fullName: string;
    email: string;
    profileImageUrl?: string;
    bio?: string;
  }

  interface Student {
    id: string;
    fullName: string;
    email: string;
    imageUrl: string | null;
  }

  interface CourseSearchOptions {
    searchTerm: string;
    filter: string;
    sort: string;
  }

  interface CourseEvent {
    id: string;
    courseId: string;
    title: string;
    link: string;
    date: string;
  }

  interface Course {
    id: string;
    name: string;
    tutor: Tutor;
    description: string;
    imageUrl: string;
    students: Student[];
    lessons: Lesson[];
    quizzes: Quiz[];
    tests: Test[];
    submissions: Submission[];
    courseEvents: CourseEvent[];
  }

  interface Assessment {
    id: string;
    title: string;
    courseId: string;
    dueDate: string;
    createdAt: string;
    completedBy: AssessmentCompletion[];
  }

  interface Quiz extends Assessment {
    type: "quiz";
  }

  interface Test extends Assessment {
    id: string;
    title: string;
    description: string;
    preTestInstructions?: string;
    courseId: string;
    courseName: string;
    dueDate: Date;
    timeLimit?: number; // in minutes
    totalPoints: number;
    questions: Array<{
      id: string;
      question: string;
      type: QuestionType;
      points: number;
      options?: string[];
      correctAnswer?: string;
    }>;
    submissions: Array<{
      id: string;
      studentId: string;
      studentName: string;
      submittedAt: Date;
      // @ts-expect-error type any
      answers: Record<string, any>;
      uploadedFiles?: {
        questionId: string;
        fileUrl: string;
        fileType: string;
      }[];
      score?: number;
      feedback?: string;
      status: "submitted" | "graded" | "late";
    }>;
    createdAt: string;
    isActive: boolean;
  }

  interface Submission {
    id: string;
    title: string;
    courseId: string;
    dueDate: string;
    fileType: "pdf" | "docx" | "zip" | "other";
    completions: SubmissionEntry[];
  }

  interface AssessmentCompletion {
    studentId: string;
    startedAt: string;
    completedAt?: string;
    score?: number;
  }

  interface SubmissionEntry {
    studentId: string;
    submittedAt: string;
    fileUrl: string;
    grade?: number;
  }

  export interface Lesson {
    id: string;
    title: string;
    courseId: string;
    description: string;
    videoUrl?: string[];
    resourceLinks: { title: string; url: string }[];
    completions: {
      studentId: string;
      completedAt: string;
    }[];
  }

  export interface LessonCompletion {
    studentId: string;
    lessonId: string;
    completedAt: string;
  }
}
