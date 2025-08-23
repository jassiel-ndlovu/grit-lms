import React from "react";
import Skeleton from "../../components/skeleton";

export default function SubmissionDetailsSkeleton() {
  return (
    <div className="h-full px-6 pt-6 pb-10 bg-gray-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          {/* Back button */}
          <div className="mb-4 flex items-center">
            <Skeleton className="w-5 h-5 mr-2" />
            <Skeleton className="w-32 h-5" />
          </div>
          
          {/* Title */}
          <Skeleton className="w-3/4 h-8 mb-2" />
          
          {/* Course ID */}
          <Skeleton className="w-48 h-4" />
        </div>

        {/* Submission Info */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-6">
          <Skeleton className="w-48 h-6 mb-4" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Due Date */}
            <div>
              <Skeleton className="w-20 h-4 mb-1" />
              <Skeleton className="w-32 h-4" />
            </div>
            
            {/* Submitted */}
            <div>
              <Skeleton className="w-24 h-4 mb-1" />
              <Skeleton className="w-36 h-4" />
            </div>
            
            {/* Status */}
            <div>
              <Skeleton className="w-16 h-4 mb-1" />
              <Skeleton className="w-24 h-6 rounded-full" />
            </div>
            
            {/* Grade */}
            <div>
              <Skeleton className="w-16 h-4 mb-1" />
              <Skeleton className="w-16 h-8" />
            </div>
          </div>

          {/* Edit button area */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <Skeleton className="w-32 h-10 rounded-md" />
          </div>
        </div>

        {/* Submitted File */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-6">
          <Skeleton className="w-36 h-6 mb-4" />
          
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              {/* File icon */}
              <Skeleton className="w-8 h-8 mr-4" />
              
              <div>
                {/* File name */}
                <Skeleton className="w-48 h-5 mb-1" />
                {/* Submitted date */}
                <Skeleton className="w-40 h-4" />
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex space-x-2">
              <Skeleton className="w-9 h-9 rounded" />
              <Skeleton className="w-9 h-9 rounded" />
            </div>
          </div>
        </div>

        {/* Feedback section */}
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <Skeleton className="w-44 h-6 mb-4" />
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            {/* Feedback text lines */}
            <Skeleton className="w-full h-4 mb-2" />
            <Skeleton className="w-5/6 h-4 mb-2" />
            <Skeleton className="w-3/4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}