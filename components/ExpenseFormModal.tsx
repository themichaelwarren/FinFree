
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import ExpenseForm from './ExpenseForm';
import IncomeForm from './IncomeForm';
import TransferForm from './TransferForm';
import { Expense, CategoryDefinition, Income, Transfer, BankAccount } from '../types';

type TransactionMode = 'expense' | 'income' | 'transfer';

interface ExpenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveExpense: (expense: Omit<Expense, 'id' | 'timestamp' | 'synced'>) => void;
  onSaveIncome: (income: Omit<Income, 'id' | 'timestamp' | 'synced'>) => void;
  onSaveTransfer: (transfer: Omit<Transfer, 'id' | 'timestamp' | 'synced'>) => void;
  apiKey: string;
  isDark?: boolean;
  categories?: CategoryDefinition[];
  bankAccounts?: BankAccount[];
  initialMode?: TransactionMode;
}

const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onClose,
  onSaveExpense,
  onSaveIncome,
  onSaveTransfer,
  apiKey,
  isDark = true,
  categories,
  bankAccounts = [],
  initialMode = 'expense'
}) => {
  const [mode, setMode] = useState<TransactionMode>(initialMode);

  // Reset mode when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
    }
  }, [isOpen, initialMode]);

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

  const handleSaveExpense = (expense: Omit<Expense, 'id' | 'timestamp' | 'synced'>) => {
    onSaveExpense(expense);
    onClose();
  };

  const handleSaveIncome = (income: Omit<Income, 'id' | 'timestamp' | 'synced'>) => {
    onSaveIncome(income);
    onClose();
  };

  const handleSaveTransfer = (transfer: Omit<Transfer, 'id' | 'timestamp' | 'synced'>) => {
    onSaveTransfer(transfer);
    onClose();
  };

  const getModeLabel = () => {
    switch (mode) {
      case 'expense': return 'Expense';
      case 'income': return 'Income';
      case 'transfer': return 'Transfer';
    }
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
        className={`relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl shadow-sm ${
          isDark ? 'bg-zinc-950 border border-zinc-800' : 'bg-white border border-gray-200'
        }`}
      >
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-gray-200'}`}>
          <h2 className={`text-sm font-semibold ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
            New {getModeLabel()}
          </h2>
          <button
            onClick={onClose}
            className={`p-2 -mr-2 rounded-xl transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-500 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-900'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="px-4 pt-4">
          <div className={`flex p-1 rounded-xl ${isDark ? 'bg-zinc-900' : 'bg-gray-100'}`}>
            <button
              type="button"
              onClick={() => setMode('expense')}
              className={`flex-1 py-2.5 text-xs font-medium rounded-lg transition-colors ${
                mode === 'expense'
                  ? isDark ? 'bg-zinc-700 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm'
                  : isDark ? 'text-zinc-500 hover:text-zinc-400' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => setMode('income')}
              className={`flex-1 py-2.5 text-xs font-medium rounded-lg transition-colors ${
                mode === 'income'
                  ? isDark ? 'bg-emerald-700 text-white shadow-sm' : 'bg-emerald-600 text-white shadow-sm'
                  : isDark ? 'text-zinc-500 hover:text-zinc-400' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Income
            </button>
            <button
              type="button"
              onClick={() => setMode('transfer')}
              className={`flex-1 py-2.5 text-xs font-medium rounded-lg transition-colors ${
                mode === 'transfer'
                  ? isDark ? 'bg-blue-700 text-white shadow-sm' : 'bg-blue-600 text-white shadow-sm'
                  : isDark ? 'text-zinc-500 hover:text-zinc-400' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Transfer
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-4 pb-8">
          {mode === 'expense' && (
            <ExpenseForm
              onSave={handleSaveExpense}
              apiKey={apiKey}
              isDark={isDark}
              categories={categories}
              bankAccounts={bankAccounts}
            />
          )}
          {mode === 'income' && (
            <IncomeForm
              onSave={handleSaveIncome}
              isDark={isDark}
              bankAccounts={bankAccounts}
            />
          )}
          {mode === 'transfer' && (
            <TransferForm
              onSave={handleSaveTransfer}
              isDark={isDark}
              bankAccounts={bankAccounts}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpenseFormModal;
