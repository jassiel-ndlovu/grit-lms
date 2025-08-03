import React, { useState } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import CreateLessonDialog from './create-lesson-dialog';
import { useLesson } from '@/context/LessonContext';

interface NoLessonsFoundProps {
  courseId: string;
  courseName: string;
  onLessonCreated?: (lesson: Lesson) => void;
}

export default function NoLessonsFound({ courseId, courseName, onLessonCreated }: NoLessonsFoundProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { createLesson } = useLesson();

  const handleCreateLesson = async (lessonData: Partial<Lesson>) => {
    setCreating(true);
    setServerError(null);

    try {
      const newLesson = await createLesson(courseId, lessonData);

      if (!newLesson) {
        setServerError("Could not create lesson. Please try again.");
        return;
      }

      if (onLessonCreated) {
        onLessonCreated(newLesson);
      }

      // setShowCreateDialog(false);
    } catch (error) {
      console.error('Error creating lesson:', error);
      setServerError("Something went wrong while creating the lesson.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center px-4 py-24">
        <div className="text-center space-y-6 max-w-md">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 text-blue-600 mx-auto">
            <BookOpen className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No Lessons Found</h2>
            <p className="text-gray-600 text-sm">
              The course &quot;{courseName}&quot; doesn't have any lessons yet. Create your first lesson to get started.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => setShowCreateDialog(true)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white text-sm px-6 py-3 hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              Create First Lesson
            </button>
            <button
              onClick={() => window.history.back()}
              className="w-full text-gray-600 text-sm px-6 py-2 border border-gray-300 hover:bg-gray-100 transition"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>

      {/* Create Lesson Dialog */}
      {showCreateDialog && (
        <CreateLessonDialog
          courseId={courseId}
          courseName={courseName}
          onClose={() => {
            setShowCreateDialog(false);
            setServerError(null);
          }}
          onSave={handleCreateLesson}
          loading={creating}
          serverError={serverError}
        />
      )}
    </>
  );
}