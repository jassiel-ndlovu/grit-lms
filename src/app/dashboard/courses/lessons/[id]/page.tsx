"use client";

import { use, useEffect, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, FileText, Send, Calendar, Video, CheckCircle, Circle, BookOpen, AlertTriangle, Home, ArrowLeft } from "lucide-react";
import LessonMarkdown from "@/app/components/markdown";
import { formatDate, getYouTubeId } from "@/lib/functions";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLesson } from "@/context/LessonContext";
import { useCourses } from "@/context/CourseContext";
import { useLessonCompletions } from "@/context/LessonCompletionContext";
import { useProfile } from "@/context/ProfileContext";

interface CoursePageProps {
  params: Promise<{ id: string }>;
}

export default function CourseLessonsPage({ params }: CoursePageProps) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const index = searchParams.get('index');
  const indexNumber = index ? parseInt(index, 10) : 0;

  const { fetchCoursesByIds, loading: courseLoading } = useCourses();
  const { fetchLessonsByCourseId, loading: lessonsLoading } = useLesson();
  const { loading: completionsLoading, fetchCompletionByStudentAndLesson, createCompletion, deleteCompletion } = useLessonCompletions();
  const { profile } = useProfile();
  const router = useRouter();

  const [selectedLessonIndex, setSelectedLessonIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [lessonCompletions, setLessonCompletions] = useState<AppTypes.LessonCompletion[]>([]);
  const [lessons, setLessons] = useState<AppTypes.Lesson[]>([]);
  const [course, setCourse] = useState<AppTypes.Course | null>(null);
  const [updatingCompletion, setUpdatingCompletion] = useState<string>("");

  const currentLesson: AppTypes.Lesson | null = lessons[selectedLessonIndex] || null;
  const isCompleted =
    !!currentLesson &&
    lessonCompletions.some((c) => c.lessonId === currentLesson.id);

  // Fetch course
  useEffect(() => {
    const fetch = async () => {
      const courseData = await fetchCoursesByIds([id]) as AppTypes.Course[];

      setCourse(courseData[0] ?? null);
    };

    fetch();
  }, [fetchCoursesByIds, id]);

  // Fetch lessons
  useEffect(() => {
    const fetch = async () => {
      const fetchedLessons = await fetchLessonsByCourseId(id);
      setLessons(fetchedLessons);

      if (indexNumber >= 0 && indexNumber < fetchedLessons.length) {
        setSelectedLessonIndex(indexNumber);
      } else {
        setSelectedLessonIndex(0);
      }
    }

    fetch();
  }, [id, index, indexNumber, fetchLessonsByCourseId]);

  // fetch completed lessons
  useEffect(() => {
    if (!profile?.id || lessons.length === 0) return;

    (async () => {
      const completions = await Promise.all(
        lessons.map(l =>
          fetchCompletionByStudentAndLesson(profile.id, l.id)
        )
      );

      setLessonCompletions(
        completions.filter(Boolean) as AppTypes.LessonCompletion[]
      );
    })();
  }, [profile?.id, lessons, fetchCompletionByStudentAndLesson]);

  // toggle completion
  const handleComplete = async (lessonId: string) => {
    const existing = lessonCompletions.find((c) => c.lessonId === lessonId);
    setUpdatingCompletion(lessonId);

    try {
      if (existing) {
        await deleteCompletion(existing.id);
        setLessonCompletions((prev) =>
          prev.filter((c) => c.lessonId !== lessonId)
        );
      } else {
        const newCompletion = await createCompletion({
          completedAt: new Date(),
          lessonId,
          studentId: profile!.id,
        }) as AppTypes.LessonCompletion;
        setLessonCompletions((prev) => [...prev, newCompletion]);
      }
    } catch (error) {
      console.error(error);
      alert("An error occurred trying to complete lesson. Please try again.");
    } finally {
      setUpdatingCompletion("");
    }
  };

  if (lessonsLoading || courseLoading || !profile) {
    return (
      <div className="flex flex-col gap-2 items-center h-full">
        <div className="mt-24 w-10 h-10 border-3 border-blue-600 border-t-white rounded-full p-4 animate-spin">

        </div>
        <p className="text-sm text-gray-700">Loading course...</p>
      </div>
    );
  }

  // Not found state
  if (!lessons || !course) return <CourseNotFoundPage />;
  if (lessons.length === 0) return <EmptyLessonsPage />;
  if (!currentLesson) return <NoLessonsPage />

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/dashboard/courses/${id}`)}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Course
              </button>
              <div className="h-6 border-l border-gray-300"></div>
              <div>
                <h1 className="font-semibold text-gray-900">{course.name}</h1>
                <p className="text-sm text-gray-500">Tutor: {course.tutor.fullName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
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
        <div className="relative h-full bg-gray-900 text-white transition-all duration-300">
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
                {lessons.map((lesson, i) => (
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
                    {lesson.videoUrl && lesson.videoUrl.length > 0 ? (
                      <Video className="shrink-0 w-4 h-4 text-white" />
                    ) : (
                      <FileText className="shrink-0 w-4 h-4 text-gray-400" />
                    )}
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
              {(course as AppTypes.Course).name}
            </h1>
            <p className="text-sm text-gray-500">
              Tutor: {(course as AppTypes.Course).tutor.fullName}
            </p>
          </div>

          <section className="bg-white p-6 space-y-6">
            <h2 className="text-xl font-semibold">
              {currentLesson.title}
            </h2>
            <div className="prose max-w-none text-gray-800 text-sm">
              <LessonMarkdown content={currentLesson.description as string} />
            </div>

            <div className="mt-12 pt-4 border-t border-t-gray-200">
              <h3 className="text-lg font-semibold mb-3">Videos</h3>
              {currentLesson.videoUrl.map((video, idx) =>
                video ? (
                  <iframe
                    key={idx}
                    className="w-3/4 mx-auto max-w-3xl rounded border aspect-video"
                    src={`https://www.youtube.com/embed/${getYouTubeId(video)}`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                ) : null
              )}
            </div>

            {currentLesson.attachmentUrls && currentLesson.attachmentUrls.length > 0 ? (
              <div className="mt-12 pt-4 border-t border-t-gray-200">
                <h3 className="text-lg font-semibold mb-3">Resources</h3>
                <ul className="space-y-2">
                  {currentLesson.attachmentUrls.map((resource, idx) =>
                    resource?.url ? (
                      <li key={idx} className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-gray-600 shrink-0" />
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 text-sm hover:text-blue-700 hover:underline"
                        >
                          {resource.title || resource.url}
                        </a>
                      </li>
                    ) : null
                  )}
                </ul>
              </div>
            ) : (
              <div className="mt-12 pt-4 border-t border-t-gray-200">
                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">
                    No additional resources for this lesson
                  </p>
                </div>
              </div>
            )}


            <button
              onClick={() => handleComplete(currentLesson.id)}
              disabled={updatingCompletion === currentLesson.id && completionsLoading}
              className={`mt-4 flex items-center gap-2 text-sm px-4 py-2 transition ${isCompleted
                ? "bg-gray-300 text-gray-800 hover:bg-gray-400"
                : "bg-green-600 text-white hover:bg-green-700"
                }`}
            >
              {updatingCompletion === currentLesson.id && completionsLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isCompleted ? (
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

        {/* Right Sidebar */}
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

          {showRightSidebar && course && (
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
                    new Date() < new Date(a.dueDate) &&
                    <Link
                      href={`/dashboard/tests/`}
                      key={a.id}
                      className="w-full flex flex-col p-1 hover:shadow-md hover:bg-gray-100 transition rounded"
                    >
                      <span className="font-medium">{a.title}</span>
                      <span className="text-xs text-gray-500">
                        Due: {formatDate(a.dueDate)}
                      </span>
                    </Link>
                  ))}
                </SidebarSection>
              )}

              {course.submissions.length > 0 && (
                <SidebarSection
                  title="Submissions"
                  icon={<Send className="w-4 h-4 text-green-500" />}
                >
                  {course.submissions.map((s) =>
                    new Date() < new Date(s.dueDate) && (
                      <div key={s.id}>
                        <p className="font-medium">{s.title}</p>
                        <p className="text-xs text-gray-500">
                          Due: {formatDate(s.dueDate)}
                        </p>
                      </div>
                    ))}
                </SidebarSection>
              )}
            </aside>
          )}
        </div>
      </div>
    </>
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
    <div className="space-y-2 bg-gray-200 border-l-3 border-l-blue-500 rounded-r p-2">
      <h3 className="text-md font-semibold flex items-center gap-2 mb-2">
        {icon}
        {title}
      </h3>
      <div className="text-sm text-gray-700 space-y-3">
        {children}
      </div>
    </div>
  );
}

function EmptyLessonsPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="bg-gray-100 rounded-full p-4 mb-6">
        <BookOpen className="h-10 w-10 text-gray-500" />
      </div>

      <h2 className="text-2xl font-bold text-gray-800 mb-2">
        No lessons posted yet
      </h2>

      <p className="text-gray-600 text-sm max-w-md mb-6">
        Your tutor has not posted any lessons yet. Please check back later or contact your tutor for more information.
      </p>

      <button
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium px-5 py-2.5 shadow-sm transition"
        onClick={() => router.push("/dashboard")}
      >
        <Home className="h-4 w-4" />
        Go to Home
      </button>
    </div>
  );
}

function NoLessonsPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="bg-yellow-100 rounded-full p-4 mb-6">
        <AlertTriangle className="h-10 w-10 text-yellow-500" />
      </div>

      <h2 className="text-2xl font-bold text-gray-800 mb-2">
        404 Error
      </h2>

      <p className="text-gray-600 text-sm max-w-md mb-6">
        The lesson you are looking for does not exist or has been moved. Please check back later or contact your tutor for more information.
      </p>

      <button
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium px-5 py-2.5 shadow-sm transition"
        onClick={() => router.push("/dashboard")}
      >
        <BookOpen className="h-4 w-4" />
        Go to Home
      </button>
    </div>
  );
}

function CourseNotFoundPage() {
  const router = useRouter();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="bg-red-100 rounded-full p-4 mb-6">
        <AlertTriangle className="h-10 w-10 text-red-600" />
      </div>

      <h1 className="text-2xl font-bold text-gray-800 mb-2">Course Not Found</h1>
      <p className="text-gray-600 text-sm max-w-md mb-6">
        The course you are looking for does not exist or may have been removed.
      </p>

      <button
        onClick={() => router.push("/dashboard")}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
      >
        Go to Home
      </button>
    </div>
  );
}