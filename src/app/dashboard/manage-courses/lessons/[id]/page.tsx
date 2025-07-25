"use client";

import { useState, use, useEffect } from "react";
import { ChevronLeft, ChevronRight, FileText, Save, Video, AlertTriangle, BookOpen, Plus } from "lucide-react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import { useCourses } from "@/context/CourseContext";
import ManageLessonsSkeleton from "../../manage-lesson-skeleton";
import CourseContentNotFound from "../../content-not-found";
import NoLessonsFound from "../models/no-lessons-found";

interface CoursePageProps {
  params: Promise<{ id: string }>;
}

export default function ManageLessons({ params }: CoursePageProps) {
  const { id } = use(params);
  const { updateLoading: courseUpdateLoading, loading: courseLoading, message, courses, updateCourse } = useCourses();

  const [selectedLessonIndex, setSelectedLessonIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);

  useEffect(() => {
    if (!courseLoading && courses.length > 0 && id && typeof id === 'string') {
      const found = courses.find(c => c.id === id);
      setCourse(found || null);
      setLessons(found?.lessons || []);
      setLoading(false);
      setSelectedLessonIndex(0);
    } else if (!courseLoading && courses.length === 0) {
      setLoading(false);
    }
  }, [id, courses, courseLoading]);

  const handleLessonCreated = async (newLesson: Lesson) => {
    if (!course) return;

    try {
      // Update local lessons state
      setLessons(prev => prev ? [...prev, newLesson] : [newLesson]);
      
      // Update the course in the context with the new lesson
      const updatedCourse = {
        ...course,
        lessons: [...(course.lessons || []), newLesson]
      };
      
      // This would typically be an API call to save the lesson to the course
      await updateCourse(course.id, { lessons: updatedCourse.lessons });
      
      // Update local course state
      setCourse(updatedCourse);
      
      // Set the newly created lesson as selected
      setSelectedLessonIndex((lessons?.length || 0));
      
    } catch (error) {
      console.error('Error updating course with new lesson:', error);
      // Optionally revert the local state if the API call fails
    }
  };

  // Loading state
  if (loading || courseLoading || courses.length === 0 || course === undefined) {
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

  const currentLesson = lessons[selectedLessonIndex];

  // Current lesson is somehow null/undefined
  if (!currentLesson) {
    return <LessonNotFound
      courseName={course.name}
      lessonIndex={selectedLessonIndex}
      onReset={() => setSelectedLessonIndex(0)}
    />;
  }

  const updateCurrentLesson = (key: keyof Lesson, value: any) => {
    if (!lessons) return;

    setLessons(prev =>
      prev ? prev.map((lesson, i) =>
        i === selectedLessonIndex ? { ...lesson, [key]: value } : lesson
      ) : []
    );
  };

  const addVideoUrl = () => {
    updateCurrentLesson("videoUrl", [
      ...(currentLesson.videoUrl || []),
      ""
    ]);
  };

  const addResourceLink = () => {
    updateCurrentLesson("resourceLinks", [
      ...(currentLesson.resourceLinks || []),
      { title: "", url: "" }
    ]);
  };

  const removeVideoUrl = (index: number) => {
    const updated = [...(currentLesson.videoUrl || [])];
    updated.splice(index, 1);
    updateCurrentLesson("videoUrl", updated);
  };

  const removeResourceLink = (index: number) => {
    const updated = [...(currentLesson.resourceLinks || [])];
    updated.splice(index, 1);
    updateCurrentLesson("resourceLinks", updated);
  };

  return (
    <div
      className={clsx(
        "h-full grid bg-gray-100",
        sidebarOpen ? "grid-cols-[250px_1fr]" : "grid-cols-[1px_1fr]"
      )}
    >
      {/* Sidebar */}
      <div className="relative h-full bg-gray-900 text-white">
        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="absolute top-3.5 -right-6 z-50 p-1 bg-blue-500 hover:bg-blue-400 rounded"
        >
          {sidebarOpen ? <ChevronLeft className="text-white w-4 h-4" /> : <ChevronRight className="text-white w-4 h-4" />}
        </button>

        {sidebarOpen && (
          <aside className="h-full p-4 overflow-y-auto">
            <div className="mb-4">
              <h2 className="text-lg font-bold">Lessons</h2>
              <p className="text-xs text-gray-400">{lessons.length} total</p>
            </div>
            <ul className="space-y-2">
              {lessons.map((lesson, i) => (
                <li
                  key={lesson?.id || i}
                  onClick={() => setSelectedLessonIndex(i)}
                  className={clsx(
                    "cursor-pointer flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-500 transition",
                    {
                      "bg-blue-600 text-white": i === selectedLessonIndex,
                      "bg-gray-800": i !== selectedLessonIndex,
                    }
                  )}
                >
                  <Video className="shrink-0 w-4 h-4" />
                  <span className="w-full text-sm truncate">
                    {lesson?.title || `Lesson ${i + 1} (Untitled)`}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      {/* Main Content */}
      <main className="p-8 space-y-6 overflow-y-auto">
        <div>
          <h1 className="text-3xl font-bold text-blue-500">{course.name}</h1>
          <p className="text-sm text-gray-500">
            Tutor: {course.tutor?.fullName || 'Unknown'}
          </p>
          <p className="text-xs text-gray-400">
            Lesson {selectedLessonIndex + 1} of {lessons.length}
          </p>
        </div>

        <section className="bg-white p-6 space-y-6 border rounded">
          {editMode ? (
            <EditLessonView
              lesson={currentLesson}
              onUpdate={updateCurrentLesson}
              onSave={() => {
                console.log("Would save updated lesson:", currentLesson);
                // Here you would call your API to save
                setEditMode(false);
              }}
              onCancel={() => setEditMode(false)}
              onAddVideo={addVideoUrl}
              onRemoveVideo={removeVideoUrl}
              onAddResource={addResourceLink}
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

// Component for when no lessons exist
// function NoLessonsFound({ courseId, courseName }: { courseId: string; courseName: string }) {
//   return (
//     <div className="flex flex-col items-center justify-center h-full px-4 py-10">
//       <div className="text-center space-y-6 max-w-md">
//         <div className="flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 text-blue-600 mx-auto">
//           <BookOpen className="w-10 h-10" />
//         </div>
//         <div>
//           <h2 className="text-xl font-semibold text-gray-800 mb-2">No Lessons Found</h2>
//           <p className="text-gray-600 text-sm">
//             The course "{courseName}" doesn't have any lessons yet.
//           </p>
//         </div>
//         <div className="space-y-3">
//           <button className="w-full flex items-center justify-center gap-2 bg-blue-600 text-sm text-white px-6 py-3 hover:bg-blue-700 transition">
//             <Plus className="w-5 h-5" />
//             Create First Lesson
//           </button>
//           <button
//             onClick={() => window.history.back()}
//             className="w-full text-gray-600 text-sm px-6 py-2 border border-gray-300 hover:bg-gray-100 transition"
//           >
//             Go Back
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

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
            The requested lesson doesn't exist in "{courseName}".
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
            Lesson {lessonIndex + 1} in "{courseName}" appears to be corrupted or missing data.
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

// Edit mode component
function EditLessonView({
  lesson,
  onUpdate,
  onSave,
  onCancel,
  onAddVideo,
  onRemoveVideo,
  onAddResource,
  onRemoveResource
}: {
  lesson: Lesson;
  onUpdate: (key: keyof Lesson, value: any) => void;
  onSave: () => void;
  onCancel: () => void;
  onAddVideo: () => void;
  onRemoveVideo: (index: number) => void;
  onAddResource: () => void;
  onRemoveResource: (index: number) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Edit Lesson</h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          Cancel
        </button>
      </div>

      <input
        type="text"
        value={lesson.title || ''}
        onChange={(e) => onUpdate("title", e.target.value)}
        placeholder="Lesson title..."
        className="text-xl font-semibold border-b border-gray-300 w-full focus:outline-none focus:border-blue-500 pb-2"
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
        <textarea
          value={lesson.description || ''}
          onChange={(e) => onUpdate("description", e.target.value)}
          rows={6}
          placeholder="Write your lesson description in Markdown..."
          className="w-full border border-gray-300 rounded p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Video URLs</h3>
          <button
            onClick={onAddVideo}
            className="text-blue-600 text-sm hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Video
          </button>
        </div>
        {lesson.videoUrl && lesson.videoUrl.length > 0 ? (
          lesson.videoUrl.map((video, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="url"
                value={video || ''}
                onChange={(e) => {
                  const updated = [...(lesson.videoUrl || [])];
                  updated[idx] = e.target.value;
                  onUpdate("videoUrl", updated);
                }}
                placeholder="https://example.com/video.mp4"
                className="flex-1 border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => onRemoveVideo(idx)}
                className="text-red-500 hover:text-red-700 p-2"
              >
                ×
              </button>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-sm italic">No videos added yet</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Resource Links</h3>
          <button
            onClick={onAddResource}
            className="text-blue-600 text-sm hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Resource
          </button>
        </div>
        {lesson.resourceLinks && lesson.resourceLinks.length > 0 ? (
          lesson.resourceLinks.map((resource, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={resource?.title || ''}
                onChange={(e) => {
                  const updated = [...(lesson.resourceLinks || [])];
                  updated[idx] = { ...updated[idx], title: e.target.value };
                  onUpdate("resourceLinks", updated);
                }}
                placeholder="Resource title"
                className="w-1/3 border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="url"
                value={resource?.url || ''}
                onChange={(e) => {
                  const updated = [...(lesson.resourceLinks || [])];
                  updated[idx] = { ...updated[idx], url: e.target.value };
                  onUpdate("resourceLinks", updated);
                }}
                placeholder="https://example.com"
                className="w-2/3 border border-gray-300 px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => onRemoveResource(idx)}
                className="text-red-500 hover:text-red-700 p-2"
              >
                ×
              </button>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-sm italic">No resources added yet</p>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <button
          onClick={onSave}
          className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </>
  );
}

// View mode component
function ViewLessonContent({ lesson, onEdit }: { lesson: Lesson; onEdit: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{lesson.title || 'Untitled Lesson'}</h2>
        <button
          onClick={onEdit}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition text-sm"
        >
          Edit Lesson
        </button>
      </div>

      {lesson.description ? (
        <div className="prose max-w-none text-gray-700">
          <ReactMarkdown>{lesson.description}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-gray-500 italic">No description provided</p>
      )}

      {lesson.videoUrl && lesson.videoUrl.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Videos</h3>
          {lesson.videoUrl.map((video, idx) =>
            video ? (
              <video key={idx} controls className="w-full max-w-3xl rounded border">
                <source src={video} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            ) : null
          )}
        </div>
      ) : (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Video className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">No videos available for this lesson</p>
        </div>
      )}

      {lesson.resourceLinks && lesson.resourceLinks.length > 0 ? (
        <div>
          <h3 className="text-lg font-semibold mb-3">Resources</h3>
          <ul className="space-y-2">
            {lesson.resourceLinks.map((resource, idx) =>
              resource?.url ? (
                <li key={idx} className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-gray-600 shrink-0" />
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    {resource.title || resource.url}
                  </a>
                </li>
              ) : null
            )}
          </ul>
        </div>
      ) : (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 text-center">
          <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No additional resources for this lesson</p>
        </div>
      )}
    </>
  );
}