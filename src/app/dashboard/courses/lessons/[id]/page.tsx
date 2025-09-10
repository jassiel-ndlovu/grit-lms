"use client";

import { use, useEffect, useState } from "react";
import clsx from "clsx";
import { FileText, Send, Calendar, Video, CheckCircle, Circle, BookOpen, AlertTriangle, Home, ArrowLeft, Play, Clock, ExternalLink, Menu, X, SkipForward, SkipBack, PanelLeft, PanelRight, Maximize2, Trophy, Target, Timer } from "lucide-react";
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
  const { fetchCompletionByStudentAndLesson, createCompletion, deleteCompletion } = useLessonCompletions();
  const { profile } = useProfile();
  const router = useRouter();

  const [selectedLessonIndex, setSelectedLessonIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [lessonCompletions, setLessonCompletions] = useState<AppTypes.LessonCompletion[]>([]);
  const [lessons, setLessons] = useState<AppTypes.Lesson[]>([]);
  const [course, setCourse] = useState<AppTypes.Course | null>(null);
  const [updatingCompletion, setUpdatingCompletion] = useState<string>("");

  const currentLesson: AppTypes.Lesson | null = lessons[selectedLessonIndex] || null;
  const isCompleted =
    !!currentLesson &&
    lessonCompletions.some((c) => c.lessonId === currentLesson.id);

  const completedLessonsCount = lessonCompletions.length;
  const progressPercentage = lessons.length > 0 ? Math.round((completedLessonsCount / lessons.length) * 100) : 0;

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

  // Navigation handlers
  const goToNextLesson = () => {
    if (selectedLessonIndex < lessons.length - 1) {
      setSelectedLessonIndex(selectedLessonIndex + 1);
      router.push(`/dashboard/courses/lessons/${id}?index=${selectedLessonIndex + 1}`);
    }
  };

  const goToPrevLesson = () => {
    if (selectedLessonIndex > 0) {
      setSelectedLessonIndex(selectedLessonIndex - 1);
      router.push(`/dashboard/courses/lessons/${id}?index=${selectedLessonIndex - 1}`);
    }
  };

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
      <div className="flex flex-col gap-4 items-center justify-center h-screen bg-gray-50">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900">Loading course...</p>
          <p className="text-sm text-gray-500">Please wait while we prepare your lesson</p>
        </div>
      </div>
    );
  }

  // Not found states
  if (!lessons || !course) return <CourseNotFoundPage />;
  if (lessons.length === 0) return <EmptyLessonsPage />;
  if (!currentLesson) return <NoLessonsPage />

  const LessonItem = ({ lesson, index, isActive, isCompleted }: {
    lesson: AppTypes.Lesson;
    index: number;
    isActive: boolean;
    isCompleted: boolean;
  }) => (
    <button
      onClick={() => setSelectedLessonIndex(index)}
      className={clsx(
        "w-full group relative flex items-center gap-3 p-4 rounded-xl text-left transition-all duration-200",
        isActive
          ? "bg-blue-600 text-white shadow-lg"
          : "text-gray-700 hover:bg-gray-50 hover:shadow-sm"
      )}
    >
      {/* Status Indicator */}
      <div className="relative flex-shrink-0">
        {isCompleted ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <div className={clsx(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center",
            isActive ? "border-white" : "border-gray-300"
          )}>
            <span className="text-xs font-medium">{index + 1}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className={clsx(
          "font-medium truncate",
          isActive ? "text-white" : "text-gray-900"
        )}>
          {lesson.title}
        </h4>
        <div className="flex items-center gap-3 mt-1">
          {lesson.duration && (
            <span className={clsx(
              "flex items-center text-xs",
              isActive ? "text-blue-100" : "text-gray-500"
            )}>
              <Clock className="w-3 h-3 mr-1" />
              {lesson.duration} min
            </span>
          )}
          {lesson.videoUrl && lesson.videoUrl.length > 0 && (
            <Video className={clsx("w-3 h-3", isActive ? "text-blue-100" : "text-gray-400")} />
          )}
          {lesson.attachmentUrls && lesson.attachmentUrls.length > 0 && (
            <FileText className={clsx("w-3 h-3", isActive ? "text-blue-100" : "text-gray-400")} />
          )}
        </div>
      </div>

      {/* Active Indicator */}
      {isActive && (
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        </div>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header */}
      <header className="bg-white border-b border-gray-200 sticky top-20 z-20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/dashboard/courses/${id}`)}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors group"
              >
                <ArrowLeft className="h-5 w-5 mr-2 group-hover:-translate-x-1 transition-transform" />
                Back to Course
              </button>
              <div className="h-6 border-l border-gray-300"></div>
              <div>
                <h1 className="font-semibold text-gray-900">{course.name}</h1>
                <p className="text-sm text-gray-500">with {course.tutor.fullName}</p>
              </div>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-2">
                <span className="text-sm text-gray-500">Progress:</span>
                <div className="flex items-center space-x-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{progressPercentage}%</span>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(prev => !prev)}
                className="md:hidden p-2 text-gray-600 hover:text-gray-900"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="fixed left-0 top-0 bottom-0 w-80 bg-white shadow-xl overflow-y-auto">
            <div className="p-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Course Lessons</h2>
              <div className="space-y-2">
                {lessons.map((lesson, index) => (
                  <LessonItem
                    key={lesson.id}
                    lesson={lesson}
                    index={index}
                    isActive={index === selectedLessonIndex}
                    isCompleted={lessonCompletions.some(c => c.lessonId === lesson.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex min-h-[calc(100vh-4rem)]">
        {/* Left Sidebar */}
        <div className={clsx(
          "hidden md:block bg-white border-r border-gray-200 transition-all duration-300",
          sidebarOpen ? "w-80" : "w-0"
        )}>
          <div className="sticky top-40">
            <div className="relative h-full">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="absolute -right-3 top-6 z-10 p-1.5 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
              >
                {sidebarOpen ? (
                  <PanelLeft className="w-4 h-4" />
                ) : (
                  <PanelRight className="w-4 h-4" />
                )}
              </button>

              {sidebarOpen && (
                <div className="h-full overflow-y-auto">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-semibold text-gray-900">Course Content</h2>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                        {completedLessonsCount}/{lessons.length}
                      </span>
                    </div>

                    {/* Progress Overview */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                        <span className="text-sm font-bold text-gray-900">{progressPercentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${progressPercentage}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Lessons List */}
                    <div className="space-y-3">
                      {lessons.map((lesson, index) => (
                        <LessonItem
                          key={lesson.id}
                          lesson={lesson}
                          index={index}
                          isActive={index === selectedLessonIndex}
                          isCompleted={lessonCompletions.some(c => c.lessonId === lesson.id)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-6 py-8">
              {/* Lesson Header */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                      Lesson {selectedLessonIndex + 1}
                    </span>
                    {currentLesson.duration && (
                      <span className="flex items-center text-sm text-gray-500">
                        <Clock className="w-4 h-4 mr-1" />
                        {currentLesson.duration} minutes
                      </span>
                    )}
                  </div>
                  {/* <div className="flex items-center space-x-2">
                    <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                      <Bookmark className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div> */}
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-4">{currentLesson.title}</h1>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={goToPrevLesson}
                      disabled={selectedLessonIndex === 0}
                      className="flex items-center px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <SkipBack className="w-4 h-4 mr-2" />
                      Previous
                    </button>
                    <button
                      onClick={goToNextLesson}
                      disabled={selectedLessonIndex === lessons.length - 1}
                      className="flex items-center px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                      <SkipForward className="w-4 h-4 ml-2" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleComplete(currentLesson.id)}
                    disabled={updatingCompletion === currentLesson.id}
                    className={clsx(
                      "flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                      isCompleted
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    {updatingCompletion === currentLesson.id ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    ) : isCompleted ? (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    ) : (
                      <Circle className="w-4 h-4 mr-2" />
                    )}
                    {isCompleted ? "Completed" : "Mark Complete"}
                  </button>
                </div>
              </div>

              {/* Video Section */}
              {currentLesson.videoUrl && currentLesson.videoUrl.length > 0 && (
                <div className="mb-8">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                          <Play className="w-5 h-5 mr-2 text-blue-600" />
                          Lesson Video
                        </h3>
                        <button
                          onClick={() => setIsVideoFullscreen(!isVideoFullscreen)}
                          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                        >
                          <Maximize2 className="w-5 h-5" />
                        </button>
                      </div>
                      {currentLesson.videoUrl.map((video, idx) =>
                        video ? (
                          <div key={idx} className={clsx(
                            "relative rounded-lg overflow-hidden",
                            isVideoFullscreen ? "aspect-video" : "aspect-video"
                          )}>
                            <iframe
                              className="w-full h-full"
                              src={`https://www.youtube.com/embed/${getYouTubeId(video)}`}
                              title="YouTube video player"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            ></iframe>
                          </div>
                        ) : null
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Lesson Content */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
                <div className="p-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
                    Lesson Content
                  </h3>
                  <div className="prose max-w-none">
                    <LessonMarkdown content={currentLesson.description as string} />
                  </div>
                </div>
              </div>

              {/* Resources Section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-blue-600" />
                    Resources & Downloads
                  </h3>

                  {currentLesson.attachmentUrls && currentLesson.attachmentUrls.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {currentLesson.attachmentUrls.map((resource, idx) =>
                        resource?.url ? (
                          <div key={idx} className="group flex items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all duration-200">
                            <div className="p-3 bg-blue-50 rounded-lg mr-4 group-hover:bg-blue-100 transition-colors">
                              <FileText className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 truncate">
                                {resource.title || "Download File"}
                              </h4>
                              <p className="text-sm text-gray-500">Click to download</p>
                            </div>
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-4 p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </a>
                          </div>
                        ) : null
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No additional resources available for this lesson</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className={clsx(
          "hidden lg:block bg-white border-l border-gray-200 transition-all duration-300",
          showRightSidebar ? "w-80" : "w-0"
        )}>
          <div className="sticky top-40">
          <div className="relative h-full">
            <button
              onClick={() => setShowRightSidebar(prev => !prev)}
              className="absolute -left-3 top-6 z-10 p-1.5 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
            >
              {showRightSidebar ? (
                <PanelRight className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4" />
              )}
            </button>

            {showRightSidebar && course && (
              <div className="h-full overflow-y-auto">
                <div className="p-6 space-y-6">
                  {/* Course Info */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                    <h3 className="font-semibold text-gray-900 mb-2">{course.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">Instructor: {course.tutor.fullName}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-medium text-gray-900">{completedLessonsCount}/{lessons.length} lessons</span>
                    </div>
                  </div>

                  {/* Upcoming Events */}
                  {course.courseEvents && course.courseEvents.length > 0 && (
                    <SidebarSection
                      title="Upcoming Events"
                      icon={<Calendar className="w-5 h-5 text-indigo-500" />}
                    >
                      <div className="space-y-3">
                        {course.courseEvents.map((event) => (
                          <div key={event.id} className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                            <h4 className="font-medium text-gray-900 mb-1">{event.title}</h4>
                            <p className="text-xs text-gray-500 mb-2">
                              {new Date(event.date).toLocaleDateString()}
                            </p>
                            <a
                              href={event.link ?? ""}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
                            >
                              Join Meeting <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </SidebarSection>
                  )}

                  {/* Assessments */}
                  {(course.tests?.length > 0 || course.quizzes?.length > 0) && (
                    <SidebarSection
                      title="Assessments"
                      icon={<Target className="w-5 h-5 text-blue-500" />}
                    >
                      <div className="space-y-3">
                        {[...(course.tests || []), ...(course.quizzes || [])].map((assessment) => (
                          new Date() < new Date(assessment.dueDate) && (
                            <Link
                              href={`/dashboard/tests/`}
                              key={assessment.id}
                              className="block p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm hover:border-blue-200 transition-all"
                            >
                              <h4 className="font-medium text-gray-900 mb-1">{assessment.title}</h4>
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span className="flex items-center">
                                  <Timer className="w-3 h-3 mr-1" />
                                  Due {formatDate(assessment.dueDate)}
                                </span>
                                <Trophy className="w-3 h-3" />
                              </div>
                            </Link>
                          )
                        ))}
                      </div>
                    </SidebarSection>
                  )}

                  {/* Submissions */}
                  {course.submissions && course.submissions.length > 0 && (
                    <SidebarSection
                      title="Assignments"
                      icon={<Send className="w-5 h-5 text-green-500" />}
                    >
                      <div className="space-y-3">
                        {course.submissions.map((submission) =>
                          new Date() < new Date(submission.dueDate) && (
                            <div key={submission.id} className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                              <h4 className="font-medium text-gray-900 mb-1">{submission.title}</h4>
                              <p className="text-xs text-gray-500">
                                Due: {formatDate(submission.dueDate)}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    </SidebarSection>
                  )}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
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
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 px-2">
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-full p-8 mb-8 inline-flex">
          <BookOpen className="h-16 w-16 text-blue-500" />
        </div>

        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          No Lessons Available
        </h2>

        <p className="text-gray-600 text-lg mb-8 leading-relaxed">
          Your instructor hasn&apos;t posted any lessons yet. Check back soon or reach out to them for updates on when content will be available.
        </p>

        <div className="space-y-4">
          <button
            className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            onClick={() => router.push("/dashboard")}
          >
            <Home className="h-5 w-5" />
            Return to Dashboard
          </button>

          <div className="text-sm text-gray-500">
            Need help? Contact your instructor or support team
          </div>
        </div>
      </div>
    </div>
  );
}

function NoLessonsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-gradient-to-br from-yellow-50 to-orange-100 rounded-full p-8 mb-8 inline-flex">
          <AlertTriangle className="h-16 w-16 text-yellow-500" />
        </div>

        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Lesson Not Found
        </h2>

        <p className="text-gray-600 text-lg mb-8 leading-relaxed">
          The lesson you&apos;re looking for doesn&apos;t exist or may have been moved. This could be due to an invalid lesson index or the content being reorganized.
        </p>

        <div className="space-y-4">
          <button
            className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            onClick={() => router.push("/dashboard")}
          >
            <BookOpen className="h-5 w-5" />
            Browse All Courses
          </button>

          <div className="text-sm text-gray-500">
            Try going back to your course overview to find the right lesson
          </div>
        </div>
      </div>
    </div>
  );
}

function CourseNotFoundPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-gradient-to-br from-red-50 to-pink-100 rounded-full p-8 mb-8 inline-flex">
          <AlertTriangle className="h-16 w-16 text-red-500" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-4">Course Not Found</h1>

        <p className="text-gray-600 text-lg mb-8 leading-relaxed">
          The course you&apos;re trying to access doesn&apos;t exist or may have been removed. Please check the URL or contact your administrator.
        </p>

        <div className="space-y-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Home className="h-5 w-5" />
            Return to Dashboard
          </button>

          <div className="text-sm text-gray-500">
            Need help? Contact support for assistance
          </div>
        </div>
      </div>
    </div>
  );
}