'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
}

export function DetailModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidthClass = 'max-w-2xl',
}: DetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus modal container
      modalRef.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
        // Focus trap
        if (e.key === 'Tab' && modalRef.current) {
          const focusables = modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusables.length === 0) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-modal-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidthClass} bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-[#E2E7EF] flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-150 focus:outline-none`}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E2E7EF] flex items-center justify-between shrink-0 bg-white">
          <div>
            <h2 id="detail-modal-title" className="text-base font-semibold text-slate-900 leading-tight">
              {title}
            </h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:ring-2 focus:ring-[#1F4FD8]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="p-4 sm:p-5 border-t border-[#E2E7EF] bg-slate-50/50 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
