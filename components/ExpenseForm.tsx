
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ICONS, PAYMENT_METHODS, DEFAULT_CATEGORIES } from '../constants';
import { Category, ExpenseType, Expense, ReceiptExtraction, PaymentMethod, CategoryDefinition, BankAccount } from '../types';
import { extractReceiptData } from '../services/gemini';

interface ExpenseFormProps {
  onSave: (expense: Omit<Expense, 'id' | 'timestamp' | 'synced'>) => void;
  apiKey: string;
  isDark?: boolean;
  categories?: CategoryDefinition[];
  bankAccounts?: BankAccount[];
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ onSave, apiKey, isDark = true, categories = DEFAULT_CATEGORIES, bankAccounts = [] }) => {
  const [amount, setAmount] = useState<string>('');
  const [type, setType] = useState<ExpenseType>('NEED');
  const [category, setCategory] = useState<Category>('');
  const [store, setStore] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState<string>('');  // HH:MM from receipt OCR
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [isFromReceipt, setIsFromReceipt] = useState(false);  // Track if data came from receipt scan

  // Get default account for Card/Bank payments
  const defaultAccount = bankAccounts.find(a => a.isDefault) || bankAccounts[0];

  // Auto-select default account when payment method changes to Card/Bank
  useEffect(() => {
    if (paymentMethod !== 'Cash' && !selectedAccountId && defaultAccount) {
      setSelectedAccountId(defaultAccount.id);
    }
  }, [paymentMethod, selectedAccountId, defaultAccount]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter categories by selected type
  const filteredCategories = useMemo(() =>
    categories.filter(cat => cat.defaultType === type),
    [categories, type]
  );

  // Auto-select first category when type changes (but not when form is reset)
  useEffect(() => {
    if (filteredCategories.length > 0 && category) {
      // Only auto-select if category is set but not in filtered list (type changed)
      const currentCatInFiltered = filteredCategories.find(c => c.id === category);
      if (!currentCatInFiltered) {
        setCategory(filteredCategories[0].id);
      }
    }
  }, [filteredCategories, category]);

  // Check if form is valid for submission
  const needsAccount = paymentMethod !== 'Cash' && bankAccounts.length > 0;
  const hasValidAccount = !needsAccount || selectedAccountId;
  const isFormValid = amount && !isNaN(Number(amount)) && Number(amount) > 0 && category && paymentMethod && date && hasValidAccount;

  // Build the final payment method string
  // Format: Cash, Card, Bank (legacy) or Card:{accountId}, Bank:{accountId} (with accounts)
  const getFinalPaymentMethod = (): string => {
    if (paymentMethod === 'Cash') return 'Cash';
    if (bankAccounts.length === 0) return paymentMethod; // Legacy: no accounts defined
    if (paymentMethod === 'Card') {
      return selectedAccountId ? `Card:${selectedAccountId}` : 'Card';
    }
    // Bank transfer - use Bank:{accountId} format for consistency with Card
    return selectedAccountId ? `Bank:${selectedAccountId}` : 'Bank';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const expense: Omit<Expense, 'id' | 'timestamp' | 'synced'> = {
      amount: Number(amount),
      category,
      type,
      paymentMethod: getFinalPaymentMethod() as PaymentMethod,
      store: store || 'Unknown Store',
      date,
      notes,
      source: isFromReceipt ? 'receipt' : 'manual'
    };

    // Include time if available (from receipt scan)
    if (time && time.match(/^\d{2}:\d{2}$/)) {
      expense.time = time;
    }

    onSave(expense);

    // Reset form to clear state
    setAmount('');
    setStore('');
    setNotes('');
    setDate('');
    setTime('');
    setCategory('');
    setPaymentMethod('' as PaymentMethod);
    setSelectedAccountId('');
    setIsFromReceipt(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !apiKey) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result: ReceiptExtraction = await extractReceiptData(apiKey, base64, file.type, categories);

        setAmount(result.total.toString());
        setStore(result.store);
        if (result.date && result.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            setDate(result.date);
        }
        // Extract time if available (format: HH:MM)
        if (result.time && result.time.match(/^\d{2}:\d{2}$/)) {
          setTime(result.time);
        } else {
          setTime('');
        }
        setNotes(result.items.map(i => `${i.name}: ¥${i.price}`).join('\n'));
        setIsFromReceipt(true);

        // Apply AI-suggested category if valid
        if (result.suggestedCategory) {
          const suggestedCat = categories.find(c => c.id === result.suggestedCategory);
          if (suggestedCat) {
            setType(suggestedCat.defaultType);
            setCategory(suggestedCat.id);
          }
        }
        // Override with AI-suggested type if provided
        if (result.suggestedType && ['NEED', 'WANT', 'SAVE', 'DEBT'].includes(result.suggestedType)) {
          setType(result.suggestedType);
        }

        setIsScanning(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('OCR Error:', error);
      alert('Failed to scan receipt. Please enter manually.');
      setIsScanning(false);
    }
  };

  return (
    <div className={`rounded-xl p-4 overflow-hidden ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-gray-200'}`}>
      <form onSubmit={handleSubmit} className="space-y-5 overflow-hidden">

        {/* Type Toggle (Need/Want/Save) */}
        <div className={`flex p-1 rounded-xl ${isDark ? 'bg-zinc-900' : 'bg-gray-100'}`}>
          {/* Corrected values to uppercase ('NEED', 'WANT', 'SAVE') to match ExpenseType definition */}
          {(['NEED', 'WANT', 'SAVE'] as ExpenseType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 py-2 text-xs font-medium uppercase rounded-lg transition-colors ${
                type === t
                  ? isDark ? 'bg-zinc-700 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm'
                  : isDark ? 'text-zinc-500 hover:text-zinc-400' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Amount (¥)</label>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={`w-full border-none rounded-xl py-4 px-4 text-2xl font-bold focus:ring-2 transition-colors outline-none ${isDark ? 'bg-zinc-900 text-white focus:ring-white/10' : 'bg-gray-100 text-gray-900 focus:ring-gray-300'}`}
              required
            />
          </div>
          <div className="pt-6">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning || !apiKey}
              title={!apiKey ? 'Add Gemini API key in Settings to enable receipt scanning' : 'Scan receipt'}
              className={`p-4 rounded-xl flex items-center justify-center transition-colors ${
                !apiKey
                  ? isDark ? 'bg-zinc-900 opacity-40 cursor-not-allowed' : 'bg-gray-100 opacity-40 cursor-not-allowed'
                  : isScanning
                    ? isDark ? 'bg-zinc-800' : 'bg-gray-200'
                    : isDark ? 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700' : 'bg-gray-100 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              {isScanning ? (
                <div className={`w-6 h-6 border-2 rounded-full animate-spin ${isDark ? 'border-white/20 border-t-white' : 'border-gray-300 border-t-gray-600'}`} />
              ) : (
                <ICONS.Camera className={`w-6 h-6 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
              )}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              capture="environment"
              className="hidden"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className={`w-full border-none rounded-xl py-3 px-3 text-sm focus:ring-2 outline-none appearance-none font-medium ${isDark ? 'bg-zinc-900 focus:ring-white/10' : 'bg-gray-100 focus:ring-gray-300'} ${category ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-zinc-500' : 'text-gray-400')}`}
            >
              <option value="" disabled>Select...</option>
              {filteredCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Payment</label>
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value as PaymentMethod);
                // Reset account selection when changing payment method
                if (e.target.value === 'Cash') {
                  setSelectedAccountId('');
                } else if (defaultAccount) {
                  setSelectedAccountId(defaultAccount.id);
                }
              }}
              className={`w-full border-none rounded-xl py-3 px-3 text-sm focus:ring-2 outline-none appearance-none font-medium ${isDark ? 'bg-zinc-900 focus:ring-white/10' : 'bg-gray-100 focus:ring-gray-300'} ${paymentMethod ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-zinc-500' : 'text-gray-400')}`}
            >
              <option value="" disabled>Select...</option>
              {PAYMENT_METHODS.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Account selector for Card/Bank payments */}
        {paymentMethod !== 'Cash' && paymentMethod && bankAccounts.length > 0 && (
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
              {paymentMethod === 'Card' ? 'Card From Account' : 'From Account'}
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className={`w-full border-none rounded-xl py-3 px-3 text-sm focus:ring-2 outline-none appearance-none font-medium ${isDark ? 'bg-zinc-900 focus:ring-white/10' : 'bg-gray-100 focus:ring-gray-300'} ${selectedAccountId ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-zinc-500' : 'text-gray-400')}`}
            >
              <option value="" disabled>Select account...</option>
              {bankAccounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}{account.isDefault ? ' (Default)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="overflow-hidden">
          <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Date</label>
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

        <div>
          <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Store / Description</label>
          <input
            type="text"
            value={store}
            onChange={(e) => setStore(e.target.value)}
            placeholder="Seven-Eleven, Amazon, etc."
            className={`w-full border-none rounded-xl py-3 px-4 text-sm focus:ring-2 outline-none font-medium ${isDark ? 'bg-zinc-900 text-white focus:ring-white/10 placeholder:text-zinc-600' : 'bg-gray-100 text-gray-900 focus:ring-gray-300 placeholder:text-gray-400'}`}
          />
        </div>

        <button
          type="submit"
          disabled={!isFormValid}
          className={`w-full font-bold py-4 rounded-xl transition-colors ${
            isFormValid
              ? isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-gray-900 text-white hover:bg-gray-800'
              : isDark ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Save Entry
        </button>
      </form>
    </div>
  );
};

export default ExpenseForm;
