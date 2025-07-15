import Image from "next/image";
import Link from "next/link";

type CourseCardProps = {
  course: Course;
};

export default function CourseCard({ course }: CourseCardProps) {
  const totalLessons = course.lessons.length;
  const lessonsDone = course.lessons.reduce(
    (acc, lesson) => acc + lesson.completedBy.length,
    0
  );

  const progressPercent =
    totalLessons > 0 ? (lessonsDone / totalLessons) * 100 : 0;

  const randomImage = (): string => {
    const randomNumber = Math.floor(Math.random() * 7) + 1;
    return `/images/course-image-${randomNumber}.jpeg`;
  };

  return (
    <Link href={`/dashboard/courses/${course.courseId}`} className="block">
      <div className="bg-white border border-gray-200 hover:shadow-xl transition-shadow rounded-lg overflow-hidden">
        {/* Image */}
        <div className="relative w-full h-32">
          <Image
            src={course.courseImageUrl || randomImage()}
            alt={course.courseName}
            fill
            className="object-cover"
          />
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          <p className="text-sm text-gray-500">
            {course.tutor?.fullName ?? "Unknown Tutor"}
          </p>
          <h3 className="text-lg font-semibold">{course.courseName}</h3>

          {/* Progress */}
          <div>
            <p className="text-xs text-gray-500 mb-1">
              {lessonsDone} / {totalLessons} Lessons Completed
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
