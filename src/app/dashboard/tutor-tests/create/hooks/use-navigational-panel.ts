import { useState } from 'react';

export const useNavigationPanel = () => {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  const toggleQuestionExpansion = (questionId: string) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
    
    const element = e.target as HTMLElement;
    element.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const element = e.target as HTMLElement;
    element.style.opacity = '1';
    setDraggedItem(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  return {
    expandedQuestions,
    draggedItem,
    toggleQuestionExpansion,
    handleDragStart,
    handleDragEnd,
    handleDragOver
  };
};