"use client";

import { notFound } from "next/navigation";
import { use, useState } from "react";
import ReactMarkdown from "react-markdown";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, FileText, Send, Calendar, Video, CheckCircle, Circle } from "lucide-react";
import { useCourses } from "@/context/CourseContext";

interface CoursePageProps {
  params: Promise<{ id: string }>;
}

export default function CoursePage({ params }: CoursePageProps) {
  const { courses } = useCourses();

  const [selectedLessonIndex, setSelectedLessonIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);

  const { id } = use(params);
  const course = courses.find((c) => c.id === id);
  if (!course) return notFound();

  const currentLesson = course.lessons[selectedLessonIndex];

  const handleComplete = (lessonId: string) => {
    setCompletedLessons((prev) =>
      prev.includes(lessonId)
        ? prev.filter((id) => id !== lessonId) // Unmark
        : [...prev, lessonId] // Mark
    );
  };

  const isCompleted = completedLessons.includes(currentLesson.id);

  return (
    <div
      className={clsx(
        "h-full grid bg-gray-100",
        sidebarOpen && showRightSidebar && "grid-cols-[250px_1fr_250px]",
        !sidebarOpen && showRightSidebar && "grid-cols-[1px_1fr_250px]",
        sidebarOpen && !showRightSidebar && "grid-cols-[250px_1fr_1px]",
        !sidebarOpen && !showRightSidebar && "grid-cols-[1px_1fr_1px]"
      )}
    >
      {/* Sidebar */}
      <div className="relative h-full bg-gray-900 text-white">
        {/* Toggle Button */}
        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="absolute top-3.5 -right-6 z-50 p-1 bg-blue-500 hover:bg-blue-400"
        >
          {sidebarOpen ? (
            <ChevronLeft className="text-white w-4 h-4" />
          ) : (
            <ChevronRight className="text-white w-4 h-4" />
          )}
        </button>

        {sidebarOpen && (
          <aside className="h-full p-4 overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Lessons</h2>
            <ul className="space-y-2">
              {course.lessons.map((lesson, i) => (
                <li
                  key={lesson.id}
                  title={lesson.title}
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
                  <span className="w-full text-sm truncate">{lesson.title}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      {/* Main Content */}
      <main className="p-8 space-y-8 overflow-y-auto">
        <div>
          <h1 className="text-3xl font-bold text-blue-500">
            {course.name}
          </h1>
          <p className="text-sm text-gray-500">
            Tutor: {course.tutor.fullName}
          </p>
        </div>

        <section className="bg-white p-6 space-y-6">
          <h2 className="text-xl font-semibold">
            {currentLesson.title}
          </h2>
          <div className="prose max-w-none text-gray-800 text-md">
            <ReactMarkdown>
              {currentLesson.description}
            </ReactMarkdown>
          </div>

          {currentLesson.videoUrl?.map((v, idx) => (
            <video
              key={idx}
              className="w-full max-w-3xl rounded border"
              controls
            >
              <source src={v} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ))}

          <div>
            <h3 className="text-md font-semibold mb-2">
              Resources
            </h3>
            <ul className="space-y-2 text-sm text-blue-600">
              {currentLesson.resourceLinks.map((r, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-600" />
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {r.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => handleComplete(currentLesson.id)}
            className={`mt-4 flex items-center gap-2 text-sm px-4 py-2 rounded transition ${isCompleted
              ? "bg-gray-300 text-gray-800 hover:bg-gray-400"
              : "bg-green-600 text-white hover:bg-green-700"
              }`}
          >
            {isCompleted ? (
              <>
                <Circle className="w-4 h-4" />
                Mark as Incomplete
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Mark as Complete
              </>
            )}
          </button>

        </section>
      </main>

      {/* Right Sidebar (optional) */}
      <div className="relative h-full">
        {/* Toggle Button */}
        <button
          onClick={() => setShowRightSidebar((prev) => !prev)}
          className="absolute top-3.5 -left-6 z-50 p-1 bg-blue-500 hover:bg-blue-400"
        >
          {showRightSidebar ? (
            <ChevronRight className="text-white w-4 h-4" />
          ) : (
            <ChevronLeft className="text-white w-4 h-4" />
          )}
        </button>

        {showRightSidebar && (
          <aside className="h-full p-4 space-y-6 bg-gray-100 border-l overflow-y-auto">
            {course.courseEvents.length > 0 && (
              <SidebarSection
                title="Teams Meetings"
                icon={<Calendar className="w-4 h-4 text-indigo-500" />}
              >
                {course.courseEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-1 bg-white border border-gray-200"
                  >
                    <p className="font-medium">{event.title}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(event.date).toUTCString()}
                    </p>
                    <a
                      href={event.link}
                      target="_blank"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Join
                    </a>
                  </div>
                ))}
              </SidebarSection>
            )}

            {(course.tests.length > 0 || course.quizzes.length > 0) && (
              <SidebarSection
                title="Assessments"
                icon={<FileText className="w-4 -4 text-blue-500" />}
              >
                {[...course.tests, ...course.quizzes].map((a) => (
                  <div key={a.id}>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-gray-500">
                      Due: {new Date(a.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </SidebarSection>
            )}

            {course.submissions.length > 0 && (
              <SidebarSection
                title="Submissions"
                icon={<Send className="w-4 h-4 text-green-500" />}
              >
                {course.submissions.map((s) => (
                  <div key={s.id}>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-xs text-gray-500">
                      Due: {new Date(s.dueDate).toLocaleString()}
                    </p>
                  </div>
                ))}
              </SidebarSection>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function SidebarSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-md font-semibold flex items-center gap-2 mb-2">
        {icon}
        {title}
      </h3>
      <div className="text-sm text-gray-700 space-y-3">{children}</div>
    </div>
  );
}