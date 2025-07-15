'use client'

import { Calendar, FileText, Send, } from 'lucide-react';
import CourseCard from '../components/course-card';
import CourseSearchBar from '@/app/dashboard/components/search';
import { useRouter } from 'next/navigation';
import { assessments, courses, submissions } from '@/lib/static';

export default function Home() {
  const handleSearch = ({ searchTerm, filter, sort }: CourseSearchOptions) => {
    // Apply filtering or fetch logic here
    console.log('Search Term:', searchTerm);
    console.log('Filter:', filter);
    console.log('Sort:', sort);
  };

  const events: CourseEvent[] = courses.flatMap(course => course.courseEvents || []);

  return (
    <div className="h-full space-y-10 px-4 pt-4 overflow-y-auto">
      {/* Courses */}
      <section>
        <div className="mb-4">
          <CourseSearchBar onSearch={handleSearch} />
        </div>
        <h2 className="text-lg font-semibold mb-4">
          Your Courses
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard
              key={course.courseId}
              course={course}
            />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CourseEventSections events={events} />
        <CourseAssessmentSection assessments={assessments} />
        <CourseSubmissionSection submissions={submissions} />
      </div>
    </div>
  )
}

function CourseEventSections({ events }: { events: CourseEvent[] }) {
  const router = useRouter();

  return (
    <>
      {/* Upcoming Meetings */}
      <div className="p-5 bg-gradient-to-br from-blue-100 to-blue-300">
        <h2 className="text-lg font-semibold text-blue-500 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-500" />
          Upcoming Meetings
        </h2>
        <div className="space-y-4">
          {events.length === 0 ? (
            <p className="text-sm text-gray-500">No meetings scheduled.</p>
          ) : (
            events.slice(0, 3).map((event: CourseEvent) => (
              <div 
                key={event.id} 
                className="bg-white p-3 shadow-sm hover:shadow-md transition"
                onClick={() => router.push(event.link)}
              >
                <p className="text-sm font-medium text-gray-800">{event.title}</p>
                <p className="text-xs text-gray-500">{new Date(event.date).toUTCString()}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function CourseAssessmentSection({ assessments }: { assessments: Assessment[] }) {
  return (
    <>
      {/* Upcoming Assessments */}
      <div className="p-5 bg-gradient-to-br from-indigo-100 to-indigo-300">
        <h2 className="text-lg font-semibold text-indigo-700 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-700" />
          Upcoming Assessments
        </h2>
        <div className="space-y-4">
          {assessments.length === 0 ? (
            <p className="text-sm text-gray-500">No upcoming assessments.</p>
          ) : (
            assessments.map((a) => (
              <div key={a.id} className="bg-white p-3 hover:shadow-md transition border border-gray-100">
                <p className="text-sm font-medium text-gray-800">
                  {courses.find(course => course.courseId === a.courseId)?.courseName || 'Unknown Course'} - {a.title}
                </p>
                <p className="text-xs text-gray-500">Due: {a.dueDate}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function CourseSubmissionSection({ submissions }: { submissions: Submission[] }) {
  return (
    <>
      {/* Upcoming Submissions */}
      <div className="p-5 bg-gradient-to-br from-green-100 to-green-300">
        <h2 className="text-lg font-semibold text-emerald-700 mb-4 flex items-center gap-2">
          <Send className="w-5 h-5 text-emerald-700" />
          Upcoming Submissions
        </h2>
        <div className="space-y-4">
          {submissions.length === 0 ? (
            <p className="text-sm text-gray-500">No upcoming submissions.</p>
          ) : (
            submissions.map((s) => (
              <div key={s.id} className="bg-white p-3 hover:shadow-md transition">
                <p className="text-sm font-medium text-gray-800">{s.title}</p>
                <p className="text-xs text-gray-500">Due: {s.dueDate}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}