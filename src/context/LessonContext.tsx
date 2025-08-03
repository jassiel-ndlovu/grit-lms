"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import axios from "axios";
import { Message } from "@/lib/message.class";

interface LessonContextProps {
  lessons: Lesson[];
  loading: boolean;
  updating: boolean;
  message: Message | null;
  fetchLessons: (courseId: string) => Promise<void>;
  createLesson: (courseId: string, data: Partial<Lesson>) => Promise<Lesson | null>;
  updateLesson: (lessonId: string, data: Partial<Lesson>) => Promise<Lesson | null>;
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
  const [lessons, setLessons] = useState<Lesson[]>([]);
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
      // @ts-ignore
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to load lessons',
        { title: 'Fetch Error', duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const createLesson = useCallback(async (courseId: string, lesson: Partial<Lesson>) => {
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
      // @ts-ignore
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

  const updateLesson = useCallback(async (lessonId: string, updatedData: Partial<Lesson>) => {
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
      // @ts-ignore
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
      // @ts-ignore
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