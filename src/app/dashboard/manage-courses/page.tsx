'use client';

import { Plus, Pencil, Users, FileText, Layers } from 'lucide-react';
import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import Image from 'next/image';

type Course = {
  id: string;
  courseName: string;
  description: string;
  level: string;
  category: string;
  imageUrl?: string;
};

export default function ManageCoursesPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]); // Replace with fetched data later
  const [formData, setFormData] = useState({
    courseName: '',
    description: '',
    level: '',
    category: '',
    imageUrl: ''
  });

  const handleCreateCourse = () => {
    // You will replace this with your API call
    const newCourse = {
      ...formData,
      id: crypto.randomUUID()
    };
    setCourses(prev => [...prev, newCourse]);
    setIsOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="px-6 py-8 space-y-8 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800">Manage Courses</h1>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition"
        >
          <Plus className="w-4 h-4" />
          Create Course
        </button>
      </div>

      {/* Course List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.length > 0 ? (
          courses.map(course => (
            <div key={course.id} className="bg-white rounded-xl shadow border border-gray-200 p-4 space-y-4">
              {course.imageUrl && (
                <div className="w-full h-32 relative">
                  <Image src={course.imageUrl} alt="Course" fill className="object-cover rounded-md" />
                </div>
              )}
              <h2 className="text-lg font-semibold text-gray-800">{course.courseName}</h2>
              <p className="text-sm text-gray-600">{course.description}</p>
              <div className="text-xs text-gray-500">Level: {course.level} | Category: {course.category}</div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button className="text-sm px-3 py-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100">
                  <Layers className="w-4 h-4 inline mr-1" />
                  Add Content
                </button>
                <button className="text-sm px-3 py-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100">
                  <Users className="w-4 h-4 inline mr-1" />
                  Manage Students
                </button>
                <button className="text-sm px-3 py-1 rounded bg-yellow-50 text-yellow-600 hover:bg-yellow-100">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Create Test
                </button>
                <button className="text-sm px-3 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">
                  <Pencil className="w-4 h-4 inline mr-1" />
                  Edit
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500">No courses created yet.</p>
        )}
      </div>

      {/* Create Course Modal */}
      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white w-full max-w-md p-6 rounded-xl shadow-lg">
            <Dialog.Title className="text-xl font-bold mb-4">Create a New Course</Dialog.Title>
            <div className="space-y-4">
              <input
                type="text"
                name="courseName"
                placeholder="Course Name"
                value={formData.courseName}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
              <textarea
                name="description"
                placeholder="Course Description"
                value={formData.description}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
              <select
                name="level"
                value={formData.level}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              >
                <option value="">Select Level</option>
                <option value="Grade 10">Grade 10</option>
                <option value="Grade 11">Grade 11</option>
                <option value="Grade 12">Grade 12</option>
              </select>
              <input
                type="text"
                name="category"
                placeholder="Category (e.g. IT, Maths)"
                value={formData.category}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
              <input
                type="text"
                name="imageUrl"
                placeholder="Image URL (optional)"
                value={formData.imageUrl}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCourse}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-500"
              >
                Create
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
