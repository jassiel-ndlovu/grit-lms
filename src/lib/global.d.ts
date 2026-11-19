// global.d.ts
import { Prisma, $Enums } from "@/generated/prisma";

export {};

declare global {
  namespace AppTypes {
    // Base model types
    type User = Prisma.UserGetPayload<object>;
    // Teacher and student links come from CourseStaff and Enrollment now
    // (issue #93), not Prisma relations on Course, so these legacy shapes
    // are spelled out: the /api routes still return them.
    type TutorRow = Prisma.TutorGetPayload<object>;
    type StudentRow = Prisma.StudentGetPayload<object>;
    type CourseRow = Omit<Prisma.CourseGetPayload<object>, "tutorId">;
    type Tutor = TutorRow & { courses: CourseRow[] };
    type Student = Prisma.StudentGetPayload<{
      include: { TestSubmission: true };
    }> & { courses: CourseRow[] };
    type Course = Prisma.CourseGetPayload<{
      include: {
        lessons: {
          include: {
            completions: true;
            attachmentUrls: true;
          };
        };
        quizzes: true;
        tests: true;
        submissions: true;
        courseEvents: true;
      };
    }> & { tutor: TutorRow; students: StudentRow[] };
    type Lesson = Prisma.LessonGetPayload<{
      include: { completions: true; attachmentUrls: true };
    }>;
    type Attachment = Prisma.AttachmentGetPayload<object>;
    type LessonCompletion = Prisma.LessonCompletionGetPayload<object>;
    type CourseEvent = Prisma.CourseEventGetPayload<object> & {
      course: CourseRow & { tutor: TutorRow };
    };
    type Quiz = Prisma.QuizGetPayload<{
      include: { completions: true };
    }>;
    type Test = Prisma.TestGetPayload<{
      include: {
        questions: {
          include: {
            subQuestions: true,
            parent: true,
          }
        };
        submissions: {
          include: {
            uploadedFiles: true;
          };
        };
      };
    }>;
    type ExtendedTestQuestion = AppTypes.TestQuestion & {
      subQuestions?: ExtendedTestQuestion[];
      order: number; // Make order non-nullable for UI purposes
    };
    type TestQuestion = Prisma.TestQuestionGetPayload<{
      include: {
        subQuestions: true;
        parent: true;
      };
    }>;
    type TestSubmission = Prisma.TestSubmissionGetPayload<{
      include: {
        uploadedFiles: true;
        grade: true;
        questionGrades: true;
      };
    }>;

    type TestAnswer =
      | string // short/essay/multiple choice/single fill-in
      | string[] // multi-select, reorder, matching (keys)
      | number // numeric answers
      | boolean // true/false
      | { left: string; right: string }[] // matching question pairs
      | { fileUrl: string; fileType: string; fileName: string } // file upload
      | null; // unanswered

    type AnswerMap = {
      [questionId: string]: TestAnswer;
    };

    type UploadedFile = Prisma.UploadedFileGetPayload<object>;
    type AssessmentCompletion = Prisma.AssessmentCompletionGetPayload<object>;

    type DescriptionFile = {
      title: string;
      url: string;
    };
    type Submission = Prisma.SubmissionGetPayload<{
      include: {
        entries: true;
      };
    }>;

    type SubmissionEntry = Prisma.SubmissionEntryGetPayload<{
      include: {
        student: true;
        questionGrades: true;
        grade: true;
      };
    }>;
    type Resource = Prisma.ResourceGetPayload<object>;
    type Grade = Prisma.GradeGetPayload<object>;
    type QuestionGrade = Prisma.QuestionGradeGetPayload<object>;
    type Notification = Prisma.NotificationGetPayload<object>;
    type ActivityLog = Prisma.ActivityLogGetPayload<object>;

    // Enums
    type Role = $Enums.Role;
    type QuestionType = $Enums.QuestionType;
    type FileType = $Enums.FileType;
    type SubmissionStatus = $Enums.SubmissionStatus;

    // Derived app-specific types
    interface CourseSearchOptions {
      searchTerm: string;
      filter: string;
      sort: string;
    }

    interface TestTimerData {
      startedAt: Date;
      durationMinutes: number;
      testId: string;
      studentId: string;
    }

    type AnswerObject =
      | { type: "MULTIPLE_CHOICE"; value: string }
      | { type: "SHORT_ANSWER"; value: string }
      | { type: "ESSAY"; value: string }
      | { type: "FILE_UPLOAD"; value: null }
      | { type: "CHECKBOX"; value: string[] }
      | { type: "CODE"; value: string }
      | { type: "NUMERIC"; value: number }
      | { type: "REORDER"; value: string[] }
      | { type: "MATCHING"; value: Array<{ left: string; right: string }> }
      | { type: "FILL_IN_THE_BLANK"; value: string[] };
  }
}
