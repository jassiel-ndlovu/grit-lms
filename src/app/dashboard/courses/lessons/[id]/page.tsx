"use client";

import { use, useEffect, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, FileText, Send, Calendar, Video, CheckCircle, Circle, BookOpen, AlertTriangle, Home, ArrowLeft, Menu, X, Clock, FileDown } from "lucide-react";
import LessonMarkdown from "@/app/components/markdown";
import { formatDate, getYouTubeId, formatDuration } from "@/lib/functions";
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
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
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
      <div className="flex flex-col gap-2 items-center justify-center h-screen">
        <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-700 mt-2">Loading course content...</p>
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
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/dashboard/courses/${id}`)}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Course
              </button>
              <div className="h-6 border-l border-gray-300 hidden md:block"></div>
              <div className="hidden md:block">
                <h1 className="font-semibold text-gray-900">{course.name}</h1>
                <p className="text-sm text-gray-500">Tutor: {course.tutor.fullName}</p>
              </div>
            </div>
            
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              {mobileSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="h-full bg-gray-50 flex flex-col md:flex-row">
        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <div className={clsx(
          "fixed md:relative w-64 bg-gray-900 text-white rounded-xl h-full transition-transform duration-300 z-50 md:z-auto",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}>
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-lg font-bold">Lessons</h2>
              <p className="text-sm text-gray-400 mt-1">{lessons.length} lessons</p>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <ul className="p-2 space-y-1">
                {lessons.map((lesson, i) => {
                  const isCompleted = lessonCompletions.some(c => c.lessonId === lesson.id);
                  return (
                    <li
                      key={lesson.id}
                      title={lesson.title}
                      onClick={() => {
                        setSelectedLessonIndex(i);
                        setMobileSidebarOpen(false);
                      }}
                      className={clsx(
                        "cursor-pointer flex items-center gap-3 p-3 rounded-lg transition-all",
                        {
                          "bg-blue-600 text-white": i === selectedLessonIndex,
                          "bg-gray-800 hover:bg-gray-700": i !== selectedLessonIndex,
                        }
                      )}
                    >
                      <div className="flex-shrink-0">
                        {lesson.videoUrl && lesson.videoUrl.length > 0 ? (
                          <Video className="w-4 h-4" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{lesson.title}</p>
                        <div className="flex items-center text-xs text-gray-400 mt-1">
                          {lesson.duration && (
                            <>
                              <Clock className="w-3 h-3 mr-1" />
                              <span>{formatDuration(lesson.duration)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {isCompleted && (
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {currentLesson.title}
              </h1>
              <div className="flex items-center text-sm text-gray-600 mt-2">
                <span>Lesson {selectedLessonIndex + 1} of {lessons.length}</span>
                {currentLesson.duration && (
                  <>
                    <span className="mx-2">•</span>
                    <Clock className="w-4 h-4 mr-1" />
                    <span>{formatDuration(currentLesson.duration)}</span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Lesson content */}
              <div className="p-6">
                <div className="prose max-w-none text-gray-800">
                  <LessonMarkdown content={currentLesson.description as string} />
                </div>
              </div>

              {/* Videos section */}
              {currentLesson.videoUrl && currentLesson.videoUrl.length > 0 && (
                <div className="border-t border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Video className="w-5 h-5 mr-2 text-blue-600" />
                    Lesson Videos
                  </h3>
                  <div className="space-y-4">
                    {currentLesson.videoUrl.map((video, idx) =>
                      video ? (
                        <div key={idx} className="rounded-lg overflow-hidden shadow-sm">
                          <iframe
                            className="w-full aspect-video"
                            src={`https://www.youtube.com/embed/${getYouTubeId(video)}`}
                            title="YouTube video player"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          ></iframe>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}

              {/* Resources section */}
              <div className="border-t border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FileDown className="w-5 h-5 mr-2 text-blue-600" />
                  Lesson Resources
                </h3>
                
                {currentLesson.attachmentUrls && currentLesson.attachmentUrls.length > 0 ? (
                  <div className="grid gap-3">
                    {currentLesson.attachmentUrls.map((resource, idx) =>
                      resource?.url ? (
                        <a
                          key={idx}
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-sm transition-all"
                        >
                          <FileText className="w-5 h-5 text-gray-500 mr-3" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {resource.title || resource.url.split('/').pop()}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Click to download
                            </p>
                          </div>
                        </a>
                      ) : null
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">
                      No additional resources for this lesson
                    </p>
                  </div>
                )}
              </div>

              {/* Completion button */}
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <button
                  onClick={() => handleComplete(currentLesson.id)}
                  disabled={updatingCompletion === currentLesson.id && completionsLoading}
                  className={clsx(
                    "flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-medium transition-all w-full md:w-auto",
                    isCompleted
                      ? "bg-gray-200 text-gray-800 hover:bg-gray-300"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  )}
                >
                  {updatingCompletion === currentLesson.id && completionsLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
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
              </div>
            </div>

            {/* Lesson navigation */}
            <div className="flex justify-between mt-6">
              <button
                onClick={() => setSelectedLessonIndex(prev => Math.max(0, prev - 1))}
                disabled={selectedLessonIndex === 0}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                  selectedLessonIndex === 0
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-blue-600 hover:bg-blue-50"
                )}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Lesson
              </button>
              
              <button
                onClick={() => setSelectedLessonIndex(prev => Math.min(lessons.length - 1, prev + 1))}
                disabled={selectedLessonIndex === lessons.length - 1}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
                  selectedLessonIndex === lessons.length - 1
                    ? "text-gray-400 cursor-not-allowed"
                    : "text-blue-600 hover:bg-blue-50"
                )}
              >
                Next Lesson
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <div className={clsx(
          "hidden lg:block w-72 bg-white border-l border-gray-200 overflow-y-auto",
          !showRightSidebar && "lg:hidden"
        )}>
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Course Information</h3>
            <button
              onClick={() => setShowRightSidebar(false)}
              className="p-1 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="p-4 space-y-6">
            {course.courseEvents.length > 0 && (
              <SidebarSection
                title="Upcoming Events"
                icon={<Calendar className="w-4 h-4 text-indigo-500" />}
              >
                {course.courseEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors"
                  >
                    <p className="font-medium text-sm">{event.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(event.date)}
                    </p>
                    <a
                      href={event.link}
                      target="_blank"
                      className="inline-block mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Join Meeting
                    </a>
                  </div>
                ))}
              </SidebarSection>
            )}

            {(course.tests.length > 0 || course.quizzes.length > 0) && (
              <SidebarSection
                title="Assessments"
                icon={<FileText className="w-4 h-4 text-blue-500" />}
              >
                {[...course.tests, ...course.quizzes].map((a) => (
                  new Date() < new Date(a.dueDate) &&
                  <Link
                    href={`/dashboard/tests/`}
                    key={a.id}
                    className="block p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    <span className="font-medium text-sm block">{a.title}</span>
                    <span className="text-xs text-gray-500 mt-1 block">
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
                    <div key={s.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-green-300 transition-colors">
                      <p className="font-medium text-sm">{s.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Due: {formatDate(s.dueDate)}
                      </p>
                    </div>
                  )
                )}
              </SidebarSection>
            )}
          </div>
        </div>
      </div>

      {/* Mobile navigation bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 flex justify-between z-10">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="flex items-center justify-center flex-1 p-2 text-gray-700"
        >
          <Menu className="w-5 h-5 mr-1" />
          <span className="text-sm">Lessons</span>
        </button>
        
        <div className="flex items-center">
          <button
            onClick={() => setSelectedLessonIndex(prev => Math.max(0, prev - 1))}
            disabled={selectedLessonIndex === 0}
            className="p-2 text-gray-700 disabled:text-gray-400"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <span className="px-2 text-sm text-gray-600">
            {selectedLessonIndex + 1}/{lessons.length}
          </span>
          
          <button
            onClick={() => setSelectedLessonIndex(prev => Math.min(lessons.length - 1, prev + 1))}
            disabled={selectedLessonIndex === lessons.length - 1}
            className="p-2 text-gray-700 disabled:text-gray-400"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        <button
          onClick={() => handleComplete(currentLesson.id)}
          disabled={updatingCompletion === currentLesson.id && completionsLoading}
          className={clsx(
            "flex items-center justify-center flex-1 p-2 text-sm font-medium",
            isCompleted 
              ? "text-gray-700" 
              : "text-blue-600"
          )}
        >
          {isCompleted ? (
            <CheckCircle className="w-5 h-5 mr-1" />
          ) : (
            <Circle className="w-5 h-5 mr-1" />
          )}
          <span>{isCompleted ? "Completed" : "Complete"}</span>
        </button>
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
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="space-y-2">
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
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium px-5 py-2.5 rounded-lg shadow-sm transition"
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
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium px-5 py-2.5 rounded-lg shadow-sm transition"
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
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
      >
        Go to Home
      </button>
    </div>
  );
}