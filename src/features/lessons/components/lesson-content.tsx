/**
 * LessonContent — read-only render of a lesson for the student page.
 *
 * Server Component by default — composes the lesson body (RichContent:
 * the rich document, or the markdown column for lessons not yet edited), optional video
 * embeds, and a list of attachment downloads. Mark-complete and navigation
 * controls are rendered by their own client components alongside this one.
 *
 * YouTube URLs are detected via getYouTubeId; non-YouTube URLs render as a
 * plain anchor (we don't try to embed arbitrary video hosts).
 */

import { BookOpen, ExternalLink, FileText, Play, Video } from "lucide-react";

import { RichContent } from "@/components/content/rich-content";
import { SaverEmbed } from "@/components/data-saver";
import { Card } from "@/components/ui/card";
import { getYouTubeId } from "@/lib/functions";

export interface LessonContentProps {
  lesson: {
    id: string;
    title: string;
    description: string | null;
    /** The rich body; null until the lesson is saved from the editor. */
    descriptionJson: unknown;
    duration: number | null;
    videoUrl: string[];
    attachmentUrls: { id: string; title: string; url: string }[];
  };
}

export function LessonContent({ lesson }: LessonContentProps) {
  const videos = lesson.videoUrl.filter(Boolean);
  const hasAttachments = lesson.attachmentUrls.length > 0;

  return (
    <div className="space-y-6">
      {videos.length > 0 && (
        <Card className="space-y-4 p-6">
          <h3 className="font-display flex items-center gap-2 text-lg leading-tight tracking-tight text-foreground">
            <Play className="text-brand-terracotta size-4" />
            {videos.length === 1 ? "Lesson video" : "Lesson videos"}
          </h3>
          <div className="space-y-4">
            {videos.map((video, idx) => {
              const ytId = getYouTubeId(video);
              return (
                <div
                  key={idx}
                  className="bg-muted relative aspect-video w-full overflow-hidden rounded-md"
                >
                  {ytId ? (
                    <SaverEmbed label={videos.length === 1 ? "the video" : `video ${idx + 1}`}>
                      <iframe
                        className="absolute inset-0 size-full"
                        src={`https://www.youtube.com/embed/${ytId}`}
                        title={`${lesson.title}, video ${idx + 1}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </SaverEmbed>
                  ) : (
                    <a
                      href={video}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground absolute inset-0 flex items-center justify-center gap-2 text-sm"
                    >
                      <Video className="size-4" />
                      Open video
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="space-y-4 p-6">
        <h3 className="font-display flex items-center gap-2 text-lg leading-tight tracking-tight text-foreground">
          <BookOpen className="text-brand-terracotta size-4" />
          Lesson content
        </h3>
        {lesson.description ? (
          <RichContent value={lesson.descriptionJson} markdown={lesson.description} />
        ) : (
          <p className="text-muted-foreground text-sm italic">
            This lesson has no text.
          </p>
        )}
      </Card>

      <Card className="space-y-4 p-6">
        <h3 className="font-display flex items-center gap-2 text-lg leading-tight tracking-tight text-foreground">
          <FileText className="text-brand-terracotta size-4" />
          Files and links
        </h3>
        {hasAttachments ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {lesson.attachmentUrls.map((a) => (
              <li key={a.id}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-card hover:border-brand-terracotta/40 group flex items-center gap-3 rounded-md border p-3 transition-colors"
                >
                  <div className="bg-brand-terracotta/12 text-brand-terracotta flex size-9 items-center justify-center rounded-md">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {a.title || "Download"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Opens in a new tab
                    </p>
                  </div>
                  <ExternalLink className="text-muted-foreground group-hover:text-foreground size-4 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm italic">
            No files or links for this lesson.
          </p>
        )}
      </Card>
    </div>
  );
}
