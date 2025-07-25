import { useEffect, useState } from "react";

type StudentManagerDialogProps = {
  allStudents: Student[];
  enrolled: Student[];
  courseLoading: boolean;
  message?: string | null;
  onClose: () => void;
  onSave: (selected: Student[]) => Promise<void>;
}

export default function StudentManagerDialog({ allStudents, message, enrolled, onClose, onSave, courseLoading }: StudentManagerDialogProps) {
  const [selected, setSelected] = useState<Student[]>(enrolled);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const toggleStudent = (student: Student) => {
    setSelected(prev =>
      prev.find(s => s.id === student.id)
        ? prev.filter(s => s.id !== student.id)
        : [...prev, student]
    );
  };

  const isSelected = (student: Student) => selected.some(s => s.id === student.id);

  const handleSave = async () => {
    setSubmitting(true);
    await onSave(selected);
    setSubmitting(false);
    if (!courseLoading && message && !message.includes("fail")) {
      onClose();
    }
  };

  useEffect(() => {
    if (message) {
      setFeedback(message);
      const timeout = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [message]);

  return (
    <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center">
      <div className="bg-white max-w-2xl w-full shadow-lg p-6 z-50 relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-800">Manage Course Students</h2>
          {!submitting && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-red-500 text-xl"
            >
              &times;
            </button>
          )}
        </div>

        {/* Show backend message */}
        {feedback && (
          <div
            className={`mb-3 text-sm rounded px-3 py-2 ${feedback.toLowerCase().includes('fail')
                ? 'bg-red-100 text-red-700'
                : 'bg-green-100 text-green-700'
              }`}
          >
            {feedback}
          </div>
        )}

        {/* Student List */}
        <div className="grid sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
          {allStudents.map(student => (
            <button
              key={student.id}
              onClick={() => toggleStudent(student)}
              disabled={submitting}
              className={`flex items-center gap-3 p-3 border rounded-md transition
                ${isSelected(student)
                  ? "bg-blue-100 border-blue-400"
                  : "bg-white hover:bg-gray-50"}`}
            >
              <div className="w-10 h-10 bg-blue-200 text-blue-800 rounded-full flex items-center justify-center font-bold">
                {student.fullName[0]}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-800">{student.fullName}</p>
                <p className="text-xs text-gray-500">{student.email}</p>
              </div>
              <span className="ml-auto">
                {isSelected(student) && (
                  <span className="text-blue-600 font-semibold text-sm">✓</span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* Buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="w-32 px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-500 flex items-center gap-2"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}