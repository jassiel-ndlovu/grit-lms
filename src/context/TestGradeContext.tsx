/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import axios from "axios";
import { Message } from "@/lib/message.class";

interface TestGradeContextType {
  grades: AppTypes.Grade[];
  loading: boolean;
  updating: boolean;
  message: Message | null;
  fetchGrades: () => Promise<void>;
  fetchGradesByStudentId: (studentId: string) => Promise<void>;
  fetchGradesByCourseId: (courseId: string) => Promise<void>;
  fetchGradesByStudentAndCourse: (studentId: string, courseId: string) => Promise<void>;
  fetchGradeById: (id: string) => Promise<AppTypes.Grade | void>;
  fetchGradesByType: (type: string, courseId?: string) => Promise<void>;
  createGrade: (data: Partial<AppTypes.Grade>) => Promise<AppTypes.Grade | void>;
  updateGrade: (id: string, data: Partial<AppTypes.Grade>) => Promise<AppTypes.Grade | void>;
  deleteGrade: (id: string) => Promise<void>;
  clearMessage: () => void;
}

const TestGradeContext = createContext<TestGradeContextType | undefined>(undefined);

export const useGrades = () => {
  const context = useContext(TestGradeContext);
  if (!context) {
    throw new Error("useGrades must be used within a TestGradeProvider");
  }
  return context;
};

export const TestGradeProvider = ({ children }: { children: ReactNode }) => {
  const [grades, setGrades] = useState<AppTypes.Grade[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  const fetchGrades = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.Grade[]>("/api/grades");
      setGrades(res.data);
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to fetch grades",
        { title: "Fetch Error", duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGradesByStudentId = useCallback(async (studentId: string) => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.Grade[]>(`/api/grades?studentId=${studentId}`);
      setGrades(res.data);
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to fetch grades by student ID",
        { title: "Fetch Error", duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGradesByCourseId = useCallback(async (courseId: string) => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.Grade[]>(`/api/grades?courseId=${courseId}`);
      setGrades(res.data);
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to fetch grades by course ID",
        { title: "Fetch Error", duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGradesByStudentAndCourse = useCallback(async (studentId: string, courseId: string) => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.Grade[]>(
        `/api/grades?studentId=${studentId}&courseId=${courseId}`
      );
      setGrades(res.data);
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to fetch grades by student and course",
        { title: "Fetch Error", duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGradeById = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.Grade>(`/api/grades/${id}`);
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to fetch grade by ID",
        { title: "Fetch Error", duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGradesByType = useCallback(async (type: string, courseId?: string) => {
    setLoading(true);
    try {
      const url = courseId 
        ? `/api/grades?type=${type}&courseId=${courseId}`
        : `/api/grades?type=${type}`;
      
      const res = await axios.get<AppTypes.Grade[]>(url);
      setGrades(res.data);
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to fetch grades by type",
        { title: "Fetch Error", duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const createGrade = useCallback(async (data: Partial<AppTypes.Grade>) => {
    setUpdating(true);
    clearMessage();
    try {
      const res = await axios.post<AppTypes.Grade>("/api/grades", data);
      setGrades(prev => [...prev, res.data]);
      setMessage(Message.success(
        "Grade created successfully",
        { duration: 3000 }
      ));
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to create grade",
        { title: "Creation Error" }
      ));
    } finally {
      setUpdating(false);
    }
  }, [clearMessage]);

  const updateGrade = useCallback(async (id: string, data: Partial<AppTypes.Grade>) => {
    setUpdating(true);
    clearMessage();
    try {
      const res = await axios.put<AppTypes.Grade>(`/api/grades/${id}`, data);
      setGrades(prev => prev.map(grade => (grade.id === id ? res.data : grade)));
      setMessage(Message.success(
        "Grade updated successfully",
        { duration: 3000 }
      ));
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to update grade",
        { title: "Update Error" }
      ));
    } finally {
      setUpdating(false);
    }
  }, [clearMessage]);

  const deleteGrade = useCallback(async (id: string) => {
    setUpdating(true);
    clearMessage();
    try {
      await axios.delete(`/api/grades/${id}`);
      setGrades(prev => prev.filter(grade => grade.id !== id));
      setMessage(Message.success(
        "Grade deleted successfully",
        { duration: 3000 }
      ));
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to delete grade",
        { title: "Deletion Error" }
      ));
    } finally {
      setUpdating(false);
    }
  }, [clearMessage]);

  return (
    <TestGradeContext.Provider
      value={{
        grades,
        loading,
        updating,
        message,
        fetchGrades,
        fetchGradesByStudentId,
        fetchGradesByCourseId,
        fetchGradesByStudentAndCourse,
        fetchGradeById,
        fetchGradesByType,
        createGrade,
        updateGrade,
        deleteGrade,
        clearMessage
      }}
    >
      {children}
    </TestGradeContext.Provider>
  );
};