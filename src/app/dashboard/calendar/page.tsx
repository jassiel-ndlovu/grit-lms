'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays, FileText, Send } from 'lucide-react'
import { useCourses } from '@/context/CourseContext'
import { useTests } from '@/context/TestContext'

function getMonthDates(year: number, month: number) {
  // const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  const days = []

  for (let i = 1; i <= end.getDate(); i++) {
    days.push(new Date(year, month, i))
  }

  return days
}

export default function CalendarPage() {
  const { courses } = useCourses();
  const { tests } = useTests();

  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  const daysInMonth = getMonthDates(year, month)

  const allEvents = useMemo(() => {
    const result: Record<string, { type: string; title: string; link: string }[]> = {}

    courses.forEach((course) => {
      course.courseEvents.forEach((event) => {
        const key = new Date(event.date).toDateString()
        result[key] = result[key] || []
        result[key].push({
          type: 'event',
          title: event.title,
          link: event.link,
        })
      })
    })

    tests.forEach((a) => {
      const key = new Date(a.dueDate).toDateString()
      result[key] = result[key] || []
      result[key].push({
        type: 'assessment',
        title: a.title,
        link: `/courses/${a.courseId}/tests/${a.id}`,
      })
    })

    // submissions.forEach((s) => {
    //   const key = new Date(s.dueDate).toDateString()
    //   result[key] = result[key] || []
    //   result[key].push({
    //     type: 'submission',
    //     title: s.title,
    //     link: `/submissions/${s.id}`,
    //   })
    // })

    return result
  }, [courses, tests])

  return (
    <div className="h-full w-full bg-gray-50 px-6 py-10 overflow-auto">
      <header className="max-w-6xl mx-auto mb-10">
        <h1 className="text-3xl font-bold text-gray-800">Calendar</h1>
        <p className="text-sm text-gray-600 mt-1">
          View all your scheduled activities, assessments, and submissions.
        </p>
      </header>

      <main className="max-w-6xl mx-auto bg-white p-6 rounded-md shadow-sm border">
        <div className="grid grid-cols-7 gap-px bg-gray-200 text-center text-sm font-medium text-gray-600">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="bg-gray-100 py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {daysInMonth.map((date, i) => {
            const key = date.toDateString()
            const items = allEvents[key] || []

            return (
              <div
                key={i}
                className="min-h-[110px] bg-white px-2 py-2 text-xs text-gray-700 relative"
              >
                <div className="font-semibold text-xs mb-1 text-right">{date.getDate()}</div>

                <div className="space-y-1 overflow-hidden">
                  {items.slice(0, 3).map((item, idx) => (
                    <Link href={item.link} key={idx} className="block truncate hover:underline">
                      <div className="flex items-center gap-1 text-[11px] text-blue-600">
                        {item.type === 'event' && <CalendarDays className="w-3 h-3 text-blue-500" />}
                        {item.type === 'assessment' && <FileText className="w-3 h-3 text-indigo-500" />}
                        {item.type === 'submission' && <Send className="w-3 h-3 text-green-500" />}
                        {item.title}
                      </div>
                    </Link>
                  ))}

                  {items.length > 3 && (
                    <span className="text-[10px] text-gray-400">+ {items.length - 3} more</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {daysInMonth.length === 0 && (
          <div className="text-center py-20">
            <Image
              src="/images/empty-calendar.png"
              alt="Empty calendar"
              width={220}
              height={220}
              className="mx-auto mb-6"
            />
            <p className="text-gray-500 text-sm">No events scheduled for this month.</p>
          </div>
        )}
      </main>
    </div>
  );
}
