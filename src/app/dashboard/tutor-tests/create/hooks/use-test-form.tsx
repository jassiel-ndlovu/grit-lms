/* eslint-disable @typescript-eslint/no-explicit-any */

import { TestFormData } from '@/lib/test-creation-types';
import { useState } from 'react';

export const useTestForm = () => {
  const [formData, setFormData] = useState<TestFormData>({
    title: '',
    description: '',
    preTestInstructions: '',
    courseId: '',
    dueDate: new Date(),
    timeLimit: undefined,
    isActive: true,
    questions: [],
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      preTestInstructions: '',
      courseId: '',
      dueDate: new Date(),
      timeLimit: undefined,
      isActive: true,
      questions: [],
    });
  };

  const updateFormField = (field: keyof TestFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return {
    formData,
    setFormData,
    resetForm,
    updateFormField
  };
};