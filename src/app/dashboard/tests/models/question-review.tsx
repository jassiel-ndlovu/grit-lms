/* eslint-disable @typescript-eslint/no-explicit-any */

import LessonMarkdown from "@/app/components/markdown"; import { ArrowRight, CheckCircle, ChevronDown, ChevronRight, Download, FileText, XCircle } from "lucide-react";
import { useState } from "react";

const QuestionReview: React.FC<{
  questionNumber: number;
  question: AppTypes.TestQuestion;
  studentAnswer: any;
  isCorrect: boolean;
  partialCredit?: number;
}> = ({ question, questionNumber, studentAnswer, isCorrect, partialCredit }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

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

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-blue-900 mb-2">Your Matching:</h4>
                {studentMatches.length === 0 ? (
                  <p className="text-gray-600 text-sm">No matching attempted</p>
                ) : (
                  <div className="space-y-2">
                    {studentMatches.map((match, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-white border rounded">
                        <span className="text-sm font-medium">{match.left}</span>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{match.right}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-medium text-green-900 mb-2">Correct Matching:</h4>
                <div className="space-y-2">
                  {correctMatches.map((match, index) => {
                    const m = match as { left: string; right: string };
                    const left = m.left ? m.left : "Undefined Left";
                    const right = m.right ? m.right : "Undefined Right";
                    return (
                      <div key={index} className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
                        <div className="text-sm font-medium">
                          <LessonMarkdown content={left} />
                        </div>
                        <ArrowRight className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-700">{right}</span>
                      </div>
                    )
                  }
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'REORDER':
        const studentOrder = Array.isArray(studentAnswer) ? studentAnswer : [];
        const correctOrder = Array.isArray(question.answer) ? question.answer : [];

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-blue-900 mb-2">Your Order:</h4>
                {studentOrder.length === 0 ? (
                  <p className="text-gray-600 text-sm">No ordering attempted</p>
                ) : (
                  <div className="space-y-2">
                    {studentOrder.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-white border rounded">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                        <span className="text-sm">{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-medium text-green-900 mb-2">Correct Order:</h4>
                <div className="space-y-2">
                  {correctOrder.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-medium text-green-700">
                        {index + 1}
                      </div>
                      <span className="text-sm text-green-700">{item as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
    <div className="bg-white border border-gray-200">
      <div
        className="p-6 cursor-pointer hover:bg-gray-50"
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
                  Question {questionNumber} ({question.points} points)
                </span>
              </div>
              {partialCredit !== undefined && partialCredit > 0 && partialCredit < question.points && (
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                  {partialCredit}/{question.points} points
                </span>
              )}
            </div>
            <div className="text-sm">
              <LessonMarkdown content={question.question} />
            </div>
            {question.type === 'CODE' && question.language && (
              <span className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-mono">
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
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionReview;