import React from "react";
import { MoveLeft, Calendar, Upload, Plus, FileText } from "lucide-react";
import Skeleton from "../../components/skeleton";

export default function SubmissionUploadSkeleton() {
  return (
    <div className="h-full px-6 pt-6 pb-10 bg-gray-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="mb-4 flex items-center">
            <MoveLeft className="w-5 h-5 mr-2 text-gray-300" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-8 w-96 mb-2" />
          <Skeleton className="h-5 w-48 mb-2" />
          <div className="flex items-center mt-2">
            <Calendar className="w-4 h-4 mr-2 text-gray-300" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Upload Area Skeleton */}
        <div className="bg-white p-8 border border-gray-200 mb-6">
          <Skeleton className="h-6 w-48 mb-6" />

          <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <Skeleton className="h-6 w-64 mb-2 mx-auto" />
            <Skeleton className="h-4 w-48 mb-4 mx-auto" />
            <div className="inline-flex items-center px-4 py-2 bg-gray-200 rounded">
              <Plus className="w-4 h-4 mr-2 text-gray-400" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>

          {/* Uploaded Files List Skeleton */}
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
                  <Skeleton className="h-4 w-4 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Submit Button Skeleton */}
          <div className="mt-8 flex justify-end">
            <div className="flex items-center px-6 py-2 bg-gray-200 rounded">
              <Upload className="w-4 h-4 mr-2 text-gray-400" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Skeleton for when files are being uploaded
export function SubmissionUploadLoadingSkeleton() {
  return (
    <div className="h-full px-6 pt-6 pb-10 bg-gray-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="mb-4 flex items-center">
            <MoveLeft className="w-5 h-5 mr-2 text-gray-300" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-8 w-96 mb-2" />
          <Skeleton className="h-5 w-48 mb-2" />
          <div className="flex items-center mt-2">
            <Calendar className="w-4 h-4 mr-2 text-gray-300" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Upload Area with Loading State */}
        <div className="bg-white p-8 border border-gray-200 mb-6">
          <Skeleton className="h-6 w-48 mb-6" />

          <div className="border border-dashed border-blue-400 bg-blue-50 rounded-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <Skeleton className="h-6 w-48 mb-2 mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto" />
          </div>

          {/* Processing Files List */}
          <div className="mt-6">
            <Skeleton className="h-5 w-32 mb-3" />
            <div className="space-y-2">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center">
                    <FileText className="w-5 h-5 text-blue-400 mr-3" />
                    <div>
                      <Skeleton className="h-4 w-40 mb-1" />
                      <div className="flex items-center">
                        <div className="w-24 bg-gray-200 rounded-full h-1 mr-2">
                          <div className="bg-blue-600 h-1 rounded-full animate-pulse" style={{ width: `${(index + 1) * 30}%` }}></div>
                        </div>
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </div>
                  </div>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit Button Loading State */}
          <div className="mt-8 flex justify-end">
            <div className="flex items-center px-6 py-2 bg-gray-300 rounded cursor-not-allowed">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              <span className="text-gray-600">Submitting...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact skeleton for smaller screens
export function CompactSubmissionUploadSkeleton() {
  return (
    <div className="h-full px-4 pt-4 pb-8 bg-gray-50 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        {/* Compact Header Skeleton */}
        <div className="mb-6">
          <div className="mb-3 flex items-center">
            <MoveLeft className="w-4 h-4 mr-2 text-gray-300" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-4 w-3/4 mb-2" />
          <div className="flex items-center mt-2">
            <Calendar className="w-3 h-3 mr-2 text-gray-300" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* Compact Upload Area */}
        <div className="bg-white p-4 border border-gray-200 mb-4">
          <Skeleton className="h-5 w-40 mb-4" />

          <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <Skeleton className="h-5 w-48 mb-2 mx-auto" />
            <Skeleton className="h-3 w-32 mb-3 mx-auto" />
            <div className="inline-flex items-center px-3 py-1 bg-gray-200 rounded text-sm">
              <Plus className="w-3 h-3 mr-1 text-gray-400" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>

          {/* Compact Files List */}
          <div className="mt-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <div className="space-y-1">
              {[...Array(2)].map((_, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 text-gray-300 mr-2" />
                    <div>
                      <Skeleton className="h-3 w-32 mb-1" />
                      <Skeleton className="h-2 w-12" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-3 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Compact Submit Button */}
          <div className="mt-4 flex justify-end">
            <div className="flex items-center px-4 py-1 bg-gray-200 rounded text-sm">
              <Upload className="w-3 h-3 mr-1 text-gray-400" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}