'use client';

import { Plus, Pencil, Users, FileText, Layers, ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import Image from 'next/image';
import { useProfile } from '@/context/ProfileContext';
import { useStudent } from '@/context/StudentContext'; // pulling list of students

export default function ManageCoursesPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const { students } = useStudent();

  const emptyForm = {
    courseName: '',
    description: '',
    courseImageUrl: '',
    selectedStudentIds: [] as string[],
  };
  const [formData, setFormData] = useState(emptyForm);

  const { profile } = useProfile();
  const tutorProfile = profile as Tutor;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, selectedOptions } = e.target as HTMLSelectElement;
    if (name === 'selectedStudentIds') {
      const ids = Array.from(selectedOptions).map(opt => opt.value);
      setFormData(prev => ({ ...prev, selectedStudentIds: ids }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCreateCourse = () => {
    const enrolled = students.filter(s => formData.selectedStudentIds.includes(s.id));
    const newCourse: Course = {
      courseId: crypto.randomUUID(),
      courseName: formData.courseName,
      description: formData.description,
      courseImageUrl: formData.courseImageUrl,
      tutor: tutorProfile,
      enrolledStudents: enrolled,
      lessons: [],
      activeQuizzes: [],
      activeTests: [],
      activeSubmissions: [],
      courseEvents: [],
    };

    setCourses(prev => [...prev, newCourse]);
    setFormData(emptyForm);
    setIsOpen(false);
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.length ? (
          courses.map(c => (
            <div key={c.courseId} className="bg-white rounded-xl shadow hover:shadow-md transition p-5 space-y-4">
              {c.courseImageUrl ? (
                <div className="w-full h-36 relative rounded-lg overflow-hidden">
                  <Image src={c.courseImageUrl} alt="" fill className="object-cover" />
                </div>
              ) : (
                <div className="w-full h-36 bg-gray-200 flex items-center justify-center rounded-lg">
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <h2 className="text-lg font-semibold text-gray-900">{c.courseName}</h2>
              <p className="text-gray-600 text-sm line-clamp-3">{c.description}</p>
              <div className="text-xs text-gray-500">
                Students Enrolled: {c.enrolledStudents.length}
              </div>
              <div className="flex flex-wrap gap-2 pt-3">
                {[
                  ['Add Content', Layers, 'bg-indigo-50 text-indigo-600'],
                  ['Manage Students', Users, 'bg-emerald-50 text-emerald-600'],
                  ['Create Test', FileText, 'bg-yellow-50 text-yellow-600'],
                  ['Edit', Pencil, 'bg-blue-50 text-blue-600']
                ].map(([label, Icon, style], index) => (
                  <button key={index} className={`flex items-center gap-1 px-3 py-1 rounded ${style} hover:opacity-90 transition text-sm`}>
                    <Icon className="w-4 h-4" />
                    {label as string}
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-600 text-sm">No courses created yet.</p>
        )}
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />

        <div className="bg-white w-full max-w-xl z-10 p-8 space-y-6 relative">
          <h2 className="text-2xl font-bold text-gray-800">Create New Course</h2>

          <div className="space-y-5">
            {/* Course Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Course Name</label>
              <input
                type="text"
                name="courseName"
                value={formData.courseName}
                onChange={handleChange}
                className="mt-2 block w-full border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                name="description"
                rows={3}
                value={formData.description}
                onChange={handleChange}
                className="mt-2 block w-full border border-gray-300 px-3 py-2 resize-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Image URL</label>
              <input
                type="text"
                name="courseImageUrl"
                value={formData.courseImageUrl}
                onChange={handleChange}
                className="mt-2 block w-full border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Student Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Enroll Students</label>
              <div className="flex gap-2">
                <select
                  className="flex-1 border border-gray-300 px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
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
              </div>

              {/* Selected Students Chips */}
              {formData.selectedStudentIds.length > 0 && (
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
                          <div className="w-4 h-4 p-3 text-sm text-white flex items-center justify-center rounded-full bg-blue-400">
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
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCourse}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-500 transition"
            >
              Create
            </button>
          </div>
        </div>
      </Dialog>

    </div>
  );
}
