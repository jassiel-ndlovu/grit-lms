'use client';

import { Plus, ImageIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog } from '@headlessui/react';
import Image from 'next/image';
import { useProfile } from '@/context/ProfileContext';
import { useStudent } from '@/context/StudentContext';
import { useCourses } from '@/context/CourseContext';
import TutorCourseCard from './models/tutor-course-card';
import TutorCourseCardSkeleton from './skeletons/tutor-skeleton-course-card';

export default function ManageCoursesPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [localCourses, setLocalCourses] = useState<Course[]>([]);
  const [formData, setFormData] = useState({
    courseName: '',
    description: '',
    courseImageUrl: 'course-image-1.jpeg',
    selectedStudentIds: [] as string[],
  });

  const { profile } = useProfile();
  const tutorProfile = profile as Tutor;
  const { students } = useStudent();
  const { courses, loading: coursesLoading, createCourse, message } = useCourses();

  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Filter courses
  useEffect(() => {
    if (tutorProfile?.id && courses?.length) {
      const filtered = courses.filter(c => c.tutor.id === tutorProfile.id);
      setLocalCourses(filtered);
    }
  }, [courses, tutorProfile]);

  // Show toast/feedback
  useEffect(() => {
    if (message) {
      setFeedback(message);
      const timeout = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [message]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, selectedOptions } = e.target as HTMLSelectElement;
    if (name === 'selectedStudentIds') {
      const ids = Array.from(selectedOptions).map(opt => opt.value);
      setFormData(prev => ({ ...prev, selectedStudentIds: ids }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCreateCourse = async () => {
    setCreating(true);

    const enrolled = students.filter(s => formData.selectedStudentIds.includes(s.id));
    const newCourse: Course = {
      id: crypto.randomUUID(),
      name: formData.courseName,
      description: formData.description,
      imageUrl: formData.courseImageUrl,
      tutor: tutorProfile,
      students: enrolled,
      lessons: [],
      quizzes: [],
      tests: [],
      submissions: [],
      courseEvents: [],
    };

    await createCourse(newCourse);

    setFormData({
      courseName: '',
      description: '',
      courseImageUrl: 'course-image-1.jpeg',
      selectedStudentIds: [],
    });

    setIsOpen(false);
    setCreating(false);
  };

  return (
    <div className="px-6 py-8 bg-gray-50 min-h-screen space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800">Manage Courses</h1>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 transition"
        >
          <Plus className="w-5 h-5" />
          Create Course
        </button>
      </div>

      {feedback && (
        <div className="text-sm bg-sky-100 text-gray-800 px-4 py-2 border border-sky-300 mb-4">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {coursesLoading ? (
          <>
            <TutorCourseCardSkeleton />
            <TutorCourseCardSkeleton />
            <TutorCourseCardSkeleton />
            <TutorCourseCardSkeleton />
          </>
        ) : localCourses.length ? (
          localCourses.map((c, index) => (
            <TutorCourseCard key={index} c={c} />
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center p-10 bg-white border border-dashed border-gray-300 rounded-lg text-center shadow-sm">
            <ImageIcon className="w-12 h-12 text-gray-400 mb-3" />
            <h3 className="text-lg font-semibold text-gray-700">No Courses Available</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              You haven’t created any courses yet. Start by clicking the “Create Course” button above.
            </p>
            <button
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-500 transition"
            >
              <Plus className="w-4 h-4" />
              Create Your First Course
            </button>
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />

        <div className="bg-white w-full rounded-t-lg max-w-xl z-10 p-8 space-y-6 relative">
          {/* Banner Header */}
          <div
            className="relative h-32 -mt-8 -mx-8 mb-10 px-8 py-4 flex items-center bg-cover bg-center rounded-t-lg"
            style={{
              backgroundImage: `url("/images/${formData.courseImageUrl || 'course-image-1.jpeg'}")`,
            }}
          >
            <h2 className="absolute -bottom-4 left-4 text-xl text-orange-500 font-bold bg-white rounded-t-lg px-3 pt-1">
              Create New Course
            </h2>
          </div>

          {/* Form Inputs */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Course Name</label>
              <input
                type="text"
                name="courseName"
                value={formData.courseName}
                onChange={handleChange}
                className="mt-2 block w-full text-sm border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                name="description"
                rows={3}
                value={formData.description}
                onChange={handleChange}
                className="mt-2 block w-full text-sm border border-gray-300 px-3 py-2 resize-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course Banner</label>
              <select
                name="courseImageUrl"
                value={formData.courseImageUrl}
                onChange={handleChange}
                className="block w-full text-sm border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {[1, 2, 3, 4, 5, 6, 7].map(i => (
                  <option key={i} value={`course-image-${i}.jpeg`}>
                    course-image-{i}.jpeg
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Enroll Students</label>
              <select
                className="block w-full text-sm border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                value=""
                onChange={e => {
                  const studentId = e.target.value;
                  if (!formData.selectedStudentIds.includes(studentId)) {
                    setFormData(prev => ({
                      ...prev,
                      selectedStudentIds: [...prev.selectedStudentIds, studentId],
                    }));
                  }
                }}
              >
                <option value="" disabled>Select a student</option>
                {students
                  .filter(s => !formData.selectedStudentIds.includes(s.id))
                  .map(student => (
                    <option key={student.id} value={student.id}>
                      {student.fullName} ({student.email})
                    </option>
                  ))}
              </select>

              {/* Chips */}
              <div className="flex flex-wrap mt-3 gap-2">
                {formData.selectedStudentIds.map(studentId => {
                  const student = students.find(s => s.id === studentId);
                  if (!student) return null;

                  return (
                    <div
                      key={student.id}
                      className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1 text-sm text-gray-700 shadow-sm"
                    >
                      {student.imageUrl ? (
                        <Image
                          src={student.imageUrl}
                          alt={student.fullName}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 text-xs text-white flex items-center justify-center rounded-full bg-blue-400">
                          {student.fullName.charAt(0)}
                        </div>
                      )}
                      <span>{student.fullName}</span>
                      <button
                        onClick={() =>
                          setFormData(prev => ({
                            ...prev,
                            selectedStudentIds: prev.selectedStudentIds.filter(id => id !== student.id),
                          }))
                        }
                        className="ml-1 text-gray-400 hover:text-red-500 transition"
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-1 text-sm text-gray-600 hover:text-gray-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCourse}
              className="w-24 px-6 py-1 bg-blue-600 text-white text-sm hover:bg-blue-500 transition disabled:opacity-50"
              disabled={creating}
            >
              {creating ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                'Create'
              )}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
