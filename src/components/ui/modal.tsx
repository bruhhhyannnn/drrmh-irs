'use client';

import { cn } from '@/lib';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  isFullscreen?: boolean;
}

export function Modal({ isOpen, onClose, children, className, isFullscreen = false }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-2 flex items-stretch justify-end">
          {/* Backdrop */}
          {!isFullscreen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm"
              onClick={onClose}
            />
          )}

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'bg-gray-50 relative flex h-screen w-full flex-col shadow-2xl dark:bg-gray-800',
              !isFullscreen && 'sm:max-w-2xl sm:rounded-l-2xl',
              className
            )}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-6 z-2 flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 dark:border-gray-500 bg-gray-100 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-700 dark:hover:text-white"
            >
              <X size={18} />
            </button>
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
