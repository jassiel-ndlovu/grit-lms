import { CheckCircle2, XCircle } from "lucide-react"
import { BadgeVariant } from "@/lib/ui"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge";

interface QuestionReviewProps {
  question: AppTypes.TestQuestion;
  questionNumber: number;
  studentAnswer: any;
  isCorrect: boolean;
  questionGrade?: AppTypes.QuestionGrade | null;
  level?: number;
}

export function QuestionReview({
  question,
  questionNumber,
  studentAnswer,
  isCorrect,
  questionGrade,
  level = 0
}: QuestionReviewProps) {
  const getQuestionTypeBadge = (type: string) => {
    const typeMap: Record<string, { label: string; variant: BadgeVariant }> = {
      MULTIPLE_CHOICE: { label: "Multiple Choice", variant: "default" },
      TRUE_FALSE: { label: "True/False", variant: "secondary" },
      SHORT_ANSWER: { label: "Short Answer", variant: "outline" },
      ESSAY: { label: "Essay", variant: "outline" },
      FILL_IN_THE_BLANK: { label: "Fill in Blank", variant: "secondary" },
      MATCHING: { label: "Matching", variant: "default" },
      REORDER: { label: "Reorder", variant: "secondary" },
      MULTI_SELECT: { label: "Multi-Select", variant: "default" },
      CODE: { label: "Code", variant: "outline" },
      NUMERIC: { label: "Numeric", variant: "secondary" },
      FILE_UPLOAD: { label: "File Upload", variant: "outline" }
    }
    
    return typeMap[type] || { label: type, variant: "outline" }
  }

  const renderAnswer = () => {
    switch (question.type) {
      case "MULTIPLE_CHOICE":
      case "TRUE_FALSE":
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <div key={index} className="flex items-center gap-3 p-2 rounded border">
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                  option === studentAnswer ? "bg-blue-100 border-blue-500" : "bg-gray-50"
                }`}>
                  {option === studentAnswer && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </div>
                <span className={option === studentAnswer ? "font-medium" : ""}>
                  {option}
                </span>
                {option === question.answer && (
                  <Badge variant="success" className="ml-auto">
                    Correct Answer
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )

      case "MULTI_SELECT":
        const studentAnswers = Array.isArray(studentAnswer) ? studentAnswer : []
        const correctAnswers = Array.isArray(question.answer) ? question.answer : []
        
        return (
          <div className="space-y-2">
            {question.options?.map((option, index) => (
              <div key={index} className="flex items-center gap-3 p-2 rounded border">
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                  studentAnswers.includes(option) ? "bg-blue-100 border-blue-500" : "bg-gray-50"
                }`}>
                  {studentAnswers.includes(option) && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </div>
                <span className={studentAnswers.includes(option) ? "font-medium" : ""}>
                  {option}
                </span>
                {correctAnswers.includes(option) && (
                  <Badge variant="success" className="ml-auto">
                    Correct
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )

      case "FILL_IN_THE_BLANK":
        return (
          <div className="space-y-2">
            <div className="p-3 bg-gray-50 rounded">
              <span className="font-medium">Your answer:</span> {studentAnswer || "No answer provided"}
            </div>
            <div className="p-3 bg-green-50 rounded">
              <span className="font-medium">Correct answer:</span> {question.answer as string}
            </div>
          </div>
        )

      case "SHORT_ANSWER":
      case "ESSAY":
        return (
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm font-medium mb-1">Your answer:</div>
              <div className="whitespace-pre-wrap">{studentAnswer || "No answer provided"}</div>
            </div>
            {question.answer && (
              <div className="p-3 bg-green-50 rounded">
                <div className="text-sm font-medium mb-1">Expected answer:</div>
                <div className="whitespace-pre-wrap">{question.answer as string}</div>
              </div>
            )}
          </div>
        )

      case "MATCHING":
        return (
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm font-medium mb-2">Your matches:</div>
              {studentAnswer && typeof studentAnswer === 'object' ? (
                Object.entries(studentAnswer).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 py-1">
                    <span className="font-medium">{key}:</span>
                    <span>{String(value)}</span>
                  </div>
                ))
              ) : (
                <div>No matches provided</div>
              )}
            </div>
            {question.answer && typeof question.answer === 'object' && (
              <div className="p-3 bg-green-50 rounded">
                <div className="text-sm font-medium mb-2">Correct matches:</div>
                {Object.entries(question.answer).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 py-1">
                    <span className="font-medium">{key}:</span>
                    <span>{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      default:
        return (
          <div className="space-y-2">
            <div className="p-2 bg-gray-50 rounded">
              <span className="font-medium">Your answer:</span> {JSON.stringify(studentAnswer)}
            </div>
            <div className="p-2 bg-green-50 rounded">
              <span className="font-medium">Correct answer:</span> {JSON.stringify(question.answer)}
            </div>
          </div>
        )
    }
  }

  const typeInfo = getQuestionTypeBadge(question.type)

  return (
    <Card className={`${level > 0 ? 'ml-6 border-l-4 border-l-blue-200' : ''}`}>
      <CardContent className="p-6">
        {/* Question Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                {level === 0 ? `Q${questionNumber}` : `Part ${questionNumber}`}
              </span>
              <Badge variant={typeInfo.variant}>
                {typeInfo.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {isCorrect ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <Badge variant={isCorrect ? "success" : "error"}>
                {isCorrect ? 'Correct' : 'Incorrect'}
              </Badge>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm text-gray-600">Points: {question.points}</div>
            {questionGrade && (
              <div className="text-sm font-medium">
                Score: {questionGrade.score}/{questionGrade.outOf}
              </div>
            )}
          </div>
        </div>

        {/* Question Content */}
        <div className="mb-4">
          <div className="prose prose-sm max-w-none mb-4">
            {question.question}
          </div>
        </div>

        {/* Answer Section */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Answer Review</h4>
          {renderAnswer()}
        </div>

        {/* Instructor Feedback */}
        {questionGrade?.feedback && (
          <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
            <div className="text-sm font-medium text-blue-900 mb-1">Instructor Feedback</div>
            <div className="text-blue-800 text-sm">{questionGrade.feedback}</div>
          </div>
        )}

        {/* Sub-questions */}
        {question.subQuestions && question.subQuestions.length > 0 && (
          <div className="mt-6 space-y-4">
            <h4 className="font-medium text-gray-900">Sub-questions</h4>
            {question.subQuestions.map((subQuestion, index) => (
              <QuestionReview
                key={subQuestion.id}
                // @ts-expect-error subQuestions is already of type TestQuestion[]
                question={subQuestion}
                questionNumber={index + 1}
                studentAnswer={studentAnswer?.[subQuestion.id]}
                isCorrect={areAnswersEqual(studentAnswer?.[subQuestion.id], subQuestion.answer)}
                questionGrade={getSubQuestionGrade(subQuestion.id)}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Helper function for answer comparison (you might want to move this to a utils file)
function areAnswersEqual(studentAnswer: any, correctAnswer: any): boolean {
  if (studentAnswer == null && correctAnswer == null) return true
  if (studentAnswer == null || correctAnswer == null) return false
  if (typeof studentAnswer !== typeof correctAnswer) return false

  if (Array.isArray(studentAnswer) && Array.isArray(correctAnswer)) {
    if (studentAnswer.length !== correctAnswer.length) return false
    return studentAnswer.every((item, index) =>
      JSON.stringify(item) === JSON.stringify(correctAnswer[index])
    )
  }

  return JSON.stringify(studentAnswer) === JSON.stringify(correctAnswer)
}

// Helper function to get sub-question grades (implement based on your data structure)
function getSubQuestionGrade(questionId: string): AppTypes.QuestionGrade | undefined {
  // Implement this based on how you store sub-question grades
  return undefined
}