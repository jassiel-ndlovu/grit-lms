"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type Submission = AppTypes.Submission;

interface SubmissionContextType {
  submissions: Submission[];
  loading: boolean;
  fetchSubmissions: (courseId: string) => Promise<void>;
  createSubmission: (data: Partial<Submission>) => Promise<Submission | null>;
  updateSubmission: (id: string, data: Partial<Submission>) => Promise<Submission | null>;
  deleteSubmission: (id: string) => Promise<boolean>;
}

const SubmissionContext = createContext<SubmissionContextType | undefined>(undefined);

export const SubmissionProvider = ({ children }: { children: ReactNode }) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Fetch submissions for a course
  const fetchSubmissions = async (courseId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/submissions?courseId=${courseId}`);
      const data = await res.json();
      setSubmissions(data);
    } catch (error) {
      console.error("Failed to fetch submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  // Create a new submission
  const createSubmission = async (submission: Partial<Submission>) => {
    try {
      const res = await fetch(`/api/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      });

      if (!res.ok) return null;
      const newSubmission = await res.json();
      setSubmissions((prev) => [...prev, newSubmission]);
      return newSubmission;
    } catch (error) {
      console.error("Failed to create submission:", error);
      return null;
    }
  };

  // Update an existing submission
  const updateSubmission = async (id: string, data: Partial<Submission>) => {
    try {
      const res = await fetch(`/api/submissions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) return null;
      const updatedSubmission = await res.json();
      setSubmissions((prev) =>
        prev.map((s) => (s.id === id ? updatedSubmission : s))
      );
      return updatedSubmission;
    } catch (error) {
      console.error("Failed to update submission:", error);
      return null;
    }
  };

  // Delete a submission
  const deleteSubmission = async (id: string) => {
    try {
      const res = await fetch(`/api/submissions/${id}`, { method: "DELETE" });
      if (!res.ok) return false;
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      return true;
    } catch (error) {
      console.error("Failed to delete submission:", error);
      return false;
    }
  };

  return (
    <SubmissionContext.Provider
      value={{
        submissions,
        loading,
        fetchSubmissions,
        createSubmission,
        updateSubmission,
        deleteSubmission,
      }}
    >
      {children}
    </SubmissionContext.Provider>
  );
};

export const useSubmissions = () => {
  const ctx = useContext(SubmissionContext);
  if (!ctx) {
    throw new Error("useSubmissions must be used inside SubmissionProvider");
  }
  return ctx;
};
