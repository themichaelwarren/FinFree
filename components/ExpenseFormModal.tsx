
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import ExpenseForm from './ExpenseForm';
import { Expense, CategoryDefinition } from '../types';

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Omit<Expense, 'id' | 'timestamp' | 'synced'>) => void;
  apiKey: string;
  isDark?: boolean;
  categories?: CategoryDefinition[];
}

const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  apiKey,
  isDark = true,
  categories
}) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = (expense: Omit<Expense, 'id' | 'timestamp' | 'synced'>) => {
    onSave(expense);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 transition-opacity ${isDark ? 'bg-black/80' : 'bg-black/50'}`}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 ${
          isDark ? 'bg-[#0a0a0a] border border-zinc-800' : 'bg-white border border-gray-200'
        }`}
      >
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b ${isDark ? 'bg-[#0a0a0a] border-zinc-800' : 'bg-white border-gray-200'}`}>
          <h2 className={`text-sm font-bold uppercase tracking-[0.15em] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
            New Expense
          </h2>
          <button
            onClick={onClose}
            className={`p-2 -mr-2 rounded-xl transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-500 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-900'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-4 pb-8">
          <ExpenseForm
            onSave={handleSave}
            apiKey={apiKey}
            isDark={isDark}
            categories={categories}
          />
        </div>
      </div>
    </div>
  );
};

export default ExpenseFormModal;
