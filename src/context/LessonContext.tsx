"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

interface LessonContextProps {
  lessons: Lesson[];
  fetchLessons: (courseId: string) => Promise<void>;
  createLesson: (courseId: string, data: Partial<Lesson>) => Promise<Lesson | null>;
  updateLesson: (lessonId: string, data: Partial<Lesson>) => Promise<Lesson | null>;
  deleteLesson: (lessonId: string) => Promise<boolean>;
}

const LessonContext = createContext<LessonContextProps | undefined>(undefined);

export const useLesson = () => {
  const context = useContext(LessonContext);
  if (!context) throw new Error("useLessonContext must be used inside LessonProvider");
  return context;
};

export const LessonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);

  const fetchLessons = async (courseId: string) => {
    const { data } = await axios.get(`/api/lessons?courseId=${courseId}`);
    setLessons(data);
  };

  const createLesson = async (courseId: string, lesson: Partial<Lesson>) => {
    try {
      const { data } = await axios.post(`/api/lessons`, { ...lesson, courseId });
      setLessons((prev) => [...prev, data]);
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const updateLesson = async (lessonId: string, updatedData: Partial<Lesson>) => {
    try {
      const { data } = await axios.put(`/api/lessons/${lessonId}`, updatedData);
      setLessons((prev) =>
        prev.map((l) => (l.id === lessonId ? data : l))
      );
      return data;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const deleteLesson = async (lessonId: string) => {
    try {
      await axios.delete(`/api/lessons/${lessonId}`);
      setLessons((prev) => prev.filter((l) => l.id !== lessonId));
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  return (
    <LessonContext.Provider
      value={{ lessons, fetchLessons, createLesson, updateLesson, deleteLesson }}
    >
      {children}
    </LessonContext.Provider>
  );
};
