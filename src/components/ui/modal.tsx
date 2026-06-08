'use client';

import { cn } from '@/lib';
import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  isFullscreen?: boolean;
}

export function Modal({ isOpen, onClose, children, className, isFullscreen = false }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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

  if (!mounted) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-2 flex items-stretch justify-end',
        !isVisible && 'pointer-events-none'
      )}
    >
      {/* Backdrop */}
      {!isFullscreen && (
        <div
          className={cn(
            'fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity duration-300',
            isVisible ? 'opacity-100' : 'opacity-0'
          )}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'bg-gray-50 relative flex h-screen w-full flex-col shadow-2xl dark:bg-gray-800',
          'transition-transform duration-300 ease-in-out',
          isVisible ? 'translate-x-0' : 'translate-x-full',
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
      </div>
    </div>
  );
}
