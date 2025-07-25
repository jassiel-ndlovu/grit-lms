'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { useProfile } from './ProfileContext';

interface CoursesContextType {
  courses: Course[];
  loading: boolean;
  updateLoading: boolean;
  message: string | null;
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
  const [loading, setLoading] = useState<boolean>(false);
  const [updateLoading, setUpdateLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const { status } = useSession();
  const { profile } = useProfile();

  const fetchCourses = async () => {
    console.log("Fetching courses...");
    setLoading(true);
    try {
      const res = await axios.get('/api/courses');
      setCourses(res.data);
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const createCourse = async (course: Partial<Course>) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await axios.post('/api/courses', course);
      setCourses(prev => [...prev, res.data]);
      setMessage('Course created successfully');
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Failed to create course');
    } finally {
      setLoading(false);
    }
  };

  const updateCourse = async (courseId: string, updated: Partial<Course>) => {
    setLoading(true);
    setUpdateLoading(true);
    try {
      const payload: any = { ...updated };

    // Prisma-compatible format
    if (Array.isArray(updated.students)) {
      payload.students = {
        set: updated.students.map((s) => ({ id: s.id })),
      };
    }

    const res = await axios.put(`/api/courses/${courseId}`, payload);

      setCourses(prev =>
        prev.map(c => (c.id === courseId ? res.data : c))
      );
      setMessage('Course updated');
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Update failed');
    } finally {
      setLoading(false);
      setUpdateLoading(false);
    }
  };

  const deleteCourse = async (courseId: string) => {
    setLoading(true);
    try {
      await axios.delete(`/api/courses/${courseId}`);
      setCourses(prev => prev.filter(c => c.id !== courseId));
      setMessage('Course deleted');
    } catch (err: any) {
      setMessage(err.response?.data?.message || 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && profile) {
      fetchCourses();
    }
  }, [status, profile]);

  return (
    <CoursesContext.Provider
      value={{
        courses,
        fetchCourses,
        createCourse,
        updateCourse,
        deleteCourse,
        loading,
        updateLoading,
        message,
      }}
    >
      {children}
    </CoursesContext.Provider>
  );
};
