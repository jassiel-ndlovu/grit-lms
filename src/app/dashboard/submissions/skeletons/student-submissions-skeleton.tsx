import { Calendar, FileText, Upload } from "lucide-react";
import Skeleton from "../../components/skeleton";

// Main Submissions List Skeleton
export function SubmissionsListSkeleton() {
  return (
    <div className="h-full px-6 pt-6 pb-10 bg-gray-50 overflow-y-auto">
      {/* Header Skeleton */}
      <div className="mb-8">
        <Skeleton className="h-9 w-64 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Filters Skeleton */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <Skeleton className="h-10 w-48" />
      </div>

      {/* Submissions Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <SubmissionCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// Individual Submission Card Skeleton
function SubmissionCardSkeleton() {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 pr-4">
          <Skeleton className="h-5 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-2" />
        </div>
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center">
          <Calendar className="w-4 h-4 mr-2 text-gray-300" />
          <Skeleton className="h-4 w-32" />
        </div>
        
        <div className="flex items-center">
          <Skeleton className="h-4 w-4 mr-2" />
          <Skeleton className="h-4 w-28" />
        </div>

        <div className="flex items-center">
          <Skeleton className="h-4 w-16 mr-2" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>

      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

// Submission Portal Skeleton
export function SubmissionPortalSkeleton() {
  return (
    <div className="h-full px-6 pt-6 pb-10 bg-gray-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header Skeleton */}
        <div className="mb-8">
          <Skeleton className="h-4 w-40 mb-4" />
          <Skeleton className="h-9 w-96 mb-2" />
          <Skeleton className="h-5 w-48 mb-2" />
          <div className="flex items-center mt-2">
            <Calendar className="w-4 h-4 mr-2 text-gray-300" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Upload Area Skeleton */}
        <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-200 mb-6">
          <Skeleton className="h-6 w-48 mb-6" />
          
          {/* Upload Box Skeleton */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center">
              <Upload className="w-12 h-12 text-gray-300 mb-4" />
              <Skeleton className="h-6 w-64 mb-2" />
              <Skeleton className="h-4 w-48 mb-4" />
              <Skeleton className="h-10 w-32 rounded-md" />
            </div>
          </div>

          {/* Uploaded Files Skeleton */}
          <div className="mt-6">
            <Skeleton className="h-5 w-32 mb-3" />
            <div className="space-y-2">
              {[...Array(2)].map((_, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 text-gray-300 mr-3" />
                    <div>
                      <Skeleton className="h-4 w-48 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-5 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Submit Button Skeleton */}
          <div className="mt-8 flex justify-end">
            <Skeleton className="h-10 w-36 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Submission Details Skeleton
export function StudentSubmissionDetailsSkeleton() {
  return (
    <div className="h-full px-6 pt-6 pb-10 bg-gray-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header Skeleton */}
        <div className="mb-8">
          <Skeleton className="h-4 w-40 mb-4" />
          <Skeleton className="h-9 w-96 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>

        {/* Submission Info Skeleton */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-6">
          <Skeleton className="h-6 w-48 mb-4" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Skeleton className="h-4 w-16 mb-1" />
              <Skeleton className="h-5 w-32" />
            </div>
            
            <div>
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-5 w-32" />
            </div>
            
            <div>
              <Skeleton className="h-4 w-12 mb-1" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            
            <div>
              <Skeleton className="h-4 w-12 mb-1" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>

          {/* Action Button Skeleton */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <Skeleton className="h-10 w-28 rounded-md" />
          </div>
        </div>

        {/* Submitted File Skeleton */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-6">
          <Skeleton className="h-6 w-36 mb-4" />
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-gray-300 mr-4" />
              <div>
                <Skeleton className="h-5 w-48 mb-1" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="flex space-x-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        </div>

        {/* Feedback Skeleton */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <Skeleton className="h-6 w-44 mb-4" />
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-4/5 mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Empty State Skeleton (for when no submissions exist)
export function SubmissionsEmptyStateSkeleton() {
  return (
    <div className="h-full px-6 pt-6 pb-10 bg-gray-50 overflow-y-auto">
      {/* Header Skeleton */}
      <div className="mb-8">
        <Skeleton className="h-9 w-64 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Filters Skeleton */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <Skeleton className="h-10 w-48" />
      </div>

      {/* Empty State Skeleton */}
      <div className="text-center py-12">
        <Skeleton className="w-16 h-16 mx-auto mb-4 rounded" />
        <Skeleton className="h-6 w-48 mx-auto mb-2" />
        <Skeleton className="h-4 w-64 mx-auto" />
      </div>
    </div>
  );
}

// Loading Grid Skeleton (alternative to individual cards)
export function SubmissionsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(count)].map((_, i) => (
        <SubmissionCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Compact Card Skeleton for smaller layouts
export function CompactSubmissionCardSkeleton() {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      
      <Skeleton className="h-3 w-1/2 mb-2" />
      
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

// File Upload Item Skeleton
export function FileUploadItemSkeleton() {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center">
        <FileText className="w-5 h-5 text-gray-300 mr-3" />
        <div>
          <Skeleton className="h-4 w-40 mb-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-5 w-5 rounded" />
    </div>
  );
}