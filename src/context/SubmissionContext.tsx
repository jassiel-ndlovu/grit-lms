/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import axios from "axios";
import { Message } from "@/lib/message.class";

type Submission = AppTypes.Submission;

interface SubmissionContextProps {
  submissions: Submission[];
  loading: boolean;
  updating: boolean;
  message: Message | null;
  fetchSubmissions: (courseId: string) => Promise<void>;
  fetchSubmissionsByTutorId: (tutorId: string) => Promise<AppTypes.Submission[] | void>;
  fetchSubmissionsByStudentId: (studentId: string) => Promise<AppTypes.Submission[] | void>;
  fetchSubmissionsByStudentIdCourseId: (studentId: string, courseId: string) => Promise<AppTypes.Submission[] | void>;
  fetchSubmissionsByCourseIds: (courseIds: string[]) => Promise<Submission[]>;
  fetchSubmissionById: (id: string) => Promise<Submission | void>;
  createSubmission: (courseId: string, data: Partial<Submission>) => Promise<Submission | null>;
  updateSubmission: (id: string, data: Partial<Submission>) => Promise<Submission | null>;
  deleteSubmission: (id: string) => Promise<boolean>;
  clearMessage: () => void;
}

const SubmissionContext = createContext<SubmissionContextProps | undefined>(undefined);

export const useSubmission = () => {
  const context = useContext(SubmissionContext);
  if (!context) throw new Error("useSubmission must be used inside SubmissionProvider");
  return context;
};

export const SubmissionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);
  const [message, setMessage] = useState<Message | null>(null);

  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  // Fetch all submissions for a course
  const fetchSubmissions = useCallback(async (courseId: string) => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/submissions?courseId=${courseId}`);
      setSubmissions(data);
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to load submissions",
        { title: "Fetch Error", duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSubmissionsByTutorId = useCallback(async (tutorId: string) => {
    setLoading(true);
    clearMessage();
    try {
      const { data } = await axios.get(`/api/submissions?tutorId=${tutorId}`);
      setSubmissions(data);
      setMessage(Message.success("Submissions loaded successfully", { duration: 3000 }));
      return data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to load submissions",
        { title: "Fetch Error", duration: 5000 }
      ));
      return [];
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  const fetchSubmissionsByStudentIdCourseId = useCallback(async (studentId: string, courseId: string) => {
    setLoading(true);
    clearMessage();
    try {
      const { data } = await axios.get(`/api/submissions?studentId=${studentId}&courseId=${courseId}`);
      
      setSubmissions(data);
      setMessage(Message.success("Submissions loaded successfully", { duration: 3000 }));

      return data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to load submissions",
        { title: "Fetch Error", duration: 5000 }
      ));
      return [];
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  const fetchSubmissionById = useCallback(async (id: string) => {
    setLoading(true);
    clearMessage();
    try {
      const { data } = await axios.get(`/api/submissions?id=${id}`);

      setSubmissions(data);
      setMessage(Message.success("Submissions loaded successfully", { duration: 3000 }));

      return data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to load submissions",
        { title: "Fetch Error", duration: 5000 }
      ));
      return [];
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  const fetchSubmissionsByStudentId = useCallback(async (studentId: string) => {
    setLoading(true);
    clearMessage();
    try {
      const { data } = await axios.get(`/api/submissions?studentId=${studentId}`);
      
      setSubmissions(data);
      setMessage(Message.success("Submissions loaded successfully", { duration: 3000 }));

      return data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to load submissions",
        { title: "Fetch Error", duration: 5000 }
      ));
      return [];
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  // Fetch with message feedback
  const fetchSubmissionsByCourseIds = useCallback(async (courseIds: string[]) => {
    setLoading(true);
    clearMessage();
    try {
      const ids = courseIds.join(",");
      const { data } = await axios.get(`/api/submissions?courseId=${ids}`);
      setSubmissions(data);
      setMessage(Message.success("Submissions loaded successfully", { duration: 3000 }));
      return data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to load submissions",
        { title: "Fetch Error", duration: 5000 }
      ));
      return [];
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  // Create new submission
  const createSubmission = useCallback(async (courseId: string, submission: Partial<Submission>) => {
    setLoading(true);
    clearMessage();
    try {
      const { data } = await axios.post(`/api/submissions`, { ...submission, courseId });
      setSubmissions((prev) => [...prev, data]);
      setMessage(Message.success("Submission created successfully", { duration: 3000 }));
      return data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to create submission",
        { title: "Creation Error" }
      ));
      return null;
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  // Update existing submission
  const updateSubmission = useCallback(async (id: string, updatedData: Partial<Submission>) => {
    setLoading(true);
    setUpdating(true);
    clearMessage();
    try {
      const { data } = await axios.put(`/api/submissions/${id}`, updatedData);
      setSubmissions((prev) => prev.map((s) => (s.id === id ? data : s)));
      setMessage(Message.success("Submission updated successfully", { duration: 3000 }));
      return data;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to update submission",
        { title: "Update Error" }
      ));
      return null;
    } finally {
      setLoading(false);
      setUpdating(false);
    }
  }, [clearMessage]);

  // Delete submission
  const deleteSubmission = useCallback(async (id: string) => {
    setLoading(true);
    clearMessage();
    try {
      await axios.delete(`/api/submissions/${id}`);
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      setMessage(Message.success("Submission deleted successfully", { duration: 3000 }));
      return true;
    } catch (err: any) {
      setMessage(Message.error(
        err.response?.data?.message || "Failed to delete submission",
        { title: "Deletion Error" }
      ));
      return false;
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  return (
    <SubmissionContext.Provider
      value={{
        submissions,
        loading,
        updating,
        message,
        fetchSubmissions,
        fetchSubmissionsByStudentId,
        fetchSubmissionsByStudentIdCourseId,
        fetchSubmissionsByTutorId,
        fetchSubmissionsByCourseIds,
        fetchSubmissionById,
        createSubmission,
        updateSubmission,
        deleteSubmission,
        clearMessage,
      }}
    >
      {children}
    </SubmissionContext.Provider>
  );
};
