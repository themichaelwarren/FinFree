
import React, { useState, useMemo } from 'react';
import { Transfer, TransferDirection, BankAccount } from '../types';
import { ArrowRight } from 'lucide-react';

interface TransferFormProps {
  onSave: (transfer: Omit<Transfer, 'id' | 'timestamp' | 'synced'>, fee?: number) => void;
  isDark?: boolean;
  bankAccounts?: BankAccount[];
}

const TransferForm: React.FC<TransferFormProps> = ({ onSave, isDark = true, bankAccounts = [] }) => {
  const [amount, setAmount] = useState<string>('');
  const [fromAccountId, setFromAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [showFee, setShowFee] = useState(false);
  const [fee, setFee] = useState<string>('');

  // All accounts including Cash
  const allAccounts = useMemo(() => [
    { id: 'cash', name: 'Cash', isDefault: false },
    ...bankAccounts
  ], [bankAccounts]);

  // Filter "to" options to exclude selected "from"
  const toAccountOptions = useMemo(() =>
    allAccounts.filter(a => a.id !== fromAccountId),
    [allAccounts, fromAccountId]
  );

  // Get default bank account
  const defaultBankAccount = bankAccounts.find(a => a.isDefault) || bankAccounts[0];

  // Check if form is valid for submission
  const isFormValid = amount && !isNaN(Number(amount)) && Number(amount) > 0 && fromAccountId && toAccountId && date;

  // Derive legacy direction for backwards compatibility
  const getLegacyDirection = (): TransferDirection | undefined => {
    if (fromAccountId === 'cash' && toAccountId !== 'cash') return 'CASH_TO_BANK';
    if (fromAccountId !== 'cash' && toAccountId === 'cash') return 'BANK_TO_CASH';
    return undefined; // Bank-to-bank transfers have no legacy direction
  };

  // Generate default description based on selected accounts
  const getDefaultDescription = (): string => {
    const from = allAccounts.find(a => a.id === fromAccountId);
    const to = allAccounts.find(a => a.id === toAccountId);
    if (toAccountId === 'cash') return 'ATM Withdrawal';
    if (fromAccountId === 'cash') return 'Bank Deposit';
    return `Transfer to ${to?.name || 'account'}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const feeAmount = showFee && fee && !isNaN(Number(fee)) ? Number(fee) : undefined;

    onSave({
      amount: Number(amount),
      fromAccountId,
      toAccountId,
      description: description || getDefaultDescription(),
      date,
      notes,
      direction: getLegacyDirection()
    }, feeAmount);

    // Reset form
    setAmount('');
    setFromAccountId('');
    setToAccountId('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setShowFee(false);
    setFee('');
  };

  // Quick preset for ATM Withdrawal
  const setATMWithdrawal = () => {
    if (defaultBankAccount) {
      setFromAccountId(defaultBankAccount.id);
      setToAccountId('cash');
    }
  };

  // Quick preset for Bank Deposit
  const setBankDeposit = () => {
    if (defaultBankAccount) {
      setFromAccountId('cash');
      setToAccountId(defaultBankAccount.id);
    }
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

        {/* Quick Presets */}
        {bankAccounts.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={setATMWithdrawal}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                fromAccountId !== 'cash' && toAccountId === 'cash'
                  ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                  : isDark ? 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              ATM Withdrawal
            </button>
            <button
              type="button"
              onClick={setBankDeposit}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                fromAccountId === 'cash' && toAccountId !== 'cash'
                  ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'
                  : isDark ? 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Bank Deposit
            </button>
          </div>
        )}

        {/* From / To Account Selection */}
        <div className="grid grid-cols-5 gap-2 items-end">
          <div className="col-span-2">
            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>From</label>
            <select
              value={fromAccountId}
              onChange={(e) => {
                setFromAccountId(e.target.value);
                // Clear "to" if it conflicts
                if (e.target.value === toAccountId) {
                  setToAccountId('');
                }
              }}
              className={`w-full border-none rounded-xl py-3 px-3 text-sm focus:ring-2 outline-none appearance-none font-medium ${isDark ? 'bg-zinc-900 focus:ring-white/10' : 'bg-gray-100 focus:ring-gray-300'} ${fromAccountId ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-zinc-500' : 'text-gray-400')}`}
            >
              <option value="" disabled>Select...</option>
              {allAccounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}{account.isDefault ? ' *' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-center pb-3">
            <ArrowRight className={`w-5 h-5 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
          </div>
          <div className="col-span-2">
            <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>To</label>
            <select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className={`w-full border-none rounded-xl py-3 px-3 text-sm focus:ring-2 outline-none appearance-none font-medium ${isDark ? 'bg-zinc-900 focus:ring-white/10' : 'bg-gray-100 focus:ring-gray-300'} ${toAccountId ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-zinc-500' : 'text-gray-400')}`}
              disabled={!fromAccountId}
            >
              <option value="" disabled>Select...</option>
              {toAccountOptions.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}{account.isDefault ? ' *' : ''}
                </option>
              ))}
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

        {/* Transfer Fee Toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowFee(!showFee)}
            className={`flex items-center gap-2 text-xs font-medium transition-colors ${isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
              showFee
                ? isDark ? 'bg-blue-600 border-blue-600 text-white' : 'bg-blue-600 border-blue-600 text-white'
                : isDark ? 'border-zinc-600' : 'border-gray-400'
            }`}>
              {showFee && '✓'}
            </span>
            Include transfer fee (ATM fee, wire fee, etc.)
          </button>

          {showFee && (
            <div className="mt-3">
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Fee Amount (¥)</label>
              <input
                type="number"
                inputMode="numeric"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0"
                className={`w-full border-none rounded-xl py-3 px-4 text-sm focus:ring-2 outline-none font-medium ${isDark ? 'bg-zinc-900 text-white focus:ring-white/10 placeholder:text-zinc-600' : 'bg-gray-100 text-gray-900 focus:ring-gray-300 placeholder:text-gray-400'}`}
              />
              <p className={`text-[10px] mt-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                Will be recorded as a Fees expense
              </p>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className={`block text-[10px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={fromAccountId && toAccountId ? getDefaultDescription() : 'ATM at station, bank deposit, etc.'}
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
              ? isDark ? 'bg-blue-600 text-white hover:bg-blue-500 active:scale-[0.98]' : 'bg-blue-600 text-white hover:bg-blue-500 active:scale-[0.98]'
              : isDark ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Add Transfer
        </button>
      </form>
    </div>
  );
};

export default TransferForm;
