
import React, { useState, useRef, useEffect } from 'react';
/* Use CATEGORY_TYPES instead of CATEGORY_DEFAULTS as defined in constants.tsx */
import { CATEGORIES, ICONS, CATEGORY_TYPES } from '../constants';
import { Category, ExpenseType, Expense, ReceiptExtraction } from '../types';
import { extractReceiptData } from '../services/gemini';

interface ExpenseFormProps {
  onSave: (expense: Omit<Expense, 'id' | 'timestamp' | 'synced'>) => void;
  apiKey: string;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ onSave, apiKey }) => {
  const [amount, setAmount] = useState<string>('');
  /* Corrected default Category to 'FOOD' to match Category type definition */
  const [category, setCategory] = useState<Category>('FOOD');
  /* Corrected default ExpenseType to 'NEED' to match ExpenseType type definition */
  const [type, setType] = useState<ExpenseType>('NEED');
  const [store, setStore] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Smart defaults based on category
  useEffect(() => {
    /* Use CATEGORY_TYPES instead of CATEGORY_DEFAULTS */
    setType(CATEGORY_TYPES[category]);
  }, [category]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;

    onSave({
      amount: Number(amount),
      category,
      type,
      store: store || 'Unknown Store',
      date,
      notes,
      source: 'manual'
    });

    // Reset
    setAmount('');
    setStore('');
    setNotes('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !apiKey) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result: ReceiptExtraction = await extractReceiptData(apiKey, base64, file.type);
        
        setAmount(result.total.toString());
        setStore(result.store);
        if (result.date && result.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            setDate(result.date);
        }
        setNotes(result.items.map(i => `${i.name}: ¥${i.price}`).join('\n'));
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
    <div className="bg-[#111] border border-zinc-800 rounded-2xl p-6 mb-8 shadow-xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Type Toggle (Need/Want/Save) */}
        <div className="flex p-1 bg-zinc-900 rounded-xl">
          {/* Corrected values to uppercase ('NEED', 'WANT', 'SAVE') to match ExpenseType definition */}
          {(['NEED', 'WANT', 'SAVE'] as ExpenseType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${
                type === t ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Amount (¥)</label>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-zinc-900 border-none rounded-xl py-4 px-4 text-2xl font-bold focus:ring-2 focus:ring-white/10 transition-all outline-none"
              required
            />
          </div>
          <div className="pt-6">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning || !apiKey}
              className={`p-4 rounded-xl flex items-center justify-center transition-all ${
                isScanning ? 'bg-zinc-800' : 'bg-zinc-800 hover:bg-zinc-700 active:scale-95 border border-zinc-700'
              }`}
            >
              {isScanning ? (
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <ICONS.Camera className="w-6 h-6 text-zinc-400" />
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full bg-zinc-900 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-white/10 outline-none appearance-none font-medium"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-zinc-900 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-white/10 outline-none font-medium text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Store / Description</label>
          <input
            type="text"
            value={store}
            onChange={(e) => setStore(e.target.value)}
            placeholder="Seven-Eleven, Amazon, etc."
            className="w-full bg-zinc-900 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-white/10 outline-none font-medium"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-zinc-200 active:scale-[0.98] transition-all shadow-lg"
        >
          Save Entry
        </button>
      </form>
    </div>
  );
};

export default ExpenseForm;
