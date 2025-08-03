'use client';

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import { useProfile } from './ProfileContext';
import { Message } from '@/lib/message.class';

interface CoursesContextType {
  courses: Course[];
  loading: boolean;
  updating: boolean;
  message: Message | null;
  fetchCourses: () => Promise<void>;
  createCourse: (course: Partial<Course>) => Promise<void>;
  updateCourse: (courseId: string, updated: Partial<Course>) => Promise<void>;
  deleteCourse: (courseId: string) => Promise<void>;
  clearMessage: () => void;
}

const CoursesContext = createContext<CoursesContextType | undefined>(undefined);

export const useCourses = () => {
  const context = useContext(CoursesContext);
  if (!context) throw new Error('useCourses must be used within a CoursesProvider');
  return context;
};

export const CoursesProvider = ({ children }: { children: ReactNode }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);
  const [message, setMessage] = useState<Message | null>(null);

  const { status } = useSession();
  const { profile } = useProfile();

  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/courses');
      setCourses(res.data);
      // @ts-ignore
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to load courses',
        { title: 'Fetch Error', duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const createCourse = useCallback(async (course: Partial<Course>) => {
    setLoading(true);
    clearMessage();
    try {
      const res = await axios.post('/api/courses', course);
      setCourses(prev => [...prev, res.data]);
      setMessage(Message.success(
        'Course created successfully',
        { duration: 3000 }
      ));
      // @ts-ignore
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to create course',
        { title: 'Creation Error' }
      ));
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  const updateCourse = useCallback(async (courseId: string, updated: Partial<Course>) => {
    setLoading(true);
    setUpdating(true);
    clearMessage();
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
      setMessage(Message.success(
        'Course updated successfully',
        { duration: 3000 }
      ));
      // @ts-ignore
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Update failed',
        { title: 'Update Error' }
      ));
    } finally {
      setLoading(false);
      setUpdating(false);
    }
  }, [clearMessage]);

  const deleteCourse = useCallback(async (courseId: string) => {
    setLoading(true);
    clearMessage();
    try {
      await axios.delete(`/api/courses/${courseId}`);
      setCourses(prev => prev.filter(c => c.id !== courseId));
      setMessage(Message.success(
        'Course deleted successfully',
        { duration: 3000 }
      ));
      // @ts-ignore
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Delete failed',
        { title: 'Deletion Error' }
      ));
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  useEffect(() => {
    if (status === 'authenticated' && profile) {
      fetchCourses();
    }
  }, [status, profile, fetchCourses]);

  return (
    <CoursesContext.Provider
      value={{
        courses,
        fetchCourses,
        createCourse,
        updateCourse,
        deleteCourse,
        loading,
        updating,
        message,
        clearMessage,
      }}
    >
      {children}
    </CoursesContext.Provider>
  );
};