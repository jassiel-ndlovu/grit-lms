import { X } from "lucide-react";

const DialogHeader = ({ title, onClose }: { title: string; onClose: () => void }) => (
  <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-100">
    <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
    <button
      onClick={onClose}
      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
    >
      <X className="w-5 h-5 text-gray-500" />
    </button>
  </div>
);

export default DialogHeader;