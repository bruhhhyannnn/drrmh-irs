'use client';

import { cn } from '@/lib';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, onClose]);

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
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        !isVisible && 'pointer-events-none'
      )}
    >
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity duration-200',
          isVisible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={() => !isLoading && onClose()}
      />

      {/* Dialog */}
      <div
        className={cn(
          'relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800',
          'transition-all duration-200',
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {variant === 'danger' && (
          <div className="mb-4 flex h-12 w-12 animate-bounce items-center justify-center rounded-full bg-red-100 dark:bg-red-500/15">
            <AlertTriangle size={22} className="text-error-500" />
          </div>
        )}

        <h2 className="mb-1 text-xl font-semibold text-gray-800 dark:text-white/90">{title}</h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">{message}</p>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
            loadingText="Deleting..."
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
