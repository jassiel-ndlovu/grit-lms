'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type StudentContextType = {
  students: Student[];
  fetchStudents: () => Promise<void>;
  addStudent: (student: Partial<Student>) => Promise<void>;
  updateStudent: (id: string, student: Partial<Student>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
};

const StudentContext = createContext<StudentContextType | undefined>(undefined);

export const StudentProvider = ({ children }: { children: React.ReactNode }) => {
  const [students, setStudents] = useState<Student[]>([]);

  const fetchStudents = async () => {
    const res = await fetch('/api/students');
    const data = await res.json();
    setStudents(data);
  };

  const addStudent = async (student: Partial<Student>) => {
    const res = await fetch('/api/students', {
      method: 'POST',
      body: JSON.stringify(student),
    });
    const newStudent = await res.json();
    setStudents(prev => [...prev, newStudent]);
  };

  const updateStudent = async (id: string, student: Partial<Student>) => {
    const res = await fetch(`/api/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(student),
    });
    const updated = await res.json();
    setStudents(prev => prev.map(s => (s.id === id ? updated : s)));
  };

  const deleteStudent = async (id: string) => {
    await fetch(`/api/students/${id}`, { method: 'DELETE' });
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  return (
    <StudentContext.Provider value={{ students, fetchStudents, addStudent, updateStudent, deleteStudent }}>
      {children}
    </StudentContext.Provider>
  );
};

export const useStudent = () => {
  const context = useContext(StudentContext);
  if (!context) throw new Error('useStudentContext must be used within StudentProvider');
  return context;
};
