import { QuestionTab } from '@/lib/test-creation-types';
import React from 'react';

interface QuestionTabsProps {
  activeTab: QuestionTab;
  onTabChange: (tab: QuestionTab) => void;
}

const QuestionTabs: React.FC<QuestionTabsProps> = ({ activeTab, onTabChange }) => {
  const tabs: { id: QuestionTab; label: string; description: string }[] = [
    { id: 'content', label: 'Content', description: 'Question text and media' },
    { id: 'settings', label: 'Settings', description: 'Type, points, and options' },
    { id: 'answer', label: 'Answer', description: 'Correct answer configuration' }
  ];

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            title={tab.description}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default QuestionTabs;