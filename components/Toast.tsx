import React, { useEffect } from 'react';
import { CopyIcon } from './icons'; // Using CopyIcon for visual consistency

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000); // Hide after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg flex items-center space-x-3 z-50">
      <CopyIcon className="w-5 h-5 text-green-400" />
      <span>{message}</span>
    </div>
  );
};

export default Toast;
