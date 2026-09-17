"use client";

/**
 * Chrome for the legacy assignment overview at
 * /dashboard/submissions/overview/[id].
 *
 * This lives inside the `(overview)` route group on purpose. It used to sit
 * one level up, at `overview/[id]/layout.tsx`, where it also wrapped the
 * per-student grading page — giving that page a second, stale "Back to
 * overview" button on top of its own. Scoping it to the group means the
 * grading page now renders with the standard dashboard chrome like every
 * other rebuilt page.
 */

import { ArrowLeft, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";

export default function SubmissionOverviewLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard/submissions")}
              className="inline-flex items-center gap-1 rounded p-1 text-sm text-gray-600 hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back to assignments</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="text-blue-600 bg-blue-100 rounded p-2" size={40} />
              Submissions
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">{children}</div>
    </div>
  );
}
