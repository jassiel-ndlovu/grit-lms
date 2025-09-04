/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { MoreVertical, ChevronRight, X } from "lucide-react";

export interface ActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: (...args: any[]) => unknown;
  danger?: boolean; // for red styling
  children?: ActionItem[]; // dropdown / nested actions
}

interface ActionsMenuProps {
  title?: string;
  actions: ActionItem[];
}

export default function ActionsMenu({ title = "Actions", actions }: ActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<ActionItem | null>(null);

  const handleAction = (action: ActionItem) => {
    if (action.children) {
      setActiveSubmenu(action);
    } else {
      action.onClick?.();
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => {
              setIsOpen(false);
              setActiveSubmenu(null);
            }}
          />

          {/* Sidebar */}
          <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-50 animate-slide-in-right">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setActiveSubmenu(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="text-gray-400 w-5 h-5" />
                </button>
              </div>

              {/* Main or submenu */}
              {!activeSubmenu && (
                <div className="space-y-3">
                  {actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAction(action)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left border transition-colors ${
                        action.danger
                          ? "text-red-600 border-red-400 hover:bg-red-50"
                          : "text-gray-700 border-gray-300 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {action.icon && <span>{action.icon}</span>}
                        <span>{action.label}</span>
                      </div>
                      {action.children && <ChevronRight className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              )}

              {activeSubmenu && (
                <div className="space-y-3">
                  <button
                    onClick={() => setActiveSubmenu(null)}
                    className="w-full text-left px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                  >
                    ← Back
                  </button>
                  {activeSubmenu.children?.map((subAction, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAction(subAction)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left border transition-colors ${
                        subAction.danger
                          ? "text-red-600 border-red-400 hover:bg-red-50"
                          : "text-gray-700 border-gray-300 hover:bg-gray-100"
                      }`}
                    >
                      {subAction.icon && <span>{subAction.icon}</span>}
                      <span>{subAction.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Example usage component
interface ExampleActionsMenuProps {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function SubmissionActionsMenu({ onView, onEdit, onDelete }: ExampleActionsMenuProps) {
  const actions: ActionItem[] = [
    { label: "View Details", icon: <ChevronRight className="w-4 h-4" />, onClick: onView },
    { label: "Edit Submission", icon: <ChevronRight className="w-4 h-4" />, onClick: onEdit },
    { label: "Delete Submission", icon: <ChevronRight className="w-4 h-4" />, onClick: onDelete, danger: true },
  ];
  return <ActionsMenu title="Submission Actions" actions={actions} />;
}