/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import axios from "axios";
import { Message } from "@/lib/message.class";

interface LessonContextProps {
  lessons: AppTypes.Lesson[];
  loading: boolean;
  updating: boolean;
  message: Message | null;
  fetchLessons: (courseId: string) => Promise<void>;
  fetchLessonsByCourseId: (courseId: string) => Promise<AppTypes.Lesson[]>;
  createLesson: (courseId: string, data: Partial<AppTypes.Lesson>) => Promise<AppTypes.Lesson | null>;
  updateLesson: (lessonId: string, data: Partial<AppTypes.Lesson>) => Promise<AppTypes.Lesson | null>;
  deleteLesson: (lessonId: string) => Promise<boolean>;
  clearMessage: () => void;
}

const LessonContext = createContext<LessonContextProps | undefined>(undefined);

export const useLesson = () => {
  const context = useContext(LessonContext);
  if (!context) throw new Error("useLesson must be used inside LessonProvider");
  return context;
};

export const LessonProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lessons, setLessons] = useState<AppTypes.Lesson[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);
  const [message, setMessage] = useState<Message | null>(null);

  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  const fetchLessons = useCallback(async (courseId: string) => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/lessons?courseId=${courseId}`);
      setLessons(data);

    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to load lessons',
        { title: 'Fetch Error', duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLessonsByCourseId = useCallback(async (courseId: string) => {
    setLoading(true);
    clearMessage();
    try {
      const { data } = await axios.get(`/api/lessons?courseId=${courseId}`);
      setLessons(data);
      setMessage(Message.success(
        'Lessons loaded successfully',
        { duration: 3000 }
      ));
      return data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to load lessons',
        { title: 'Fetch Error', duration: 5000 }
      ));
      return [];
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  const createLesson = useCallback(async (courseId: string, lesson: Partial<AppTypes.Lesson>) => {
    setLoading(true);
    clearMessage();
    try {
      const { data } = await axios.post(`/api/lessons`, { ...lesson, courseId });
      setLessons((prev) => [...prev, data]);
      setMessage(Message.success(
        'Lesson created successfully',
        { duration: 3000 }
      ));
      return data;

    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to create lesson',
        { title: 'Creation Error' }
      ));
      return null;
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  const updateLesson = useCallback(async (lessonId: string, updatedData: Partial<AppTypes.Lesson>) => {
    setLoading(true);
    setUpdating(true);
    clearMessage();
    try {
      const { data } = await axios.put(`/api/lessons/${lessonId}`, updatedData);
      setLessons((prev) =>
        prev.map((l) => (l.id === lessonId ? data : l))
      );
      setMessage(Message.success(
        'Lesson updated successfully',
        { duration: 3000 }
      ));
      return data;

    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to update lesson',
        { title: 'Update Error' }
      ));
      return null;
    } finally {
      setLoading(false);
      setUpdating(false);
    }
  }, [clearMessage]);

  const deleteLesson = useCallback(async (lessonId: string) => {
    setLoading(true);
    clearMessage();
    try {
      await axios.delete(`/api/lessons/${lessonId}`);
      setLessons((prev) => prev.filter((l) => l.id !== lessonId));
      setMessage(Message.success(
        'Lesson deleted successfully',
        { duration: 3000 }
      ));
      return true;

    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to delete lesson',
        { title: 'Deletion Error' }
      ));
      return false;
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  return (
    <LessonContext.Provider
      value={{
        lessons,
        loading,
        updating,
        message,
        fetchLessons,
        fetchLessonsByCourseId,
        createLesson,
        updateLesson,
        deleteLesson,
        clearMessage
      }}
    >
      {children}
    </LessonContext.Provider>
  );
};