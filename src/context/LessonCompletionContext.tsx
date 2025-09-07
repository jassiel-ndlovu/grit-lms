/* eslint-disable @typescript-eslint/no-explicit-any */ 
"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import axios from "axios";
import { Message } from "@/lib/message.class";

interface LessonCompletionContextType {
  completions: AppTypes.LessonCompletion[];
  currentCompletion: AppTypes.LessonCompletion | null;
  loading: boolean;
  updating: boolean;
  message: Message | null;

  fetchCompletionsByStudent: (studentId: string) => Promise<AppTypes.LessonCompletion[] | void>;
  fetchCompletionsByLesson: (lessonId: string) => Promise<AppTypes.LessonCompletion[] | void>;
  fetchCompletionByStudentAndLesson: (studentId: string, lessonId: string) => Promise<AppTypes.LessonCompletion | void>;
  fetchCompletionById: (completionId: string) => Promise<AppTypes.LessonCompletion | void>;

  createCompletion: (data: Partial<AppTypes.LessonCompletion>) => Promise<AppTypes.LessonCompletion | void>;
  updateCompletion: (completionId: string, updates: Partial<AppTypes.LessonCompletion>) => Promise<AppTypes.LessonCompletion | void>;
  deleteCompletion: (completionId: string) => Promise<void>;

  clearMessage: () => void;
}

const LessonCompletionContext = createContext<LessonCompletionContextType | undefined>(undefined);

export const useLessonCompletions = () => {
  const context = useContext(LessonCompletionContext);
  if (!context) throw new Error("useLessonCompletions must be used within a LessonCompletionProvider");
  return context;
};

export const LessonCompletionProvider = ({ children }: { children: ReactNode }) => {
  const [completions, setCompletions] = useState<AppTypes.LessonCompletion[]>([]);
  const [currentCompletion, setCurrentCompletion] = useState<AppTypes.LessonCompletion | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  // --- FETCHES ---
  const fetchCompletionsByStudent = useCallback(async (studentId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/lesson-completions?studentId=${studentId}`);
      setCompletions(res.data);
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(err.response?.data?.message || "Failed to fetch completions", { title: "Fetch Error" }));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCompletionsByLesson = useCallback(async (lessonId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/lesson-completions?lessonId=${lessonId}`);
      setCompletions(res.data);
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(err.response?.data?.message || "Failed to fetch completions", { title: "Fetch Error" }));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCompletionByStudentAndLesson = useCallback(async (studentId: string, lessonId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/lesson-completions?studentId=${studentId}&lessonId=${lessonId}`);
      setCurrentCompletion(res.data);
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(err.response?.data?.message || "Failed to fetch completion", { title: "Fetch Error" }));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCompletionById = useCallback(async (completionId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/lesson-completions/${completionId}`);
      setCurrentCompletion(res.data);
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(err.response?.data?.message || "Failed to fetch completion", { title: "Fetch Error" }));
    } finally {
      setLoading(false);
    }
  }, []);

  // --- CRUD ---
  const createCompletion = useCallback(async (data: Partial<AppTypes.LessonCompletion>) => {
    setLoading(true);
    clearMessage();
    try {
      const res = await axios.post(`/api/lesson-completions`, data);
      setCompletions((prev) => [...prev, res.data]);
      setMessage(Message.success("Lesson completion created successfully"));
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(err.response?.data?.message || "Failed to create completion", { title: "Creation Error" }));
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  const updateCompletion = useCallback(async (completionId: string, updates: Partial<AppTypes.LessonCompletion>) => {
    setLoading(true);
    setUpdating(true);
    clearMessage();
    try {
      const res = await axios.put(`/api/lesson-completions/${completionId}`, updates);
      setCompletions((prev) => prev.map(c => c.id === completionId ? res.data : c));
      setMessage(Message.success("Lesson completion updated successfully"));
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(err.response?.data?.message || "Failed to update completion", { title: "Update Error" }));
    } finally {
      setLoading(false);
      setUpdating(false);
    }
  }, [clearMessage]);

  const deleteCompletion = useCallback(async (completionId: string) => {
    setLoading(true);
    clearMessage();
    try {
      await axios.delete(`/api/lesson-completions/${completionId}`);
      setCompletions((prev) => prev.filter(c => c.id !== completionId));
      setMessage(Message.success("Lesson completion deleted successfully"));
    } catch (err: any) {
      setMessage(Message.error(err.response?.data?.message || "Failed to delete completion", { title: "Deletion Error" }));
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  return (
    <LessonCompletionContext.Provider
      value={{
        completions,
        currentCompletion,
        loading,
        updating,
        message,
        fetchCompletionsByStudent,
        fetchCompletionsByLesson,
        fetchCompletionByStudentAndLesson,
        fetchCompletionById,
        createCompletion,
        updateCompletion,
        deleteCompletion,
        clearMessage,
      }}
    >
      {children}
    </LessonCompletionContext.Provider>
  );
};
