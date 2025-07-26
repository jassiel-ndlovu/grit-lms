"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import axios from "axios";

interface TestContextType {
  tests: Test[];
  loading: boolean;
  fetchTests: (courseId: string) => Promise<void>;
  createTest: (courseId: string, testData: Partial<Test>) => Promise<void>;
  updateTest: (testId: string, updates: Partial<Test>) => Promise<void>;
  deleteTest: (testId: string) => Promise<void>;
}

const TestContext = createContext<TestContextType | undefined>(undefined);

export const useTests = () => {
  const context = useContext(TestContext);
  if (!context) throw new Error("useTests must be used within a TestProvider");
  return context;
};

export const TestProvider = ({ children }: { children: ReactNode }) => {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchTests = async (courseId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/tests?courseId=${courseId}`);
      setTests(res.data);
    } catch (err) {
      console.error("Failed to fetch tests", err);
    } finally {
      setLoading(false);
    }
  };

  const createTest = async (courseId: string, testData: Partial<Test>) => {
    try {
      const res = await axios.post(`/api/tests`, { ...testData, courseId });
      setTests((prev) => [...prev, res.data]);
    } catch (err) {
      console.error("Failed to create test", err);
    }
  };

  const updateTest = async (testId: string, updates: Partial<Test>) => {
    try {
      const res = await axios.put(`/api/tests/${testId}`, updates);
      setTests((prev) => prev.map(t => t.id === testId ? res.data : t));
    } catch (err) {
      console.error("Failed to update test", err);
    }
  };

  const deleteTest = async (testId: string) => {
    try {
      await axios.delete(`/api/tests/${testId}`);
      setTests((prev) => prev.filter(t => t.id !== testId));
    } catch (err) {
      console.error("Failed to delete test", err);
    }
  };

  return (
    <TestContext.Provider value={{ tests, loading, fetchTests, createTest, updateTest, deleteTest }}>
      {children}
    </TestContext.Provider>
  );
};
