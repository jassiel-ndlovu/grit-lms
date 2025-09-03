/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { Message } from '@/lib/message.class';

type TutorContextType = {
  tutors: AppTypes.Tutor[];
  loading: boolean;
  updating: boolean;
  message: Message | null;
  fetchTutors: () => Promise<void>;
  addTutor: (tutor: Partial<AppTypes.Tutor>) => Promise<AppTypes.Tutor | void>;
  updateTutor: (id: string, tutor: Partial<AppTypes.Tutor>) => Promise<AppTypes.Tutor | void>;
  deleteTutor: (id: string) => Promise<void>;
  clearMessage: () => void;
};

const TutorContext = createContext<TutorContextType | undefined>(undefined);

export const TutorProvider = ({ children }: { children: ReactNode }) => {
  const [tutors, setTutors] = useState<AppTypes.Tutor[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  const fetchTutors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tutors');
      if (!res.ok) throw new Error('Failed to fetch tutors');
      const data = await res.json();
      setTutors(data);
    } catch (err: any) {
      setMessage(Message.error(
        err.message || 'Failed to load tutors',
        { title: 'Fetch Error', duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const addTutor = useCallback(async (tutor: Partial<AppTypes.Tutor>) => {
    setLoading(true);
    clearMessage();
    try {
      const res = await fetch('/api/tutors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tutor),
      });
      if (!res.ok) throw new Error('Failed to create tutor');
      const newTutor = await res.json();
      setTutors(prev => [...prev, newTutor]);
      setMessage(Message.success(
        'Tutor added successfully',
        { duration: 3000 }
      ));
      return newTutor;
    } catch (err: any) {
      setMessage(Message.error(
        err.message || 'Failed to add tutor',
        { title: 'Creation Error' }
      ));
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  const updateTutor = useCallback(async (id: string, tutor: Partial<AppTypes.Tutor>) => {
    setLoading(true);
    setUpdating(true);
    clearMessage();
    try {
      const res = await fetch(`/api/tutors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tutor),
      });
      if (!res.ok) throw new Error('Failed to update tutor');
      const updated = await res.json();
      setTutors(prev => prev.map(t => (t.id === id ? updated : t)));
      setMessage(Message.success(
        'Tutor updated successfully',
        { duration: 3000 }
      ));
      return updated;
    } catch (err: any) {
      setMessage(Message.error(
        err.message || 'Failed to update tutor',
        { title: 'Update Error' }
      ));
    } finally {
      setLoading(false);
      setUpdating(false);
    }
  }, [clearMessage]);

  const deleteTutor = useCallback(async (id: string) => {
    setLoading(true);
    clearMessage();
    try {
      const res = await fetch(`/api/tutors/${id}`, { 
        method: 'DELETE' 
      });
      if (!res.ok) throw new Error('Failed to delete tutor');
      setTutors(prev => prev.filter(t => t.id !== id));
      setMessage(Message.success(
        'Tutor deleted successfully',
        { duration: 3000 }
      ));
    } catch (err: any) {
      setMessage(Message.error(
        err.message || 'Failed to delete tutor',
        { title: 'Deletion Error' }
      ));
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  return (
    <TutorContext.Provider
      value={{
        tutors,
        loading,
        updating,
        message,
        fetchTutors,
        addTutor,
        updateTutor,
        deleteTutor,
        clearMessage
      }}
    >
      {children}
    </TutorContext.Provider>
  );
};

export const useTutor = () => {
  const context = useContext(TutorContext);
  if (!context) {
    throw new Error('useTutor must be used within TutorProvider');
  }
  return context;
};