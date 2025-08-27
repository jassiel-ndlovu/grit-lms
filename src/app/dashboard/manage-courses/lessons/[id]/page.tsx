/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { useState, use, useEffect } from "react";
import { ChevronLeft, ChevronRight, Video, AlertTriangle, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { useCourses } from "@/context/CourseContext";
import ManageLessonsSkeleton from "../../skeletons/manage-lesson-skeleton";
import CourseContentNotFound from "../../models/content-not-found";
import NoLessonsFound from "../../models/no-lessons-found";
import EditLessonView from "../../models/edit-lesson-view";
import ViewLessonContent from "../../models/view-lesson-content";
import { useLesson } from "@/context/LessonContext";
import CreateLessonDialog from "../../models/create-lesson-dialog";

interface CoursePageProps {
  params: Promise<{ id: string }>;
}

export default function ManageLessons({ params }: CoursePageProps) {
  const { id } = use(params);
  const { loading: courseLoading, fetchCoursesByIds } = useCourses();
  const { lessons: backendLessons, loading: lessonsLoading, fetchLessonsByCourseId, updateLesson, deleteLesson, createLesson } = useLesson();

  const [selectedLessonIndex, setSelectedLessonIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [course, setCourse] = useState<AppTypes.Course | null>(null);
  const [lessons, setLessons] = useState<Partial<AppTypes.Lesson>[] | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Partial<AppTypes.Lesson> | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    lessonId: string;
    lessonTitle: string;
    index: number;
  } | null>(null);

  // Fetch course
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const courseData = await fetchCoursesByIds([id]) as AppTypes.Course[];

      setLoading(false);
      setCourse(courseData[0]);
    };

    fetch();
  }, [id, fetchCoursesByIds]);

  // Fetch lessons
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const fetchedLessons = await fetchLessonsByCourseId(id);
      setLessons(fetchedLessons);
      setCurrentLesson(fetchedLessons[selectedLessonIndex] || null);
      setLoading(false);
    }

    fetch();
  }, [id, fetchLessonsByCourseId]);

  const handleDeleteLesson = (lesson: Partial<AppTypes.Lesson>, index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the lesson
    setDeleteConfirmation({
      lessonId: lesson.id as string,
      lessonTitle: lesson.title || `Lesson ${index + 1} (Untitled)`,
      index
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;

    try {
      await deleteLesson(deleteConfirmation.lessonId);

      // If the deleted lesson was selected, adjust selection
      if (deleteConfirmation.index === selectedLessonIndex) {
        setSelectedLessonIndex(Math.max(0, deleteConfirmation.index - 1));
      } else if (deleteConfirmation.index < selectedLessonIndex) {
        setSelectedLessonIndex(selectedLessonIndex - 1);
      }

      setDeleteConfirmation(null);
      setLessons(backendLessons);
    } catch (error) {
      console.error('Error deleting lesson:', error);
    }
  };

  const handleCreateLesson = async (newLesson: Partial<AppTypes.Lesson>) => {
    if (!course) return;

    try {
      // Update local lessons state
      setLessons(prev => prev ? [...prev, newLesson] : [newLesson]);

      // Update the course in the context with the new lesson
      const createdLesson = await createLesson(course.id, newLesson);

      if (!createdLesson) {
        setServerError("Could not create lesson. Please try again.");
        return;
      }

      // Set the newly created lesson as selected
      setSelectedLessonIndex((lessons?.length || 0));

      setShowCreateDialog(false);
    } catch (error) {
      console.error('Error updating course with new lesson:', error);
    }
  };

  const handleUpdate = (key: keyof AppTypes.Lesson, value: any) => {
    setCurrentLesson(prev => {
      if (!prev) return null;
      return {
        ...prev,
        [key]: value
      };
    });
  };

  const handleUpdateSave = async (updatedAttachmentUrls?: AppTypes.Attachment[]) => {
    // Use the passed value if available, otherwise fall back to currentLesson
    const attachmentUrlsToSave = currentLesson?.attachmentUrls ? ([
      ...currentLesson.attachmentUrls, 
      ...(updatedAttachmentUrls ?? [])
    ]): updatedAttachmentUrls;

    if (!currentLesson || !currentLesson.id) {
      alert("No lesson selected or missing ID");
      return;
    }

    try {
      await updateLesson(currentLesson.id, {
        title: currentLesson.title,
        description: currentLesson.description,
        videoUrl: currentLesson.videoUrl,
        attachmentUrls: attachmentUrlsToSave, // Use the updated value
      });

      alert("Lesson updated successfully ✅");
      setEditMode(false);
    } catch (error) {
      console.error("Failed to save lesson:", error);
      alert("Failed to save lesson");
    }
  };

  // Set lesson to be edited when edit mode starts
  useEffect(() => {
    if (editMode && lessons && lessons[selectedLessonIndex]) {
      setCurrentLesson(lessons[selectedLessonIndex]);
    }
  }, [editMode, lessons, selectedLessonIndex]);

  useEffect(() => {
    if (lessons && lessons[selectedLessonIndex]) {
      setCurrentLesson(lessons[selectedLessonIndex]);
    }
  }, [lessons, selectedLessonIndex]);

  // Loading state
  if (loading || courseLoading || lessonsLoading || course === undefined) {
    return <ManageLessonsSkeleton />;
  }

  // Course not found
  if (!course) {
    return <CourseContentNotFound />;
  }

  // No lessons available
  if (!lessons || lessons.length === 0) {
    return <NoLessonsFound courseId={id} courseName={course.name} />;
  }

  // Invalid lesson index
  if (selectedLessonIndex >= lessons.length || selectedLessonIndex < 0) {
    return <InvalidLessonIndex
      courseName={course.name}
      totalLessons={lessons.length}
      onReset={() => setSelectedLessonIndex(0)}
    />;
  }

  // Current lesson is somehow null/undefined
  if (!currentLesson) {
    return <LessonNotFound
      courseName={course.name}
      lessonIndex={selectedLessonIndex}
      onReset={() => setSelectedLessonIndex(0)}
    />;
  }

  const updateCurrentLesson = (key: keyof AppTypes.Lesson, value: any) => {
    if (!lessons) return;

    setLessons(prev =>
      prev ? prev.map((lesson, i) =>
        i === selectedLessonIndex ? { ...lesson, [key]: value } : lesson
      ) : []
    );
  };

  const moveLesson = (fromIndex: number, toIndex: number) => {
    setLessons((prev) => {
      if (!prev) return [];

      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);

      // Update `order` property so it matches the array index
      return updated.map((lesson, index) => ({
        ...lesson,
        order: index + 1, // start from 1 for readability
      }));
    });

    handleUpdateSave();
  };

  const addVideoUrl = () => {
    updateCurrentLesson("videoUrl", [
      ...(currentLesson.videoUrl || []),
      ""
    ]);
  };

  const addAttachmentUrl = () => {
    updateCurrentLesson("attachmentUrls", [
      ...(currentLesson.attachmentUrls || []),
      { title: "", url: "" }
    ]);
  };

  const removeVideoUrl = (index: number) => {
    const updated = [...(currentLesson.videoUrl || [])];
    updated.splice(index, 1);
    updateCurrentLesson("videoUrl", updated);
  };

  const removeResourceLink = (index: number) => {
    const updated = [...(currentLesson.attachmentUrls || [])];
    updated.splice(index, 1);
    updateCurrentLesson("attachmentUrls", updated);
  };

  return (
    <div
      className={clsx(
        "h-full max-h-[92-vh] grid bg-gray-100",
        sidebarOpen ? "grid-cols-[250px_1fr]" : "grid-cols-[1px_1fr]"
      )}
    >
      {/* Sidebar */}
      <div className="relative h-full bg-gray-900 text-white">
        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="absolute top-3.5 -right-6 z-50 p-1 bg-blue-500 hover:bg-blue-400"
        >
          {sidebarOpen ?
            <ChevronLeft
              className="text-white w-4 h-4"
            /> :
            <ChevronRight
              className="text-white w-4 h-4"
            />}
        </button>

        {/* Aside */}
        {sidebarOpen && (
          <aside className="h-full p-4">
            <div className="mb-4">
              <h2 className="text-lg font-bold">Lessons</h2>
              <p className="text-xs text-gray-400">{lessons.length} total</p>
            </div>

            <ul className="space-y-2 mb-4">
              {lessons.map((lesson, i) => (
                <li
                  key={lesson?.id || i}
                  title={lesson?.title || `Lesson ${i + 1} (Untitled)`}
                  onClick={() => setSelectedLessonIndex(i)}
                  className={clsx(
                    "cursor-pointer flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-500 transition group",
                    {
                      "bg-blue-600 text-white": i === selectedLessonIndex,
                      "bg-gray-800": i !== selectedLessonIndex,
                    }
                  )}
                >
                  <Video className="shrink-0 w-4 h-4" />
                  <span className="flex-1 text-sm truncate">
                    {lesson?.title || `Lesson ${i + 1} (Untitled)`}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLesson(i, i - 1);
                    }}
                    disabled={i === 0}
                    className="text-sm opacity-0 group-hover:opacity-100 px-1.5  hover:shadow-sm hover:bg-blue-500/80 rounded transition-all"
                  >
                    ↑
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLesson(i, i + 1);
                    }}
                    className="text-sm opacity-0 group-hover:opacity-100 px-1.5 hover:shadow-sm hover:bg-blue-500/80 rounded transition-all"
                    disabled={i === lessons.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    onClick={(e) => handleDeleteLesson(lesson, i, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500 rounded transition-all"
                    aria-label={`Delete ${lesson?.title || `Lesson ${i + 1}`}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>

            {/* Create Lesson Button */}
            <button
              onClick={() => setShowCreateDialog(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-500 rounded transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add New Lesson</span>
            </button>

            {/* Delete Confirmation Dialog */}
            {deleteConfirmation && (
              <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
                <div className="bg-white shadow-xl max-w-md w-full p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Delete Lesson
                  </h3>
                  <p className="text-gray-600 text-sm mb-6">
                    Are you sure you want to delete &quot;{deleteConfirmation.lessonTitle}&quot;?
                    This action cannot be undone.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setDeleteConfirmation(null)}
                      className="px-4 py-2 text-gray-700 text-sm border border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmDelete}
                      className="px-4 py-2 text-sm bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Create Lesson Dialog */}
            {showCreateDialog && (
              <CreateLessonDialog
                courseId={course.id}
                courseName={course.name}
                onClose={() => setShowCreateDialog(false)}
                onSave={handleCreateLesson}
                loading={false}
                serverError={serverError}
              />
            )}
          </aside>
        )}
      </div>

      {/* Main Content */}
      <main className="h-full max-h-[92vh] p-8 space-y-6 overflow-y-auto">
        <div>
          <h1 className="text-3xl font-bold text-blue-500">
            {course.name}
          </h1>
          <p className="text-sm text-gray-500">
            Tutor: {course.tutor?.fullName || 'Unknown'}
          </p>
          <p className="text-xs text-gray-400">
            Lesson {selectedLessonIndex + 1} of {lessons.length}
          </p>
        </div>

        <section className="bg-white p-6 space-y-6 border border-gray-200">
          {editMode ? (
            <EditLessonView
              lesson={currentLesson}
              onUpdate={handleUpdate}
              onSave={handleUpdateSave}
              onCancel={() => setEditMode(false)}
              onAddVideo={addVideoUrl}
              onRemoveVideo={removeVideoUrl}
              onAddResource={addAttachmentUrl}
              onRemoveResource={removeResourceLink}
            />
          ) : (
            <ViewLessonContent
              lesson={currentLesson}
              onEdit={() => setEditMode(true)}
            />
          )}
        </section>
      </main>
    </div>
  );
}

// Component for invalid lesson index
function InvalidLessonIndex({
  courseName,
  totalLessons,
  onReset
}: {
  courseName: string;
  totalLessons: number;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Invalid Lesson</h2>
          <p className="text-gray-600">
            The requested lesson doesn&apos;t exist in &quot;{courseName}&quot;.
            This course has {totalLessons} lesson{totalLessons !== 1 ? 's' : ''}.
          </p>
        </div>
        <button
          onClick={onReset}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Go to First Lesson
        </button>
      </div>
    </div>
  );
}

// Component for when current lesson is null
function LessonNotFound({
  courseName,
  lessonIndex,
  onReset
}: {
  courseName: string;
  lessonIndex: number;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 text-yellow-600 mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">Lesson Data Missing</h2>
          <p className="text-gray-600">
            Lesson {lessonIndex + 1} in &quot;{courseName}&quot; appears to be corrupted or missing data.
          </p>
        </div>
        <button
          onClick={onReset}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Return to First Lesson
        </button>
      </div>
    </div>
  );
}