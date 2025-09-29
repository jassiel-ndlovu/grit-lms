/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { useState, useCallback } from 'react';
import { QuestionType } from '@/generated/prisma';
import { ExtendedTestQuestion } from '@/lib/test-creation-types';

export const useQuestionManagement = (initialQuestions: ExtendedTestQuestion[] = []) => {
  const [questions, setQuestions] = useState<ExtendedTestQuestion[]>(initialQuestions);
  const [activeQuestionTabs, setActiveQuestionTabs] = useState<Record<string, 'content' | 'settings' | 'answer'>>({});
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

  // Utility functions
  const generateId = useCallback(() => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []);

  const getQuestionTab = useCallback((questionId: string) => {
    return activeQuestionTabs[questionId] || 'content';
  }, [activeQuestionTabs]);

  const setQuestionTab = useCallback((questionId: string, tab: 'content' | 'settings' | 'answer') => {
    setActiveQuestionTabs(prev => ({ ...prev, [questionId]: tab }));
  }, []);

  const toggleQuestionExpansion = useCallback((questionId: string) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  }, []);

  const isQuestionExpanded = useCallback((questionId: string) => {
    return expandedQuestions.has(questionId);
  }, [expandedQuestions]);

  // Flatten questions for easier manipulation
  const flattenQuestions = useCallback((questionsToFlatten: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
    const flattened: ExtendedTestQuestion[] = [];
    questionsToFlatten.forEach(question => {
      flattened.push(question);
      if (question.subQuestions) {
        flattened.push(...flattenQuestions(question.subQuestions));
      }
    });
    return flattened;
  }, []);

  // Organize questions into hierarchy
  const organizeQuestionsHierarchy = useCallback((flatQuestions: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
    const questionMap = new Map<string, ExtendedTestQuestion>();
    const rootQuestions: ExtendedTestQuestion[] = [];

    // First pass: create map of all questions
    flatQuestions.forEach(q => {
      questionMap.set(q.id as string, { ...q, subQuestions: [] });
    });

    // Second pass: organize hierarchy
    flatQuestions.forEach(q => {
      const question = questionMap.get(q.id as string)!;
      if (q.parentId && questionMap.has(q.parentId)) {
        const parent = questionMap.get(q.parentId)!;
        if (!parent.subQuestions) parent.subQuestions = [];
        parent.subQuestions.push(question);
      } else {
        rootQuestions.push(question);
      }
    });

    // Sort by order
    const sortByOrder = (questionsToSort: ExtendedTestQuestion[]) => {
      questionsToSort.sort((a, b) => (a.order || 0) - (b.order || 0));
      questionsToSort.forEach(q => {
        if (q.subQuestions) {
          sortByOrder(q.subQuestions);
        }
      });
    };

    sortByOrder(rootQuestions);
    return rootQuestions;
  }, []);

  // NEW: Add subquestion to a specific parent
  const addSubQuestion = useCallback((parentId: string) => {
    const newSubQuestion: ExtendedTestQuestion = {
      id: generateId(),
      question: '',
      type: QuestionType.MULTIPLE_CHOICE,
      points: 1,
      options: ['', '', '', ''],
      answer: '',
      language: '',
      matchPairs: null,
      reorderItems: [],
      blankCount: 0,
      order: 0,
      parentId: parentId,
      subQuestions: [],
      isExpanded: false,
    };

    setQuestions(prev => {
      const updateWithSubQuestion = (questionsList: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
        return questionsList.map(question => {
          if (question.id === parentId) {
            // Found the parent, add subquestion
            const existingSubQuestions = question.subQuestions || [];
            return {
              ...question,
              subQuestions: [...existingSubQuestions, newSubQuestion],
              isExpanded: true // Auto-expand parent when adding subquestion
            };
          }

          // Recursively search through subquestions
          if (question.subQuestions && question.subQuestions.length > 0) {
            return {
              ...question,
              subQuestions: updateWithSubQuestion(question.subQuestions)
            };
          }

          return question;
        });
      };

      return updateWithSubQuestion(prev);
    });

    // Set initial tab for new subquestion and expand parent
    setQuestionTab(newSubQuestion.id as string, 'content');
    setExpandedQuestions(prev => new Set([...prev, parentId]));
  }, [generateId, setQuestionTab]);

  // Existing addQuestion function (modified to use addSubQuestion when parentId is provided)
  const addQuestion = useCallback((parentId?: string) => {
    if (parentId) {
      addSubQuestion(parentId);
      return;
    }

    // Add as root question (original functionality)
    const newQuestion: ExtendedTestQuestion = {
      id: generateId(),
      question: '',
      type: QuestionType.MULTIPLE_CHOICE,
      points: 1,
      options: ['', '', '', ''],
      answer: '',
      language: '',
      matchPairs: null,
      reorderItems: [],
      blankCount: 0,
      order: 0,
      parentId: null,
      subQuestions: [],
      isExpanded: false,
    };

    setQuestions(prev => {
      newQuestion.order = prev.length;
      return [...prev, newQuestion];
    });

    // Set initial tab for new question
    setQuestionTab(newQuestion.id as string, 'content');
  }, [generateId, setQuestionTab, addSubQuestion]);

  const removeQuestion = useCallback((questionId: string) => {
    setQuestions(prev => {
      const removeRecursive = (qs: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
        return qs
          .filter(q => q.id !== questionId)
          .map(q => ({
            ...q,
            subQuestions: q.subQuestions ? removeRecursive(q.subQuestions) : []
          }));
      };

      return removeRecursive(prev);
    });

    // Clean up state
    setActiveQuestionTabs(prev => {
      const { [questionId]: _removed, ...rest } = prev;
      return rest;
    });
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      newSet.delete(questionId);
      return newSet;
    });
  }, []);

  const updateQuestion = useCallback((questionId: string, field: string, value: any) => {
    setQuestions(prev => {
      const updateRecursive = (qs: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
        return qs.map(q => {
          if (q.id === questionId) {
            return { ...q, [field]: value };
          }
          if (q.subQuestions) {
            return { ...q, subQuestions: updateRecursive(q.subQuestions) };
          }
          return q;
        });
      };

      return updateRecursive(prev);
    });
  }, []);

  const duplicateQuestion = useCallback((questionId: string) => {
    setQuestions(prev => {
      const duplicateQuestionRecursive = (qs: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
        const newQuestions: ExtendedTestQuestion[] = [];

        qs.forEach(q => {
          newQuestions.push(q);
          if (q.id === questionId) {
            // Create duplicate
            const duplicate: ExtendedTestQuestion = {
              ...q,
              id: generateId(),
              subQuestions: q.subQuestions ? duplicateSubQuestions(q.subQuestions) : []
            };
            newQuestions.push(duplicate);
          }
        });

        return newQuestions.map(q => ({
          ...q,
          subQuestions: q.subQuestions ? duplicateQuestionRecursive(q.subQuestions) : []
        }));
      };

      const duplicateSubQuestions = (subQs: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
        return subQs.map(sq => ({
          ...sq,
          id: generateId(),
          subQuestions: sq.subQuestions ? duplicateSubQuestions(sq.subQuestions) : []
        }));
      };

      return duplicateQuestionRecursive(prev);
    });
  }, [generateId]);

  const moveQuestion = useCallback((fromIndex: number, toIndex: number) => {
    setQuestions(prev => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 ||
        fromIndex >= prev.length || toIndex >= prev.length) {
        return prev;
      }

      const updatedQuestions = [...prev];
      const [movedQuestion] = updatedQuestions.splice(fromIndex, 1);
      updatedQuestions.splice(toIndex, 0, movedQuestion);

      // Update order property if needed
      return updatedQuestions.map((q, index) => ({ ...q, order: index }));
    });
  }, []);

  // NEW: Move subquestion within parent
  const moveSubQuestion = useCallback((parentId: string, fromIndex: number, toIndex: number) => {
    setQuestions(prev => {
      const moveSubQuestionRecursive = (questionsList: ExtendedTestQuestion[]): ExtendedTestQuestion[] => {
        return questionsList.map(question => {
          if (question.id === parentId && question.subQuestions) {
            const subQuestions = [...question.subQuestions];
            if (toIndex < 0 || toIndex >= subQuestions.length) return question;

            const [movedSubQuestion] = subQuestions.splice(fromIndex, 1);
            subQuestions.splice(toIndex, 0, movedSubQuestion);

            // Update order for subquestions
            const updatedSubQuestions = subQuestions.map((sq, index) => ({
              ...sq,
              order: index
            }));

            return {
              ...question,
              subQuestions: updatedSubQuestions
            };
          }

          // Recursively search through subquestions
          if (question.subQuestions && question.subQuestions.length > 0) {
            return {
              ...question,
              subQuestions: moveSubQuestionRecursive(question.subQuestions)
            };
          }

          return question;
        });
      };

      return moveSubQuestionRecursive(prev);
    });
  }, []);

  return {
    questions,
    setQuestions,
    addQuestion,
    addSubQuestion, // NEW: Export the addSubQuestion function
    removeQuestion,
    updateQuestion,
    duplicateQuestion,
    moveQuestion,
    moveSubQuestion, // NEW: Export the moveSubQuestion function
    flattenQuestions,
    organizeQuestionsHierarchy,
    getQuestionTab,
    setQuestionTab,
    toggleQuestionExpansion,
    isQuestionExpanded
  };
};