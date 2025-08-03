'use client';

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { Message } from '@/lib/message.class';

type StudentContextType = {
  students: Student[];
  loading: boolean;
  updating: boolean;
  message: Message | null;
  fetchStudents: () => Promise<void>;
  addStudent: (student: Partial<Student>) => Promise<Student | void>;
  updateStudent: (id: string, student: Partial<Student>) => Promise<Student | void>;
  deleteStudent: (id: string) => Promise<void>;
  clearMessage: () => void;
};

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: ReactNode }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const clearMessage = useCallback(() => {
    setMessage(null);
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/students');
      if (!res.ok) throw new Error('Failed to fetch students');
      const data = await res.json();
      setStudents(data);
    } catch (err: any) {
      setMessage(Message.error(
        err.message || 'Failed to load students',
        { title: 'Fetch Error', duration: 5000 }
      ));
    } finally {
      setLoading(false);
    }
  }, []);

  const addStudent = useCallback(async (student: Partial<Student>) => {
    setLoading(true);
    clearMessage();
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student),
      });
      if (!res.ok) throw new Error('Failed to create student');
      const newStudent = await res.json();
      setStudents(prev => [...prev, newStudent]);
      setMessage(Message.success(
        'Student added successfully',
        { duration: 3000 }
      ));
      return newStudent;
      // @ts-ignore
    } catch (err: any) {
      setMessage(Message.error(
        err.message || 'Failed to add student',
        { title: 'Creation Error' }
      ));
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  const updateStudent = useCallback(async (id: string, student: Partial<Student>) => {
    setLoading(true);
    setUpdating(true);
    clearMessage();
    try {
      const res = await fetch(`/api/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(student),
      });
      if (!res.ok) throw new Error('Failed to update student');
      const updated = await res.json();
      setStudents(prev => prev.map(s => (s.id === id ? updated : s)));
      setMessage(Message.success(
        'Student updated successfully',
        { duration: 3000 }
      ));
      return updated;
      // @ts-ignore
    } catch (err: any) {
      setMessage(Message.error(
        err.message || 'Failed to update student',
        { title: 'Update Error' }
      ));
    } finally {
      setLoading(false);
      setUpdating(false);
    }
  }, [clearMessage]);

  const deleteStudent = useCallback(async (id: string) => {
    setLoading(true);
    clearMessage();
    try {
      const res = await fetch(`/api/students/${id}`, { 
        method: 'DELETE' 
      });
      if (!res.ok) throw new Error('Failed to delete student');
      setStudents(prev => prev.filter(s => s.id !== id));
      setMessage(Message.success(
        'Student deleted successfully',
        { duration: 3000 }
      ));
      // @ts-ignore
    } catch (err: any) {
      setMessage(Message.error(
        err.message || 'Failed to delete student',
        { title: 'Deletion Error' }
      ));
    } finally {
      setLoading(false);
    }
  }, [clearMessage]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  return (
    <StudentContext.Provider
      value={{
        students,
        loading,
        updating,
        message,
        fetchStudents,
        addStudent,
        updateStudent,
        deleteStudent,
        clearMessage
      }}
    >
      {children}
    </StudentContext.Provider>
  );
};

export const useStudent = () => {
  const context = useContext(StudentContext);
  if (!context) {
    throw new Error('useStudent must be used within StudentProvider');
  }
  return context;
};