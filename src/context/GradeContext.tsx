/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import axios from "axios";
import { Message } from "@/lib/message.class";

interface GradeContextType {
  grades: AppTypes.Grade[];
  loading: boolean;
  updating: boolean;
  message: Message | null;
  fetchGrades: () => Promise<void>;
  fetchGradesByStudentId: (studentId: string) => Promise<AppTypes.Grade[] | void>;
  fetchGradesByStudentIdTestSubId: (studentId: string, submissionId: string) => Promise<AppTypes.Grade | void>;
  fetchGradesByStudentIdEntryId: (studentId: string, submissionId: string) => Promise<AppTypes.Grade | void>;
  fetchGradesByCourseId: (courseId: string) => Promise<AppTypes.Grade[] | void>;
  fetchGradesByType: (type: string) => Promise<AppTypes.Grade[] | void>;
  createGrade: (data: Partial<AppTypes.Grade>) => Promise<AppTypes.Grade | void>;
  updateGrade: (id: string, data: Partial<AppTypes.Grade>) => Promise<AppTypes.Grade | void>;
  deleteGrade: (id: string) => Promise<void>;
  clearMessage: () => void;
}

const GradeContext = createContext<GradeContextType | undefined>(undefined);

export const useGrades = () => {
  const context = useContext(GradeContext);
  if (!context) {
    throw new Error("useGrades must be used within a GradeProvider");
  }
  return context;
};

export const GradeProvider = ({ children }: { children: ReactNode }) => {
  const [grades, setGrades] = useState<AppTypes.Grade[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const clearMessage = useCallback(() => setMessage(null), []);

  const fetchGrades = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.Grade[]>("/api/grades");
      setGrades(res.data);
    } catch (err: any) {
      setMessage(
        Message.error(err.response?.data?.message || "Failed to fetch grades", { title: "Fetch Error", duration: 5000 })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGradesByStudentId = useCallback(async (studentId: string) => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.Grade[]>(`/api/grades?studentId=${studentId}`);
      setGrades(res.data);
      return res.data;
    } catch (err: any) {
      setMessage(
        Message.error(err.response?.data?.message || "Failed to fetch grades by student", { title: "Fetch Error", duration: 5000 })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGradesByStudentIdEntryId = useCallback(async (studentId: string, entryId: string) => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.Grade>(`/api/grades/submission?studentId=${studentId}&entryId=${entryId}`);
      setGrades([res.data]);
      return res.data;
    } catch (err: any) {
      setMessage(
        Message.error(err.response?.data?.message || "Failed to fetch grades by student", { title: "Fetch Error", duration: 5000 })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGradesByStudentIdTestSubId = useCallback(async (studentId: string, submissionId: string) => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.Grade>(`/api/grades?studentId=${studentId}&submissionId=${submissionId}`);
      setGrades([res.data]);
      return res.data;
    } catch (err: any) {
      setMessage(
        Message.error(err.response?.data?.message || "Failed to fetch grades by student", { title: "Fetch Error", duration: 5000 })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGradesByCourseId = useCallback(async (courseId: string) => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.Grade[]>(`/api/grades?courseId=${courseId}`);
      setGrades(res.data);
      return res.data;
    } catch (err: any) {
      setMessage(
        Message.error(err.response?.data?.message || "Failed to fetch grades by course", { title: "Fetch Error", duration: 5000 })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGradesByType = useCallback(async (type: string) => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.Grade[]>(`/api/grades?type=${type}`);
      setGrades(res.data);
      return res.data;
    } catch (err: any) {
      setMessage(
        Message.error(err.response?.data?.message || "Failed to fetch grades by type", { title: "Fetch Error", duration: 5000 })
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const createGrade = useCallback(async (data: Partial<AppTypes.Grade>) => {
    setLoading(true);
    clearMessage();
    try {
      const res = await axios.post<AppTypes.Grade>("/api/grades", data);
      setGrades(prev => [...prev, res.data]);
      setMessage(Message.success("Grade created successfully", { duration: 3000 }));
      return res.data;
    } catch (err: any) {
      setMessage(
        Message.error(err.response?.data?.message || "Failed to create grade", { title: "Creation Error" })
      );
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  const updateGrade = useCallback(async (id: string, data: Partial<AppTypes.Grade>) => {
    setUpdating(true);
    clearMessage();
    try {
      const res = await axios.put<AppTypes.Grade>(`/api/grades/${id}`, data);
      setGrades(prev => prev.map(g => (g.id === id ? res.data : g)));
      setMessage(Message.success("Grade updated successfully", { duration: 3000 }));
      return res.data;
    } catch (err: any) {
      setMessage(
        Message.error(err.response?.data?.message || "Failed to update grade", { title: "Update Error" })
      );
    } finally {
      setUpdating(false);
    }
  }, [clearMessage]);

  const deleteGrade = useCallback(async (id: string) => {
    setLoading(true);
    clearMessage();
    try {
      await axios.delete(`/api/grades/${id}`);
      setGrades(prev => prev.filter(g => g.id !== id));
      setMessage(Message.success("Grade deleted successfully", { duration: 3000 }));
    } catch (err: any) {
      setMessage(
        Message.error(err.response?.data?.message || "Failed to delete grade", { title: "Deletion Error" })
      );
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  return (
    <GradeContext.Provider
      value={{
        grades,
        loading,
        updating,
        message,
        fetchGrades,
        fetchGradesByStudentId,
        fetchGradesByStudentIdEntryId,
        fetchGradesByStudentIdTestSubId,
        fetchGradesByCourseId,
        fetchGradesByType,
        createGrade,
        updateGrade,
        deleteGrade,
        clearMessage,
      }}
    >
      {children}
    </GradeContext.Provider>
  );
};
