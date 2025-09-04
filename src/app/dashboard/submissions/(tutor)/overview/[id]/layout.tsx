"use client";

import { ArrowLeft, FileText } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { ReactNode, useMemo, useState } from "react";

export default function TestLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { id, studentId } = useParams();

  const [goBackUrl, setGoBackUrl] = useState<string>("/dashboard/submissions");

  useMemo(() => {
    if (!id) return;
    if (!studentId) {
      setGoBackUrl("/dashboard/submissions");
    } else if (id && studentId) {
      setGoBackUrl(`/dashboard/submissions/overview/${id}`);
    }
  }, [id, studentId]);

  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push(goBackUrl)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="text-blue-600 bg-blue-100 rounded p-2" size={40} />
              Submissions
            </h1>
          </div>
        </div>
      </div>

      {/* Page content (page.tsx or nested [studentId]/page.tsx) */}
      <div className="max-w-6xl mx-auto p-6">{children}</div>
    </div>
  );
}
