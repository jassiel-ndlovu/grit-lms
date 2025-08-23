/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import axios from "axios";
import { Message } from "@/lib/message.class";

interface SubmissionEntryContextType {
  submissionEntries: AppTypes.SubmissionEntry[];
  loading: boolean;
  updating: boolean;
  message: Message | null;
  fetchEntries: () => Promise<void>;
  fetchEntriesBySubmissionId: (submissionId: string) => Promise<void | AppTypes.SubmissionEntry[]>;
  fetchEntriesByStudentId: (studentId: string) => Promise<void | AppTypes.SubmissionEntry[]>;
  fetchEntryById: (id: string) => Promise<AppTypes.SubmissionEntry | void>;
  fetchEntryByStudentIdSubId: (studentId: string, submissionId: string) => Promise<AppTypes.SubmissionEntry | void>;
  createEntry: (data: Partial<AppTypes.SubmissionEntry>) => Promise<AppTypes.SubmissionEntry | void>;
  updateEntry: (id: string, data: Partial<AppTypes.SubmissionEntry>) => Promise<AppTypes.SubmissionEntry | void>;
  deleteEntry: (id: string) => Promise<void>;
  clearMessage: () => void;
}

const SubmissionEntryContext = createContext<SubmissionEntryContextType | undefined>(undefined);

export const useSubmissionEntries = () => {
  const context = useContext(SubmissionEntryContext);
  if (!context) {
    throw new Error("useSubmissionEntries must be used within a SubmissionEntryProvider");
  }
  return context;
};

export const SubmissionEntryProvider = ({ children }: { children: ReactNode }) => {
  const [submissionEntries, setSubmissionEntries] = useState<AppTypes.SubmissionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const clearMessage = useCallback(() => setMessage(null), []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.SubmissionEntry[]>("/api/submission-entry");
      setSubmissionEntries(res.data);
    } catch (err: any) {
      setMessage(Message.error(err.response?.data?.message || "Failed to fetch entries"));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEntriesBySubmissionId = useCallback(async (submissionId: string) => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.SubmissionEntry[]>(`/api/submission-entry?submissionId=${submissionId}`);
      
      setSubmissionEntries(res.data);

      return res.data;
    } catch (err: any) {
      setMessage(Message.error(err.response?.data?.message || "Failed to fetch entries by submission ID"));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEntryByStudentIdSubId = useCallback(async (studentId: string, submissionId: string) => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.SubmissionEntry>(`/api/submission-entry?studentId=${studentId}&submissionId=${submissionId}`);

      setSubmissionEntries([res.data]);

      return res.data;
    } catch (err: any) {
      setMessage(Message.error(err.response?.data?.message || "Failed to fetch entries by submission ID"));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEntriesByStudentId = useCallback(async (studentId: string) => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.SubmissionEntry[]>(`/api/submission-entry?studentId=${studentId}`);
      setSubmissionEntries(res.data);

      return res.data;
    } catch (err: any) {
      setMessage(Message.error(err.response?.data?.message || "Failed to fetch entries by student ID"));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEntryById = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await axios.get<AppTypes.SubmissionEntry>(`/api/submission-entry/${id}`);
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(err.response?.data?.message || "Failed to fetch entry"));
    } finally {
      setLoading(false);
    }
  }, []);

  const createEntry = useCallback(async (data: Partial<AppTypes.SubmissionEntry>) => {
    setLoading(true);
    clearMessage();
    try {
      const res = await axios.post<AppTypes.SubmissionEntry>("/api/submission-entry", data);
      setSubmissionEntries(prev => [...prev, res.data]);
      setMessage(Message.success("Entry created successfully"));
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(err.response?.data?.message || "Failed to create entry"));
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  const updateEntry = useCallback(async (id: string, data: Partial<AppTypes.SubmissionEntry>) => {
    setUpdating(true);
    clearMessage();
    try {
      const res = await axios.put<AppTypes.SubmissionEntry>(`/api/submission-entry/${id}`, data);
      setSubmissionEntries(prev => prev.map(e => (e.id === id ? res.data : e)));
      setMessage(Message.success("Entry updated successfully"));
      return res.data;
    } catch (err: any) {
      setMessage(Message.error(err.response?.data?.message || "Failed to update entry"));
    } finally {
      setUpdating(false);
    }
  }, [clearMessage]);

  const deleteEntry = useCallback(async (id: string) => {
    setLoading(true);
    clearMessage();
    try {
      await axios.delete(`/api/submission-entry/${id}`);
      setSubmissionEntries(prev => prev.filter(e => e.id !== id));
      setMessage(Message.success("Entry deleted successfully"));
    } catch (err: any) {
      setMessage(Message.error(err.response?.data?.message || "Failed to delete entry"));
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  return (
    <SubmissionEntryContext.Provider
      value={{
        submissionEntries,
        loading,
        updating,
        message,
        fetchEntries,
        fetchEntriesBySubmissionId,
        fetchEntriesByStudentId,
        fetchEntryById,
        fetchEntryByStudentIdSubId,
        createEntry,
        updateEntry,
        deleteEntry,
        clearMessage
      }}
    >
      {children}
    </SubmissionEntryContext.Provider>
  );
};