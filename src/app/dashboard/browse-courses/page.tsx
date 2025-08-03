'use client'

import { useState } from 'react'
import CourseCard from '../components/course-card'
import { Filter, Search } from 'lucide-react'
import Image from 'next/image'
import { useCourses } from '@/context/CourseContext'

export default function BrowseCoursesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('All')

  const { courses } = useCourses();

  const filteredCourses = courses.filter((course) =>
    (filter === 'All') &&
    course.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const categories = ['All', 'Programming', 'Math', 'Science', 'Languages']

  return (
    <div className="h-full w-full px-6 py-10 space-y-10 bg-gray-50">
      <header className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800">Browse Courses</h1>
        <p className="text-sm text-gray-600 mt-1">
          Explore our available courses. Filter by category or search by title.
        </p>
      </header>

      {/* Filter & Search Bar */}
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-4">
        <div className="relative w-full md:w-1/2">
          <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search courses..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="text-gray-400 w-4 h-4" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Course Grid */}
      <section className="max-w-5xl mx-auto">
        {filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course: Course) => (
              <CourseCard key={course.id} course={course} lessons={[]} />
            ))}
          </div>
        ) : (
          <div className="bg-white p-10 rounded-lg text-center border border-gray-200">
            <div className="relative mx-auto w-44 h-44 mb-2">
              <Image
                src="/images/No-Result.jpg"
                alt="No results"
                className="object-cover"
                fill
              />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              No courses match your search
            </h2>
            <p className="text-sm text-gray-500">
              Try adjusting your search or filter options.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
