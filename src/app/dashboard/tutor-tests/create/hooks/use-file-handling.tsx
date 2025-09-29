/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useCallback } from 'react';
import { uploadFile } from '@/lib/blob';

export const useFileHandling = () => {
  const [uploadedImages, setUploadedImages] = useState<Set<string>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleQuestionFileUpload = useCallback(async (
    file: File, 
    questionId: string,
    currentQuestionText: string, // Add current question text as parameter
    updateQuestionCallback: (questionId: string, field: string, value: any) => void
  ) => {
    setIsUploading(true);
    
    try {
      const fileUrl = await uploadFile(file);

      if (file.type.startsWith('image/')) {
        setUploadedImages(prev => new Set(prev).add(fileUrl));
      } else {
        setUploadedFiles(prev => new Set(prev).add(fileUrl));
      }

      // Update question with file URL using the provided current text
      const markdownLink = file.type.startsWith('image/')
        ? `\n![${file.name}](${fileUrl})\n`
        : `\n[${file.name}](${fileUrl})\n`;

      updateQuestionCallback(questionId, 'question', currentQuestionText + "\n" + markdownLink);

    } catch (error) {
      console.error("Failed to upload file:", error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [setUploadedImages, setUploadedFiles]);

  const handleDrop = useCallback((
    e: React.DragEvent, 
    questionId: string,
    currentQuestionText: string, // Add current question text as parameter
    updateQuestionCallback: (questionId: string, field: string, value: any) => void
  ) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const supportedFiles = files.filter(file =>
      file.type.startsWith('image/') ||
      file.type === 'application/pdf' ||
      file.type === 'application/msword' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    if (supportedFiles.length > 0) {
      handleQuestionFileUpload(supportedFiles[0], questionId, currentQuestionText, updateQuestionCallback);
    }
  }, [handleQuestionFileUpload]);

  const handleFileInput = useCallback((
    e: React.ChangeEvent<HTMLInputElement>, 
    questionId: string,
    currentQuestionText: string, // Add current question text as parameter
    updateQuestionCallback: (questionId: string, field: string, value: any) => void
  ) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleQuestionFileUpload(files[0], questionId, currentQuestionText, updateQuestionCallback);
    }
    e.target.value = '';
  }, [handleQuestionFileUpload]);

  return {
    uploadedImages,
    uploadedFiles,
    isUploading,
    dragOver,
    setDragOver,
    handleQuestionFileUpload,
    handleDrop,
    handleFileInput,
    setUploadedImages,
    setUploadedFiles
  };
};