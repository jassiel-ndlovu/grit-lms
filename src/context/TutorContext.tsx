"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

type TutorContextType = {
  tutors: Tutor[];
  fetchTutors: () => Promise<void>;
  addTutor: (tutor: Partial<Tutor>) => Promise<void>;
  updateTutor: (id: string, tutor: Partial<Tutor>) => Promise<void>;
  deleteTutor: (id: string) => Promise<void>;
};

const TutorContext = createContext<TutorContextType | undefined>(undefined);

export const TutorProvider = ({ children }: { children: React.ReactNode }) => {
  const [tutors, setTutors] = useState<Tutor[]>([]);

  const fetchTutors = async () => {
    const res = await fetch('/api/tutors');
    const data = await res.json();
    setTutors(data);
  };

  const addTutor = async (tutor: Partial<Tutor>) => {
    const res = await fetch('/api/tutors', {
      method: 'POST',
      body: JSON.stringify(tutor),
    });
    const newTutor = await res.json();
    setTutors(prev => [...prev, newTutor]);
  };

  const updateTutor = async (id: string, tutor: Partial<Tutor>) => {
    const res = await fetch(`/api/tutors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tutor),
    });
    const updated = await res.json();
    setTutors(prev => prev.map(t => (t.id === id ? updated : t)));
  };

  const deleteTutor = async (id: string) => {
    await fetch(`/api/tutors/${id}`, { method: 'DELETE' });
    setTutors(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    fetchTutors();
  }, []);

  return (
    <TutorContext.Provider value={{ tutors, fetchTutors, addTutor, updateTutor, deleteTutor }}>
      {children}
    </TutorContext.Provider>
  );
};

export const useTutor = () => {
  const context = useContext(TutorContext);
  if (!context) throw new Error('useTutorContext must be used within TutorProvider');
  return context;
};
