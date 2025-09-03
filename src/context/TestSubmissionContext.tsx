/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import axios from "axios";
import { Message } from "@/lib/message.class";

interface TestSubmissionContextType {
  testSubmissions: AppTypes.TestSubmission[];
  loading: boolean;
  updating: boolean;
  message: Message | null;
  fetchSubmissions: () => Promise<void>;
  fetchSubmissionsByTestId: (testId: string) => Promise<void | AppTypes.TestSubmission[]>;
  fetchSubmissionsByStudentId: (studentId: string) => Promise<void>;
  fetchSubmissionByStudentTestId: (studentId: string, testId: string) => Promise<AppTypes.TestSubmission | void>;
  fetchSubmissionByIds: (ids: string[]) => Promise<AppTypes.TestSubmission | void>;
  createSubmission: (data: Partial<AppTypes.TestSubmission>) => Promise<AppTypes.TestSubmission | void>;
  updateSubmission: (id: string, data: Partial<AppTypes.TestSubmission>) => Promise<AppTypes.TestSubmission | void>;
  deleteSubmission: (id: string) => Promise<void>;
  clearMessage: () => void;
}

const TestSubmissionContext = createContext<TestSubmissionContextType | undefined>(undefined);

export const useTestSubmissions = () => {
  const context = useContext(TestSubmissionContext);
  if (!context) {
    throw new Error("useTestSubmissions must be used within a TestSubmissionProvider");
  }
  return context;
};

export const TestSubmissionProvider = ({ children }: { children: ReactNode }) => {
  const [testSubmissions, setTestSubmissions] = useState<AppTypes.TestSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.TestSubmission[]>("/api/test-submission");
      setTestSubmissions(res.data);
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to fetch submissions",
        { title: "Fetch Error", duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSubmissionsByTestId = useCallback(async (testId: string) => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.TestSubmission[]>(`/api/test-submission?testId=${testId}`);
      
      setTestSubmissions(res.data);
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to fetch submissions by test ID",
        { title: "Fetch Error", duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSubmissionByStudentTestId = useCallback(async (studentId: string, testId: string) => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.TestSubmission>(`/api/test-submission?studentId=${studentId}&testId=${testId}`);
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to fetch submission by student and test ID",
        { title: "Fetch Error", duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSubmissionsByStudentId = useCallback(async (studentId: string) => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.TestSubmission[]>(`/api/test-submission?studentId=${studentId}`);
      setTestSubmissions(res.data);
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to fetch submissions by student ID",
        { title: "Fetch Error", duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSubmissionByIds = useCallback(async (ids: string[]) => {
    setLoading(true);
    try {
      const idString = ids.join(",");
      const res = await axios.get<AppTypes.TestSubmission>(`/api/test-submission?submissionIds=${idString}`);
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to fetch submissions by IDs",
        { title: "Fetch Error", duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const createSubmission = useCallback(async (data: Partial<AppTypes.TestSubmission>) => {
    setLoading(true);
    clearMessage();
    try {
      const res = await axios.post<AppTypes.TestSubmission>("/api/test-submission", data);
      setTestSubmissions(prev => [...prev, res.data]);
      setMessage(Message.success(
        "Submission created successfully",
        { duration: 3000 }
      ));
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to create submission",
        { title: "Creation Error" }
      ));
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  const updateSubmission = useCallback(async (id: string, data: Partial<AppTypes.TestSubmission>) => {
    // setUpdating(true);
    clearMessage();
    try {
      const res = await axios.put<AppTypes.TestSubmission>(`/api/test-submission/${id}`, data);
      setTestSubmissions(prev => prev.map(sub => (sub.id === id ? res.data : sub)));
      setMessage(Message.success(
        "Submission updated successfully",
        { duration: 3000 }
      ));
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to update submission",
        { title: "Update Error" }
      ));
    } finally {
      setUpdating(false);
    }
  }, [clearMessage]);

  const deleteSubmission = useCallback(async (id: string) => {
    setLoading(true);
    clearMessage();
    try {
      await axios.delete(`/api/test-submission/${id}`);
      setTestSubmissions(prev => prev.filter(sub => sub.id !== id));
      setMessage(Message.success(
        "Submission deleted successfully",
        { duration: 3000 }
      ));
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to delete submission",
        { title: "Deletion Error" }
      ));
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  return (
    <TestSubmissionContext.Provider
      value={{
        testSubmissions,
        loading,
        updating,
        message,
        fetchSubmissions,
        fetchSubmissionsByTestId,
        fetchSubmissionByStudentTestId,
        fetchSubmissionsByStudentId,
        fetchSubmissionByIds,
        createSubmission,
        updateSubmission,
        deleteSubmission,
        clearMessage
      }}
    >
      {children}
    </TestSubmissionContext.Provider>
  );
};
