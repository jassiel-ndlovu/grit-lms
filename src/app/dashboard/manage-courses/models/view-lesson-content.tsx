import LessonMarkdown from "@/app/components/markdown";
import { getYouTubeId } from "@/lib/functions";
import { FileText, Video } from "lucide-react";

type ViewLessonContentProps = {
  lesson: Partial<AppTypes.Lesson>;
  onEdit: () => void;
}

export default function ViewLessonContent({ lesson, onEdit }: ViewLessonContentProps) {
  console.log("ViewLessonContent", lesson);
  
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {lesson.title || 'Untitled Lesson'}
        </h2>
        <button
          onClick={onEdit}
          className="bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 transition text-sm"
        >
          Edit Lesson
        </button>
      </div>

      {lesson.description ? (
        <LessonMarkdown content={lesson.description} />
      ) : (
        <p className="text-gray-500 italic">No description provided</p>
      )}

      {lesson.videoUrl && lesson.videoUrl.length > 0 ? (
          <div className="space-y-4 mt-12 pt-4 border-t border-t-gray-200">
            <h3 className="text-lg font-semibold">
              Videos
            </h3>
            {lesson.videoUrl.map((video, idx) =>
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
      ) : (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Video className="w-10 h-10 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">
            No videos available for this lesson
          </p>
        </div>
      )}

      {lesson.attachmentUrls && lesson.attachmentUrls.length > 0 ? (
        <div className="mt-12 pt-4 border-t border-t-gray-200">
          <h3 className="text-lg font-semibold mb-3">Resources</h3>
          <ul className="space-y-2">
            {lesson.attachmentUrls.map((resource, idx) =>
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
    </>
  );
}