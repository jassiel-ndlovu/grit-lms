'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

interface CoursesContextType {
  courses: Course[];
  fetchCourses: () => Promise<void>;
  createCourse: (course: Partial<Course>) => Promise<void>;
  updateCourse: (courseId: string, updated: Partial<Course>) => Promise<void>;
  deleteCourse: (courseId: string) => Promise<void>;
}

const CoursesContext = createContext<CoursesContextType | undefined>(undefined);

export const useCourses = () => {
  const context = useContext(CoursesContext);
  if (!context) throw new Error('useCourses must be used within a CoursesProvider');
  return context;
};

export const CoursesProvider = ({ children }: { children: React.ReactNode }) => {
  const [courses, setCourses] = useState<Course[]>([]);

  const fetchCourses = async () => {
    const res = await axios.get('/api/courses');
    setCourses(res.data);
  };

  const createCourse = async (course: Partial<Course>) => {
    const res = await axios.post('/api/courses', course);
    setCourses(prev => [...prev, res.data]);
  };

  const updateCourse = async (courseId: string, updated: Partial<Course>) => {
    const res = await axios.put(`/api/courses/${courseId}`, updated);
    setCourses(prev =>
      prev.map(c => (c.courseId === courseId ? res.data : c))
    );
  };

  const deleteCourse = async (courseId: string) => {
    await axios.delete(`/api/courses/${courseId}`);
    setCourses(prev => prev.filter(c => c.courseId !== courseId));
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  return (
    <CoursesContext.Provider
      value={{ courses, fetchCourses, createCourse, updateCourse, deleteCourse }}
    >
      {children}
    </CoursesContext.Provider>
  );
};
