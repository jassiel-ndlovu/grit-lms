import Skeleton from "../../components/skeleton";

export const TestTakingPageSkeleton = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Timer Skeleton */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-80 mb-1" />
              <Skeleton className="h-4 w-48" />
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-100 rounded-lg">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-5 w-16" />
              </div>
              
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-24" />
              </div>
              
              <div className="flex items-center gap-2 px-4 py-2 bg-green-600 rounded-lg">
                <Skeleton className="w-4 h-4 bg-green-700" />
                <Skeleton className="h-4 w-20 bg-green-700" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 flex gap-6">
        {/* Question Navigation Sidebar Skeleton */}
        <div className="w-64 bg-white rounded-lg shadow-sm border border-gray-200 h-fit sticky top-24">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="w-6 h-6" />
            </div>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="w-full h-2 rounded-full" />
          </div>
          
          <div className="p-4">
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 20 }).map((_, index) => (
                <Skeleton key={index} className="w-10 h-10 rounded" />
              ))}
            </div>
          </div>
        </div>

        {/* Main Question Area Skeleton */}
        <div className="flex-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Question Header Skeleton */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-16 rounded" />
                </div>
                <Skeleton className="h-6 w-24 rounded" />
              </div>
              
              <Skeleton className="h-6 w-full mb-2" />
              <Skeleton className="h-6 w-4/5" />
            </div>

            {/* Question Content Skeleton */}
            <div className="p-6">
              <div className="space-y-4">
                {/* Multiple choice options skeleton */}
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                    <Skeleton className="w-4 h-4 rounded-full" />
                    <Skeleton className="h-5 flex-1" />
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Footer Skeleton */}
            <div className="p-6 border-t border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-16" />
              </div>
              
              <div className="flex items-center gap-2">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="h-4 w-32" />
              </div>
              
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Alternative Question Content Skeletons for different question types
export const MultipleChoiceQuestionSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
        <Skeleton className="w-4 h-4 rounded-full" />
        <Skeleton className="h-5 flex-1" />
      </div>
    ))}
  </div>
);

export const TrueFalseQuestionSkeleton = () => (
  <div className="space-y-3">
    {[1, 2].map((i) => (
      <div key={i} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
        <Skeleton className="w-4 h-4 rounded-full" />
        <Skeleton className="h-5 w-16" />
      </div>
    ))}
  </div>
);

export const ShortAnswerQuestionSkeleton = () => (
  <Skeleton className="w-full h-24 rounded-lg" />
);

export const EssayQuestionSkeleton = () => (
  <Skeleton className="w-full h-48 rounded-lg" />
);

export const FileUploadQuestionSkeleton = () => (
  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
    <div className="text-center">
      <Skeleton className="w-8 h-8 mx-auto mb-3" />
      <Skeleton className="h-5 w-32 mx-auto mb-4" />
      <Skeleton className="h-10 w-24 mx-auto rounded" />
    </div>
  </div>
);

// Dynamic Question Content Skeleton that adapts to question type
export const DynamicQuestionContentSkeleton = ({ questionType }: { questionType?: string }) => {
  switch (questionType) {
    case 'MULTIPLE_CHOICE':
      return <MultipleChoiceQuestionSkeleton />;
    case 'TRUE_FALSE':
      return <TrueFalseQuestionSkeleton />;
    case 'SHORT_ANSWER':
      return <ShortAnswerQuestionSkeleton />;
    case 'ESSAY':
      return <EssayQuestionSkeleton />;
    case 'FILE_UPLOAD':
      return <FileUploadQuestionSkeleton />;
    default:
      return <MultipleChoiceQuestionSkeleton />; // Default fallback
  }
};

// Compact version for mobile or smaller screens
export const CompactTestTakingPageSkeleton = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1 rounded" />
          <Skeleton className="h-8 w-20 rounded" />
        </div>
      </div>

      {/* Mobile Question Navigation */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="w-full h-2 rounded-full" />
      </div>

      {/* Question Content */}
      <div className="p-4">
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16 rounded" />
            </div>
            <Skeleton className="h-5 w-full mb-2" />
            <Skeleton className="h-5 w-3/4" />
          </div>
          
          <div className="p-4">
            <DynamicQuestionContentSkeleton />
          </div>
          
          <div className="p-4 border-t border-gray-200 flex justify-between">
            <Skeleton className="h-8 w-20 rounded" />
            <Skeleton className="h-8 w-16 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Loading state for when switching between questions
export const QuestionTransitionSkeleton = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200">
    <div className="p-6 border-b border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-6 w-16 rounded" />
        </div>
        <Skeleton className="h-6 w-24 rounded" />
      </div>
      
      <Skeleton className="h-6 w-full mb-2" />
      <Skeleton className="h-6 w-4/5" />
    </div>

    <div className="p-6">
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Skeleton className="w-8 h-8 mx-auto mb-3" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    </div>

    <div className="p-6 border-t border-gray-200 flex items-center justify-between">
      <Skeleton className="h-8 w-20 rounded" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-16 rounded" />
    </div>
  </div>
);