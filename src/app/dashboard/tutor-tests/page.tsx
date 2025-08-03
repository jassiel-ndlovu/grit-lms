'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Plus, Search, Filter } from 'lucide-react';
import { useCourses } from '@/context/CourseContext';
import { useTests } from '@/context/TestContext';
import { useProfile } from '@/context/ProfileContext';
import CreateTestDialog from './models/create-test-dialog';
import { TestCardSkeleton } from './models/test-card-skeleton';
import TestCard from './models/test-card';

export default function TutorTestsPage() {
  const { courses } = useCourses();
  const { tests, fetchTestsByTutorId, createTest, deleteTest, loading: testLoading } = useTests();
  const { profile } = useProfile();

  const tutorProfile: Tutor = profile as Tutor;

  const [filteredTests, setFilteredTests] = useState<Test[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [testsLoading, setTestsLoading] = useState<boolean>(true);

  const tutorCourses = useMemo(() => {
    return courses.filter(course => course.tutor.id === tutorProfile.id);
  }, [courses, tutorProfile]);

  // ✅ Fetch tests when tutorProfile is ready
  useEffect(() => {
    if (tutorProfile?.id) {
      fetchTestsByTutorId(tutorProfile.id);
    }
  }, [fetchTestsByTutorId, tutorProfile?.id, tutorCourses]);

  const tutorTests = useMemo(() => {
    return tests.filter(test => tutorCourses.find(c => c.id === test.courseId));
  }, [tests, tutorCourses]);

  useEffect(() => {
    const filtered = tests.filter(test =>
      tutorCourses.some(course => course.id === test.courseId)
    );
    setFilteredTests(filtered);
  }, [tutorTests]);

  // ✅ Handle filtering logic
  useEffect(() => {
    setTestsLoading(true);
    const timeout = setTimeout(() => {
      let filtered = tutorTests;
      if (searchTerm) {
        filtered = filtered.filter(test =>
          test.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          test.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      if (selectedCourse) {
        filtered = filtered.filter(test => test.courseId === selectedCourse);
      }
      setFilteredTests(filtered);
      setTestsLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm, selectedCourse]);

  const handleCreateTest = async (courseId: string, testData: Partial<Test>) => {
    setLoading(true);
    try {
      await createTest(courseId, testData);
      setShowCreateDialog(false);
    } catch (error) {
      console.error('Error creating test:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTest = async (testId: string) => {
    try {
      await deleteTest(testId);
    } catch (error) {
      console.error('Error deleting test:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Test Management</h1>
          <p className="text-gray-600 text-sm">Manage tests for your courses</p>
        </div>

        {/* Controls */}
        <div className="bg-white border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-[calc(50%-2px)] transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search tests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="text-sm pl-10 pr-4 py-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
                />
              </div>
              {/* Course Filter */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="w-full pl-10 pr-8 py-2 border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:w-48"
                >
                  <option value="">All Courses</option>
                  {tutorCourses.map(course => (
                    <option key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Test
            </button>
          </div>
        </div>

        {/* Skeleton while loading */}
        {testsLoading || testLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <TestCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTests.map(test => (
              <TestCard 
                key={test.id}
                test={test}
                course={courses.find(c => c.id === test.courseId)}
                deleteTest={handleDeleteTest}
              />
            ))}
          </div>
        )}

        {filteredTests && filteredTests.length === 0 && !testsLoading && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tests found</h3>
            <p className="text-gray-600 text-sm mb-4">
              {searchTerm || selectedCourse
                ? "Try adjusting your search or filter criteria"
                : "Create your first test to get started"}
            </p>
            {!searchTerm && !selectedCourse && (
              <button
                onClick={() => setShowCreateDialog(true)}
                className="inline-flex items-center gap-2 text-sm px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Test
              </button>
            )}
          </div>
        )}

        {showCreateDialog && (
          <CreateTestDialog
            onClose={() => setShowCreateDialog(false)}
            onSave={handleCreateTest}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
