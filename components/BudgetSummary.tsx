
import React, { useState, useRef } from 'react';
import { Expense, Category, AppConfig, ExpenseType, AccountBalances } from '../types';
import { CATEGORIES, getBudgetForMonth, ICONS } from '../constants';

interface BudgetSummaryProps {
  expenses: Expense[];
  config: AppConfig;
  onUpdateBalances?: (balances: AccountBalances) => void;
}

const BudgetSummary: React.FC<BudgetSummaryProps> = ({ expenses, config, onUpdateBalances }) => {
  const [viewMonth, setViewMonth] = useState(new Date().toISOString().slice(0, 7));
  const monthInputRef = useRef<HTMLInputElement>(null);
  
  const budget = getBudgetForMonth(config.budgets, viewMonth);

  const adjustMonth = (delta: number) => {
    const [year, month] = viewMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setViewMonth(newMonth);
  };

  const monthlyExpenses = expenses.filter(e => {
    return e.date.startsWith(viewMonth);
  });

  const totalSpent = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
  
  // Breakdown by Type (NEED/WANT/SAVE)
  const typeSpent = {
    NEED: monthlyExpenses.filter(e => e.type === 'NEED').reduce((sum, e) => sum + e.amount, 0),
    WANT: monthlyExpenses.filter(e => e.type === 'WANT').reduce((sum, e) => sum + e.amount, 0),
    SAVE: monthlyExpenses.filter(e => e.type === 'SAVE').reduce((sum, e) => sum + e.amount, 0),
  };

  const getPercentage = (amount: number) => totalSpent === 0 ? 0 : Math.round((amount / totalSpent) * 100);

  const monthName = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(viewMonth + '-01'));

  return (
    <div className="bg-[#111] border border-zinc-800 rounded-3xl p-6 mb-8 shadow-2xl overflow-hidden relative group">
      {/* Background Month Watermark */}
      <div className="absolute -top-4 -right-4 text-[120px] font-black text-white/[0.02] pointer-events-none select-none tracking-tighter uppercase leading-none">
        {new Date(viewMonth + '-01').getMonth() + 1}
      </div>

      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <button onClick={() => adjustMonth(-1)} className="p-1 hover:bg-zinc-800 rounded text-zinc-600 hover:text-zinc-400 transition-colors">
              <ICONS.ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="relative inline-block">
              <input
                ref={monthInputRef}
                type="month"
                value={viewMonth}
                onChange={(e) => setViewMonth(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
              />
              <button
                type="button"
                onClick={() => monthInputRef.current?.showPicker()}
                className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] hover:text-zinc-300 transition-colors cursor-pointer"
              >
                {monthName}
              </button>
            </div>
            <button onClick={() => adjustMonth(1)} className="p-1 hover:bg-zinc-800 rounded text-zinc-600 hover:text-zinc-400 transition-colors">
              <ICONS.ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <h2 className="text-4xl font-bold tracking-tighter text-white">¥{totalSpent.toLocaleString()}</h2>
        </div>
        <div className="text-right">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Target</p>
          <p className="text-white font-black tracking-tight">¥{budget.salary.toLocaleString()}</p>
        </div>
      </div>

      {/* Progress Bar (Total Spent vs Salary) */}
      <div className="space-y-5 mb-10 relative z-10">
        <div className="h-2.5 w-full bg-zinc-900 rounded-full flex overflow-hidden p-0.5 border border-zinc-800/50">
          <div 
            className="h-full bg-emerald-500 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(16,185,129,0.2)]" 
            style={{ width: `${Math.min(getPercentage(typeSpent.NEED), 100)}%` }} 
          />
          <div 
            className="h-full bg-blue-500 rounded-full transition-all duration-700 mx-0.5 shadow-[0_0_12px_rgba(59,130,246,0.2)]" 
            style={{ width: `${Math.min(getPercentage(typeSpent.WANT), 100)}%` }} 
          />
          <div 
            className="h-full bg-amber-500 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(245,158,11,0.2)]" 
            style={{ width: `${Math.min(getPercentage(typeSpent.SAVE), 100)}%` }} 
          />
        </div>
        <div className="grid grid-cols-3 gap-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">
          <div className="flex flex-col gap-1">
            <span className="text-emerald-500">NEED {getPercentage(typeSpent.NEED)}%</span>
            <span className="text-[8px] opacity-40">¥{typeSpent.NEED.toLocaleString()}</span>
          </div>
          <div className="flex flex-col gap-1 text-center">
            <span className="text-blue-500">WANT {getPercentage(typeSpent.WANT)}%</span>
            <span className="text-[8px] opacity-40">¥{typeSpent.WANT.toLocaleString()}</span>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <span className="text-amber-500">SAVE {getPercentage(typeSpent.SAVE)}%</span>
            <span className="text-[8px] opacity-40">¥{typeSpent.SAVE.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Category Breakdown vs Budget */}
      <div className="space-y-5 pt-6 border-t border-zinc-800/50 relative z-10">
        {CATEGORIES.map(cat => {
          const spent = monthlyExpenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
          const catBudget = budget.categories[cat]?.amount || 0;
          const percent = catBudget > 0 ? Math.min(Math.round((spent / catBudget) * 100), 100) : 0;

          if (spent === 0 && catBudget === 0) return null;

          return (
            <div key={cat} className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{cat}</span>
                <div className="text-right">
                  <span className={`text-xs font-black tracking-tight ${spent > catBudget && catBudget > 0 ? 'text-rose-500' : 'text-zinc-100'}`}>
                    ¥{spent.toLocaleString()}
                  </span>
                  {catBudget > 0 && (
                    <span className="text-[9px] font-bold text-zinc-600 ml-2 tracking-widest">
                      / ¥{catBudget.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-1 w-full bg-zinc-900/50 rounded-full overflow-hidden border border-zinc-800/30">
                <div
                  className={`h-full transition-all duration-1000 ${spent > catBudget && catBudget > 0 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]' : 'bg-zinc-700'}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Account Balances */}
      {onUpdateBalances && (
        <div className="mt-8 pt-6 border-t border-zinc-800/50 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Account Balances</h3>
            {config.balances?.lastUpdated && (
              <span className="text-[8px] text-zinc-600">
                Updated {new Date(config.balances.lastUpdated).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Cash</p>
              <div className="flex items-center gap-1">
                <span className="text-zinc-500 font-bold">¥</span>
                <input
                  type="number"
                  value={config.balances?.cash || ''}
                  onChange={(e) => onUpdateBalances({
                    ...config.balances,
                    cash: Number(e.target.value) || 0,
                    lastUpdated: new Date().toISOString()
                  })}
                  className="w-full bg-transparent text-lg font-bold text-white focus:ring-0 p-0 outline-none"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Bank</p>
              <div className="flex items-center gap-1">
                <span className="text-zinc-500 font-bold">¥</span>
                <input
                  type="number"
                  value={config.balances?.bank || ''}
                  onChange={(e) => onUpdateBalances({
                    ...config.balances,
                    bank: Number(e.target.value) || 0,
                    lastUpdated: new Date().toISOString()
                  })}
                  className="w-full bg-transparent text-lg font-bold text-white focus:ring-0 p-0 outline-none"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-3 font-bold">
            Total: ¥{((config.balances?.cash || 0) + (config.balances?.bank || 0)).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
};

export default BudgetSummary;
