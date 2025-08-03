"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import axios from "axios";
import { Message } from "@/lib/message.class";

interface TestContextType {
  tests: Test[];
  currentTest: Test | null;
  loading: boolean;
  updating: boolean;
  message: Message | null;
  fetchTestsByTutorId: (tutorId: string) => Promise<void>;
  fetchTestById: (testId: string) => Promise<void>;
  fetchTestsByStudentId: (studentId: string) => Promise<void>;
  fetchTestsByCourse: (courseIds: string[]) => Promise<void>;
  createTest: (courseId: string, testData: Partial<Test>) => Promise<Test | void>;
  updateTest: (testId: string, updates: Partial<Test>) => Promise<Test | void>;
  deleteTest: (testId: string) => Promise<void>;
  clearMessage: () => void;
}

const TestContext = createContext<TestContextType | undefined>(undefined);

export const useTests = () => {
  const context = useContext(TestContext);
  if (!context) throw new Error("useTests must be used within a TestProvider");
  return context;
};

export const TestProvider = ({ children }: { children: ReactNode }) => {
  const [tests, setTests] = useState<Test[]>([]);
  const [currentTest, setCurrentTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  const fetchTestsByTutorId = useCallback(async (tutorId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/tests?tutorId=${tutorId}`);
      setTests(res.data);
      // @ts-ignore
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to fetch tests',
        { title: 'Fetch Error', duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTestsByStudentId = useCallback(async (studentId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/tests?studentId=${studentId}`);
      setTests(res.data);
      // @ts-ignore
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to fetch tests',
        { title: 'Fetch Error', duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTestById = useCallback(async (testId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/tests?testId=${testId}`);
      setCurrentTest(res.data);
      // @ts-ignore
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to fetch tests',
        { title: 'Fetch Error', duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTestsByCourse = useCallback(async (courseIds: string[]) => {
    if (!courseIds.length) return;
    
    setLoading(true);
    try {
      const res = await axios.get('/api/tests', {
        params: {
          courseIds: courseIds.join(',')
        }
      });
      setTests(res.data);
      // @ts-ignore
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to fetch tests',
        { title: 'Fetch Error', duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const createTest = useCallback(async (courseId: string, testData: Partial<Test>) => {
    setLoading(true);
    clearMessage();
    try {
      const res = await axios.post(`/api/tests`, { ...testData, courseId });
      setTests((prev) => [...prev, res.data]);
      setMessage(Message.success(
        'Test created successfully',
        { duration: 3000 }
      ));
      return res.data;
      // @ts-ignore
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to create test',
        { title: 'Creation Error' }
      ));
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  const updateTest = useCallback(async (testId: string, updates: Partial<Test>) => {
    setLoading(true);
    setUpdating(true);
    clearMessage();
    try {
      const res = await axios.put(`/api/tests/${testId}`, updates);
      setTests((prev) => prev.map(t => t.id === testId ? res.data : t));
      setMessage(Message.success(
        'Test updated successfully',
        { duration: 3000 }
      ));
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to update test',
        { title: 'Update Error' }
      ));
    } finally {
      setLoading(false);
      setUpdating(false);
    }
  }, [clearMessage]);

  const deleteTest = useCallback(async (testId: string) => {
    setLoading(true);
    clearMessage();
    try {
      await axios.delete(`/api/tests/${testId}`);
      setTests((prev) => prev.filter(t => t.id !== testId));
      setMessage(Message.success(
        'Test deleted successfully',
        { duration: 3000 }
      ));
      // @ts-ignore
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || 'Failed to delete test',
        { title: 'Deletion Error' }
      ));
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  return (
    <TestContext.Provider
      value={{
        tests,
        currentTest,
        loading,
        updating,
        message,
        fetchTestsByCourse,
        fetchTestsByStudentId,
        fetchTestsByTutorId,
        fetchTestById,
        createTest,
        updateTest,
        deleteTest,
        clearMessage
      }}
    >
      {children}
    </TestContext.Provider>
  );
};