/* eslint-disable @typescript-eslint/no-explicit-any */

import LessonMarkdown from "@/app/components/markdown";
import { ExtendedTestQuestion } from "@/lib/test-creation-types";
import { ArrowRight, CheckCircle, ChevronDown, ChevronRight, Download, FileText, XCircle } from "lucide-react";
import { useState, useMemo } from "react";

const QuestionReview: React.FC<{
  questionNumber: number | string;
  question: AppTypes.TestQuestion | ExtendedTestQuestion;
  questionGrade?: AppTypes.QuestionGrade;
  studentAnswer: any;
  isCorrect: boolean;
  partialCredit?: number;
  level?: number;
}> = ({ question, questionGrade, questionNumber, studentAnswer, isCorrect, partialCredit, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Shuffle arrays using Fisher-Yates algorithm
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Memoized shuffled options for Matching and Reorder questions
  const shuffledOptions = useMemo(() => {
    if (question.type === 'MATCHING' && question.matchPairs) {
      try {
        const pairs = Array.isArray(question.matchPairs) ? question.matchPairs : [];
        const leftItems = pairs.map((pair: any) => pair?.left || '');
        const rightItems = pairs.map((pair: any) => pair?.right || '');
        
        return {
          leftItems: shuffleArray(leftItems),
          rightItems: shuffleArray(rightItems)
        };
      } catch (error) {
        console.error('Error processing matching pairs:', error);
        return { leftItems: [], rightItems: [] };
      }
    }
    
    if (question.type === 'REORDER' && question.reorderItems) {
      return {
        reorderItems: shuffleArray([...question.reorderItems])
      };
    }
    
    return null;
  }, [question.type, question.matchPairs, question.reorderItems]);

  // Calculate indentation based on level
  const getIndentationClass = () => {
    switch (level) {
      case 1: return 'ml-6 border-l-2 border-l-blue-200 pl-4';
      case 2: return 'ml-12 border-l-2 border-l-green-200 pl-4';
      case 3: return 'ml-18 border-l-2 border-l-purple-200 pl-4';
      default: return '';
    }
  };

  // Get question number prefix based on level
  const getQuestionNumberPrefix = () => {
    switch (level) {
      case 0: return 'Question';
      case 1: return 'Part';
      case 2: return 'Sub-part';
      default: return 'Item';
    }
  };

  // Get background color based on level for visual hierarchy
  const getBackgroundColor = () => {
    if (level === 0) return 'bg-white';
    return level % 2 === 1 ? 'bg-gray-50' : 'bg-white';
  };

  const renderAnswer = () => {
    switch (question.type) {
      case 'MULTIPLE_CHOICE':
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => {
              const isSelected = studentAnswer === option;
              const isCorrectAnswer = question.answer === option;
              let bgColor = 'bg-gray-50 border-gray-200';

              if (isCorrectAnswer) bgColor = 'bg-green-50 border-green-200';
              else if (isSelected && !isCorrectAnswer) bgColor = 'bg-red-50 border-red-200';

              return (
                <div
                  key={index}
                  className={`p-3 rounded border ${bgColor} flex items-center justify-between`}
                >
                  <span className="flex items-center gap-2">
                    {isSelected && (
                      <div className={`w-2 h-2 rounded-full ${isCorrectAnswer ? 'bg-green-500' : 'bg-red-500'}`} />
                    )}
                    {isCorrectAnswer && !isSelected && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    <div className="text-sm">
                      <LessonMarkdown content={option} />
                    </div>
                  </span>
                  {isCorrectAnswer && (
                    <span className="text-sm text-green-600 font-medium">Correct Answer</span>
                  )}
                  {isSelected && !isCorrectAnswer && (
                    <span className="text-sm text-red-600 font-medium">
                      Your Answer
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );

      case 'MULTI_SELECT':
        const selectedAnswers = Array.isArray(studentAnswer) ? studentAnswer : [];
        const correctAnswers = Array.isArray(question.answer) ? question.answer : [];

        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => {
              const isSelected = selectedAnswers.includes(option);
              const isCorrect = correctAnswers.includes(option);
              let bgColor = 'bg-gray-50 border-gray-200';

              if (isCorrect) bgColor = 'bg-green-50 border-green-200';
              else if (isSelected && !isCorrect) bgColor = 'bg-red-50 border-red-200';

              return (
                <div
                  key={index}
                  className={`p-3 rounded border ${bgColor} flex items-center justify-between`}
                >
                  <span className="flex items-center gap-2">
                    {isSelected && (
                      <div className={`w-2 h-2 rounded-full ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`} />
                    )}
                    {isCorrect && !isSelected && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    <div className="text-sm">
                      <LessonMarkdown content={option} />
                    </div>
                  </span>
                  <div className="flex gap-2 text-sm">
                    {isCorrect && (
                      <span className="text-green-600 font-medium">Should be selected</span>
                    )}
                    {isSelected && !isCorrect && (
                      <span className="text-red-600 font-medium">Incorrectly selected</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );

      case 'TRUE_FALSE':
        return (
          <div className="space-y-2">
            {[true, false].map((option) => {
              const label = option ? 'True' : 'False';
              const isSelected = studentAnswer === option;
              const isCorrectAnswer = question.answer === option;
              let bgColor = 'bg-gray-50';

              if (isCorrectAnswer) bgColor = 'bg-green-50 border-green-200';
              else if (isSelected && !isCorrectAnswer) bgColor = 'bg-red-50 border-red-200';

              return (
                <div
                  key={label}
                  className={`p-3 rounded border ${bgColor} flex items-center justify-between`}
                >
                  <span className="flex items-center gap-2">
                    {isSelected && (
                      <div className={`w-2 h-2 rounded-full ${isCorrectAnswer ? 'bg-green-500' : 'bg-red-500'}`} />
                    )}
                    {isCorrectAnswer && !isSelected && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    {label}
                  </span>
                  {isCorrectAnswer && (
                    <span className="text-sm text-green-600 font-medium">Correct Answer</span>
                  )}
                  {isSelected && !isCorrectAnswer && (
                    <span className="text-sm text-red-600 font-medium">Your Answer</span>
                  )}
                </div>
              );
            })}
          </div>
        );

      case 'SHORT_ANSWER':
      case 'ESSAY':
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Your Answer:</h4>
              <p className="text-gray-800 text-sm whitespace-pre-wrap">{studentAnswer || 'No answer provided'}</p>
            </div>
            {question.answer && (
              <div className="bg-green-50 p-4 rounded border border-green-200">
                <h4 className="font-medium text-green-900 mb-2">Sample Answer:</h4>
                <div className="text-sm">
                  <LessonMarkdown content={question.answer as string} />
                </div>
              </div>
            )}
          </div>
        );

      case 'NUMERIC':
        return (
          <div className="flex gap-4">
            <div className={`p-3 rounded border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <span className="text-sm font-medium">Your Answer: </span>
              <span className={isCorrect ? 'text-green-700' : 'text-red-700'}>{studentAnswer}</span>
            </div>
            <div className="p-3 rounded border bg-green-50 border-green-200">
              <span className="text-sm font-medium">Correct Answer: </span>
              <span className="text-green-700">{question.answer as string}</span>
            </div>
          </div>
        );

      case 'CODE':
        return (
          <div className="space-y-4">
            <div className="bg-gray-900 text-white p-4 rounded">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium">Your Code ({question.language}):</h4>
              </div>
              <pre className="text-sm overflow-x-auto">
                <code>{studentAnswer || '// No code submitted'}</code>
              </pre>
            </div>
            {question.answer && (
              <div className="bg-green-900 text-white p-4 rounded">
                <h4 className="text-sm font-medium mb-2">Sample Solution:</h4>
                <pre className="text-sm overflow-x-auto">
                  <code>{question.answer as string}</code>
                </pre>
              </div>
            )}
          </div>
        );

      case 'FILE_UPLOAD':
        const uploadedFiles = Array.isArray(studentAnswer) ? studentAnswer : [];
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">
                Your Submission:
              </h4>
              {uploadedFiles.length === 0 ? (
                <p className="text-gray-600 text-sm">No files uploaded</p>
              ) : (
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <a
                      key={index}
                      href={file.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm p-2 bg-white hover:bg-gray-50 transition border border-gray-200"
                    >
                      <FileText className="w-4 h-4" />
                      <span className="flex-1 truncate">{file.fileName}</span>
                      <Download className="w-4 h-4 text-blue-600 hover:text-blue-800" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'MATCHING':
        const studentMatches = Array.isArray(studentAnswer) ? studentAnswer : [];
        const correctMatches = Array.isArray(question.answer) ? question.answer : [];
        const leftItems = shuffledOptions?.leftItems || [];
        const rightItems = shuffledOptions?.rightItems || [];

        return (
          <div className="space-y-6">
            {/* Student's Matching */}
            <div>
              <h4 className="font-medium text-blue-900 mb-3">Your Matching:</h4>
              {studentMatches.length === 0 ? (
                <p className="text-gray-600 text-sm">No matching attempted</p>
              ) : (
                <div className="space-y-3">
                  {studentMatches.map((match, index) => (
                    <div key={index} className="flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg">
                      <div className="flex-1 text-sm font-medium">
                        <LessonMarkdown content={match.left || 'Undefined'} />
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 text-sm">
                        <LessonMarkdown content={match.right || 'Undefined'} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Correct Matching */}
            <div>
              <h4 className="font-medium text-green-900 mb-3">Correct Matching:</h4>
              <div className="space-y-3">
                {correctMatches.map((match, index) => {
                  const m = match as { left: string; right: string };
                  return (
                    <div key={index} className="flex items-center gap-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex-1 text-sm font-medium text-green-800">
                        <LessonMarkdown content={m.left || 'Undefined'} />
                      </div>
                      <ArrowRight className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <div className="flex-1 text-sm text-green-700">
                        <LessonMarkdown content={m.right || 'Undefined'} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Available Options (Shuffled) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-700 mb-2 text-sm">Left Items (Shuffled):</h4>
                <div className="space-y-2">
                  {leftItems.map((item, index) => (
                    <div key={index} className="p-2 bg-gray-50 border border-gray-200 rounded text-sm">
                      <LessonMarkdown content={item} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-700 mb-2 text-sm">Right Items (Shuffled):</h4>
                <div className="space-y-2">
                  {rightItems.map((item, index) => (
                    <div key={index} className="p-2 bg-gray-50 border border-gray-200 rounded text-sm">
                      <LessonMarkdown content={item} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'REORDER':
        const studentOrder = Array.isArray(studentAnswer) ? studentAnswer : [];
        const correctOrder = Array.isArray(question.answer) ? question.answer : [];
        const shuffledReorderItems = shuffledOptions?.reorderItems || [];

        return (
          <div className="space-y-6">
            {/* Student's Order */}
            <div>
              <h4 className="font-medium text-blue-900 mb-3">Your Order:</h4>
              {studentOrder.length === 0 ? (
                <p className="text-gray-600 text-sm">No ordering attempted</p>
              ) : (
                <div className="space-y-2">
                  {studentOrder.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
                        {index + 1}
                      </div>
                      <div className="text-sm flex-1">
                        <LessonMarkdown content={item as string} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Correct Order */}
            <div>
              <h4 className="font-medium text-green-900 mb-3">Correct Order:</h4>
              <div className="space-y-2">
                {correctOrder.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-medium text-green-700">
                      {index + 1}
                    </div>
                    <div className="text-sm text-green-700 flex-1">
                      <LessonMarkdown content={item as string} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Available Items (Shuffled) */}
            {shuffledReorderItems.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-700 mb-2 text-sm">Available Items (Shuffled):</h4>
                <div className="space-y-2">
                  {shuffledReorderItems.map((item, index) => (
                    <div key={index} className="p-2 bg-gray-50 border border-gray-200 rounded text-sm">
                      <LessonMarkdown content={item as string} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'FILL_IN_THE_BLANK':
        const studentBlanks = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
        const correctBlanks = Array.isArray(question.answer) ? question.answer : [question.answer];

        return (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Your Answers:</h4>
              <div className="space-y-2">
                {studentBlanks.map((blank, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm font-medium">Blank {index + 1}:</span>
                    <span className={`text-sm ${blank === correctBlanks[index] ? 'text-green-700' : 'text-red-700'}`}>
                      {blank || '[blank]'}
                    </span>
                    {blank !== correctBlanks[index] && (
                      <span className="text-sm text-green-700">
                        (Correct: {correctBlanks[index] as string})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-gray-50 p-4 rounded">
            <span className="text-gray-600">Answer: {String(studentAnswer)}</span>
          </div>
        );
    }
  };

  return (
    <div className={`border border-gray-200 rounded-lg ${getIndentationClass()} ${getBackgroundColor()}`}>
      <div
        className="p-6 cursor-pointer hover:bg-gray-50 transition-colors rounded-lg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                {isCorrect ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <span className="font-medium text-gray-900">
                  {getQuestionNumberPrefix()} {questionNumber} ({question.points} points)
                  {level > 0 && (
                    <span className="ml-2 text-xs font-normal text-gray-500">
                      (Level {level})
                    </span>
                  )}
                </span>
              </div>
              {partialCredit !== undefined && partialCredit > 0 && partialCredit < (question.points as number) && (
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                  {partialCredit}/{question.points} points
                </span>
              )}
            </div>
            <div className="text-sm">
              <LessonMarkdown content={question.question} />
            </div>
            {question.type === 'CODE' && question.language && (
              <span className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-mono mt-2">
                {question.language}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
              {isCorrect ? 'Correct' : 'Incorrect'}
            </span>
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-6 pb-6 border-t border-gray-100">
          <div className="mt-4">
            {renderAnswer()}
            {questionGrade && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900">
                    Score: {questionGrade.score}/{questionGrade.outOf}
                  </span>
                  <span className="text-sm text-blue-700">
                    {((questionGrade.score / questionGrade.outOf) * 100).toFixed(1)}%
                  </span>
                </div>
                {questionGrade.feedback && (
                  <div className="mt-2">
                    <p className="text-sm text-blue-900">{questionGrade.feedback}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recursively render sub-questions */}
          {question.subQuestions && question.subQuestions.length > 0 && (
            <div className="mt-6 space-y-4">
              <h4 className="font-medium text-gray-900 text-sm">
                {level === 0 ? 'Sub-questions' : 'Follow-up questions'}:
              </h4>
              {question.subQuestions.map((subQuestion, index) => {
                const safeSubQuestion: ExtendedTestQuestion = {
                  ...subQuestion,
                  subQuestions: [],
                  // @ts-expect-error question is valid here
                  parent: question,
                };

                return (
                  <QuestionReview
                    key={subQuestion.id}
                    question={safeSubQuestion}
                    questionNumber={index + 1}
                    studentAnswer={studentAnswer?.[subQuestion.id as string] || studentAnswer} 
                    isCorrect={areAnswersEqual(studentAnswer?.[subQuestion.id as string], subQuestion.answer)}
                    questionGrade={getSubQuestionGrade(subQuestion.id as string)}
                    level={level + 1}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper function for answer comparison
function areAnswersEqual(studentAnswer: any, correctAnswer: any): boolean {
  if (studentAnswer == null && correctAnswer == null) return true;
  if (studentAnswer == null || correctAnswer == null) return false;
  if (typeof studentAnswer !== typeof correctAnswer) return false;

  if (Array.isArray(studentAnswer) && Array.isArray(correctAnswer)) {
    if (studentAnswer.length !== correctAnswer.length) return false;
    return studentAnswer.every((item, index) =>
      JSON.stringify(item) === JSON.stringify(correctAnswer[index])
    );
  }

  return JSON.stringify(studentAnswer) === JSON.stringify(correctAnswer);
}

// Helper function to get sub-question grades
function getSubQuestionGrade(questionId: string): AppTypes.QuestionGrade | undefined {
  // Implement this based on your data structure
  // This should return the grade for a specific sub-question
  if (questionId) return undefined;
  return undefined;
}

export default QuestionReview;