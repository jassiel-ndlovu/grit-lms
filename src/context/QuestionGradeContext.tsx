"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import axios from "axios";

type QuestionGradeContextType = {
  questionGrades: AppTypes.QuestionGrade[];
  fetchQuestionGradesBySubmissionId: (submissionId: string) => Promise<AppTypes.QuestionGrade[]>;
  fetchQuestionGradesByTestId: (testId: string) => Promise<AppTypes.QuestionGrade[]>;
  fetchQuestionGradesByStudentIdSubmissionId: (studentId: string, submissionId: string) => Promise<AppTypes.QuestionGrade[]>;
  fetchQuestionGradesByStudentIdTestId: (studentId: string, testId: string) => Promise<AppTypes.QuestionGrade[]>;
  createQuestionGrade: (data: Partial<AppTypes.QuestionGrade>) => Promise<AppTypes.QuestionGrade>;
  updateQuestionGrade: (id: string, data: Partial<AppTypes.QuestionGrade>) => Promise<AppTypes.QuestionGrade>;
  deleteQuestionGrade: (id: string) => Promise<void>;
};

const QuestionGradeContext = createContext<QuestionGradeContextType | undefined>(undefined);

export function QuestionGradeProvider({ children }: { children: React.ReactNode }) {
  const [questionGrades, setQuestionGrades] = useState<AppTypes.QuestionGrade[]>([]);

  const fetchQuestionGradesBySubmissionId = useCallback(async (submissionId: string) => {
    const res = await axios.get(`/api/question-grades/submission/${submissionId}`);
    setQuestionGrades(res.data);
    return res.data;
  }, []);

  const fetchQuestionGradesByTestId = useCallback(async (testId: string) => {
    const res = await axios.get(`/api/question-grades/test/${testId}`);
    setQuestionGrades(res.data);
    return res.data;
  }, []);

  const fetchQuestionGradesByStudentIdSubmissionId = useCallback(async (studentId: string, submissionId: string) => {
    const res = await axios.get(`/api/question-grades?studentId=${studentId}&submissionId=${submissionId}`);
    setQuestionGrades(res.data);
    return res.data;
  }, []);

  const fetchQuestionGradesByStudentIdTestId = useCallback(async (studentId: string, testId: string) => {
    const res = await axios.get(`/api/question-grades?studentId=${studentId}&testId=${testId}`);
    setQuestionGrades(res.data);
    return res.data;
  }, []);

  const createQuestionGrade = useCallback(async (data: Partial<AppTypes.QuestionGrade>) => {
    const res = await axios.post(`/api/question-grades`, data);
    setQuestionGrades((prev) => [...prev, res.data]);
    return res.data;
  }, []);

  const updateQuestionGrade = useCallback(async (id: string, data: Partial<AppTypes.QuestionGrade>) => {
    const res = await axios.put(`/api/question-grades/${id}`, data);
    setQuestionGrades((prev) =>
      prev.map((qg) => (qg.id === id ? res.data : qg))
    );
    return res.data;
  }, []);

  const deleteQuestionGrade = useCallback(async (id: string) => {
    await axios.delete(`/api/question-grades/${id}`);
    setQuestionGrades((prev) => prev.filter((qg) => qg.id !== id));
  }, []);

  return (
    <QuestionGradeContext.Provider
      value={{
        questionGrades,
        fetchQuestionGradesBySubmissionId,
        fetchQuestionGradesByTestId,
        fetchQuestionGradesByStudentIdSubmissionId,
        fetchQuestionGradesByStudentIdTestId,
        createQuestionGrade,
        updateQuestionGrade,
        deleteQuestionGrade,
      }}
    >
      {children}
    </QuestionGradeContext.Provider>
  );
}

export function useQuestionGrades() {
  const context = useContext(QuestionGradeContext);
  if (!context) throw new Error("useQuestionGrades must be used within QuestionGradeProvider");
  return context;
}