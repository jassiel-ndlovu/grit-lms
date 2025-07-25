"use client";

import { useRouter } from "next/navigation";
import { FileText, ImageIcon, Layers, Pencil, Users } from "lucide-react";
import Image from "next/image";

export default function TutorCourseCard({ c }: { c: Course }) {
  const router = useRouter();

  return (
    <div
      className="group bg-white border border-gray-200 rounded overflow-hidden hover:shadow-lg transition-all duration-300"
    >
      {/* Image */}
      <div className="relative h-40 w-full">
        {c.imageUrl ? (
          <Image
            src={`/images/${c.imageUrl}`}
            alt="Course Banner"
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
            <ImageIcon className="w-10 h-10 text-gray-400" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          {c.name}
        </h2>
        <p className="text-sm text-gray-600 line-clamp-3">{c.description}</p>

        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Users className="w-4 h-4 text-emerald-500" />
          {c.students.length || 0} student{c.students.length !== 1 && "s"} enrolled
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-3">
          {/* Create Assessments */}
          <button
            onClick={() => router.push(`/dashboard/tutor-tests/${c.id}`)}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 hover:opacity-90 transition text-xs font-medium"
          >
            <FileText className="w-4 h-4" />
            Create Assessments
          </button>

          {/* Edit Course */}
          <button
            onClick={() => router.push(`/dashboard/manage-courses/${c.id}`)}
            className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 text-blue-700 hover:opacity-90 transition text-xs font-medium"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}
