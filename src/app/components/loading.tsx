'use client';

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface LoadingPopupProps {
  message?: string
}

export default function LoadingPopup({ message = 'Logging in...' }: LoadingPopupProps) {
  return (
    <div className="fixed inset-0 bg-white backdrop-blur-sm z-50 flex items-center justify-center">
      <motion.div
        className="bg-white p-6 flex flex-col items-center space-y-4 max-w-xs w-full"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        <p className="text-gray-700 text-sm">{message}</p>
      </motion.div>
    </div>
  );
}
