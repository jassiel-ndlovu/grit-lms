/**
 * CourseCard — single course row used in grids on browse / manage / my-courses.
 *
 * Server Component by default. Pass `actions` for the tutor manage view to
 * render an edit/delete dropdown; omit it for student/browse views.
 */

import Image from "next/image";
import Link from "next/link";
import { BookOpen, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { CourseListItem } from "../queries";

export interface CourseCardProps {
  course: CourseListItem;
  /** Where clicking the card navigates. */
  href: string;
  /** Optional slot for an actions dropdown (rendered top-right). */
  actions?: React.ReactNode;
  className?: string;
}

export function CourseCard({
  course,
  href,
  actions,
  className,
}: CourseCardProps) {
  const tutorName = course.tutor.fullName ?? "Unknown tutor";

  return (
    <Card
      className={cn(
        "group relative overflow-hidden p-0 transition-shadow hover:shadow-md",
        className,
      )}
    >
      <Link href={href} className="block">
        <div className="bg-muted relative aspect-[16/9] w-full overflow-hidden">
          {(course.imageUrl) ? (
            <Image
              src={course.imageUrl.includes("course") ?`/images/${course.imageUrl}` : course.imageUrl}
              alt={course.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
              No cover
            </div>
          )}
        </div>

        <div className="space-y-2 p-4">
          <div className="space-y-1">
            <h3 className="font-display line-clamp-1 text-lg leading-tight tracking-tight text-foreground">
              {course.name}
            </h3>
            <p className="text-muted-foreground text-xs">{tutorName}</p>
          </div>

          {course.description && (
            <p className="text-muted-foreground line-clamp-2 text-sm">
              {course.description}
            </p>
          )}

          <div className="text-muted-foreground flex items-center gap-3 pt-1 text-xs">
            <span className="inline-flex items-center gap-1">
              <BookOpen className="size-3" />
              {course._count.lessons} lessons
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" />
              {course._count.students} students
            </span>
          </div>
        </div>
      </Link>

      {actions && (
        <div className="absolute top-2 right-2 z-10">{actions}</div>
      )}
    </Card>
  );
}
