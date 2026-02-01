
import React, { useState } from 'react';
import { INCOME_CATEGORIES } from '../constants';
import { Income, IncomeCategory, IncomePaymentMethod, BankAccount } from '../types';

interface IncomeFormProps {
  onSave: (income: Omit<Income, 'id' | 'timestamp' | 'synced'>) => void;
  isDark?: boolean;
  bankAccounts?: BankAccount[];
}

const IncomeForm: React.FC<IncomeFormProps> = ({ onSave, isDark = true, bankAccounts = [] }) => {
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<IncomeCategory | ''>('');
  const [depositTo, setDepositTo] = useState<string>(''); // 'Cash' or bank account ID
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Check if form is valid for submission
  const isFormValid = amount && !isNaN(Number(amount)) && Number(amount) > 0 && category && depositTo && date;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    // Convert depositTo to paymentMethod
    // 'Cash' stays as 'Cash', bank account IDs are used directly
    const paymentMethod = depositTo as IncomePaymentMethod;

    onSave({
      amount: Number(amount),
      category: category as IncomeCategory,
      paymentMethod,
      description: description || 'Income',
      date,
      notes
    });

    // Reset form
    setAmount('');
    setCategory('');
    setDepositTo('');
    setDescription('');
    setDate('');
    setNotes('');
  };

  return (
    <div className={`rounded-2xl p-6 mb-8 shadow-xl overflow-hidden ${isDark ? 'bg-[#111] border border-zinc-800' : 'bg-white border border-gray-200'}`}>
      <form onSubmit={handleSubmit} className="space-y-5 overflow-hidden">
        {/* Amount */}
        <div>
          <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Amount (¥)</label>
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className={`w-full border-none rounded-xl py-4 px-4 text-2xl font-bold focus:ring-2 transition-all outline-none ${isDark ? 'bg-zinc-900 text-white focus:ring-white/10' : 'bg-gray-100 text-gray-900 focus:ring-gray-300'}`}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Category */}
          <div>
            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as IncomeCategory)}
              className={`w-full border-none rounded-xl py-3 px-3 text-sm focus:ring-2 outline-none appearance-none font-medium ${isDark ? 'bg-zinc-900 focus:ring-white/10' : 'bg-gray-100 focus:ring-gray-300'} ${category ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-zinc-500' : 'text-gray-400')}`}
            >
              <option value="" disabled>Select...</option>
              {INCOME_CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Deposit To Account */}
          <div>
            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Deposit To</label>
            <select
              value={depositTo}
              onChange={(e) => setDepositTo(e.target.value)}
              className={`w-full border-none rounded-xl py-3 px-3 text-sm focus:ring-2 outline-none appearance-none font-medium ${isDark ? 'bg-zinc-900 focus:ring-white/10' : 'bg-gray-100 focus:ring-gray-300'} ${depositTo ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-zinc-500' : 'text-gray-400')}`}
            >
              <option value="" disabled>Select...</option>
              <option value="Cash">Cash</option>
              {bankAccounts.length > 0 ? (
                bankAccounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name}{account.isDefault ? ' (Default)' : ''}
                  </option>
                ))
              ) : (
                <option value="Bank">Bank</option>
              )}
            </select>
          </div>
        </div>

        {/* Date */}
        <div className="overflow-hidden">
          <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Date</label>
          <div className="overflow-hidden rounded-xl">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ maxWidth: '100%', width: '100%' }}
              className={`block w-full border-none rounded-xl py-3 px-4 text-sm focus:ring-2 outline-none font-medium ${isDark ? 'bg-zinc-900 text-white focus:ring-white/10' : 'bg-gray-100 text-gray-900 focus:ring-gray-300'}`}
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Monthly salary, freelance project, etc."
            className={`w-full border-none rounded-xl py-3 px-4 text-sm focus:ring-2 outline-none font-medium ${isDark ? 'bg-zinc-900 text-white focus:ring-white/10 placeholder:text-zinc-600' : 'bg-gray-100 text-gray-900 focus:ring-gray-300 placeholder:text-gray-400'}`}
          />
        </div>

        {/* Notes (optional) */}
        <div>
          <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional details..."
            rows={2}
            className={`w-full border-none rounded-xl py-3 px-4 text-sm focus:ring-2 outline-none font-medium resize-none ${isDark ? 'bg-zinc-900 text-white focus:ring-white/10 placeholder:text-zinc-600' : 'bg-gray-100 text-gray-900 focus:ring-gray-300 placeholder:text-gray-400'}`}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isFormValid}
          className={`w-full font-bold py-4 rounded-xl transition-all shadow-lg ${
            isFormValid
              ? isDark ? 'bg-emerald-600 text-white hover:bg-emerald-500 active:scale-[0.98]' : 'bg-emerald-600 text-white hover:bg-emerald-500 active:scale-[0.98]'
              : isDark ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Add Income
        </button>
      </form>
    </div>
  );
};

export default IncomeForm;
