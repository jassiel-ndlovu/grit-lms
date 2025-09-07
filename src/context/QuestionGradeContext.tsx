/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import axios from "axios";
import { Message } from "@/lib/message.class";

interface QuestionGradeContextType {
  questionGrades: AppTypes.QuestionGrade[];
  loading: boolean;
  updating: boolean;
  message: Message | null;
  fetchQuestionGradesBySubmissionId: (submissionId: string) => Promise<void | AppTypes.QuestionGrade[]>;
  fetchQuestionGradesByTestId: (testId: string) => Promise<void | AppTypes.QuestionGrade[]>;
  fetchQuestionGradesByStudentIdSubmissionId: (studentId: string, submissionId: string) => Promise<void | AppTypes.QuestionGrade[]>;
  fetchQuestionGradesByStudentIdTestId: (studentId: string, testId: string) => Promise<void | AppTypes.QuestionGrade[]>;
  createQuestionGrade: (data: Partial<AppTypes.QuestionGrade>) => Promise<AppTypes.QuestionGrade | void>;
  updateQuestionGrade: (id: string, data: Partial<AppTypes.QuestionGrade>) => Promise<AppTypes.QuestionGrade | void>;
  deleteQuestionGrade: (id: string) => Promise<void>;
  clearMessage: () => void;
}

const QuestionGradeContext = createContext<QuestionGradeContextType | undefined>(undefined);

export const useQuestionGrades = () => {
  const context = useContext(QuestionGradeContext);
  if (!context) throw new Error("useQuestionGrades must be used within a QuestionGradeProvider");
  return context;
};

export const QuestionGradeProvider = ({ children }: { children: ReactNode }) => {
  const [questionGrades, setQuestionGrades] = useState<AppTypes.QuestionGrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  const fetchQuestionGradesBySubmissionId = useCallback(async (submissionId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/question-grades?submissionId=${submissionId}`);
      setQuestionGrades(res.data);
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to fetch question grades',
        { title: 'Fetch Error', duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQuestionGradesByTestId = useCallback(async (testId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/question-grades?testId=${testId}`);
      setQuestionGrades(res.data);
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to fetch question grades',
        { title: 'Fetch Error', duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQuestionGradesByStudentIdSubmissionId = useCallback(async (studentId: string, submissionId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/question-grades?studentId=${studentId}&submissionId=${submissionId}`);
      setQuestionGrades(res.data);
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to fetch question grades',
        { title: 'Fetch Error', duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQuestionGradesByStudentIdTestId = useCallback(async (studentId: string, testId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/question-grades?studentId=${studentId}&testId=${testId}`);
      setQuestionGrades(res.data);
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to fetch question grades',
        { title: 'Fetch Error', duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const createQuestionGrade = useCallback(async (data: Partial<AppTypes.QuestionGrade>) => {
    setLoading(true);
    clearMessage();
    try {
      const res = await axios.post(`/api/question-grades`, data);
      setQuestionGrades((prev) => [...prev, res.data]);
      setMessage(Message.success(
        'Question grade created successfully',
        { duration: 3000 }
      ));
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to create question grade',
        { title: 'Creation Error' }
      ));
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  const updateQuestionGrade = useCallback(async (id: string, data: Partial<AppTypes.QuestionGrade>) => {
    setLoading(true);
    setUpdating(true);
    clearMessage();
    try {
      const res = await axios.put(`/api/question-grades/${id}`, data);
      setQuestionGrades((prev) => prev.map((qg) => (qg.id === id ? res.data : qg)));
      setMessage(Message.success(
        'Question grade updated successfully',
        { duration: 3000 }
      ));
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to update question grade',
        { title: 'Update Error' }
      ));
    } finally {
      setLoading(false);
      setUpdating(false);
    }
  }, [clearMessage]);

  const deleteQuestionGrade = useCallback(async (id: string) => {
    setLoading(true);
    clearMessage();
    try {
      await axios.delete(`/api/question-grades/${id}`);
      setQuestionGrades((prev) => prev.filter((qg) => qg.id !== id));
      setMessage(Message.success(
        'Question grade deleted successfully',
        { duration: 3000 }
      ));
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to delete question grade',
        { title: 'Deletion Error' }
      ));
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  return (
    <QuestionGradeContext.Provider
      value={{
        questionGrades,
        loading,
        updating,
        message,
        fetchQuestionGradesBySubmissionId,
        fetchQuestionGradesByTestId,
        fetchQuestionGradesByStudentIdSubmissionId,
        fetchQuestionGradesByStudentIdTestId,
        createQuestionGrade,
        updateQuestionGrade,
        deleteQuestionGrade,
        clearMessage
      }}
    >
      {children}
    </QuestionGradeContext.Provider>
  );
};