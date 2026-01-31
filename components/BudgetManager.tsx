
import React, { useState, useRef } from 'react';
import { CATEGORIES, CATEGORY_TYPES, ICONS } from '../constants';
import { AppConfig, MonthlyBudget, Category, ExpenseType } from '../types';

interface BudgetManagerProps {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
  isDark?: boolean;
}

const BudgetManager: React.FC<BudgetManagerProps> = ({ config, onSave, isDark = true }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const monthInputRef = useRef<HTMLInputElement>(null);
  
  const budget = config.budgets[selectedMonth] || {
    salary: 0,
    categories: CATEGORIES.reduce((acc, cat) => {
      acc[cat] = { amount: 0, type: CATEGORY_TYPES[cat] };
      return acc;
    }, {} as Record<Category, { amount: number; type: ExpenseType }>)
  };

  const adjustMonth = (delta: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const handleSalaryChange = (val: string) => {
    const num = parseInt(val) || 0;
    const newConfig = {
      ...config,
      budgets: JSON.parse(JSON.stringify(config.budgets))
    };
    if (!newConfig.budgets[selectedMonth]) {
      newConfig.budgets[selectedMonth] = {
        salary: num,
        categories: JSON.parse(JSON.stringify(budget.categories))
      };
    } else {
      newConfig.budgets[selectedMonth].salary = num;
    }
    onSave(newConfig);
  };

  const handleCategoryAmountChange = (cat: Category, val: string) => {
    const num = parseInt(val) || 0;
    const newConfig = {
      ...config,
      budgets: JSON.parse(JSON.stringify(config.budgets))
    };
    if (!newConfig.budgets[selectedMonth]) {
      newConfig.budgets[selectedMonth] = {
        salary: budget.salary,
        categories: JSON.parse(JSON.stringify(budget.categories))
      };
    }
    newConfig.budgets[selectedMonth].categories[cat].amount = num;
    onSave(newConfig);
  };

  const totalBudgeted = Object.values(budget.categories).reduce((sum, c) => sum + c.amount, 0);
  const leftToBudget = budget.salary - totalBudgeted;

  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(selectedMonth + '-01'));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 lg:grid lg:grid-cols-3 lg:gap-8">
      {/* Left Column - Month & Salary (1 col on desktop) */}
      <div className="space-y-6 mb-6 lg:mb-0">
      {/* Month Selector Header */}
      <div className={`flex items-center justify-between rounded-2xl p-2 pr-4 shadow-sm ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => adjustMonth(-1)}
            className={`p-3 rounded-xl transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-900'}`}
          >
            <ICONS.ChevronLeft className="w-5 h-5" />
          </button>
          <div className="relative">
            <input
              ref={monthInputRef}
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
            />
            <button
              type="button"
              onClick={() => monthInputRef.current?.showPicker()}
              className={`px-4 py-2 rounded-xl border flex items-center gap-3 transition-colors cursor-pointer ${isDark ? 'bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
            >
              <ICONS.Calendar className={`w-4 h-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
              <span className={`text-sm font-bold tracking-tight ${isDark ? 'text-zinc-200' : 'text-gray-700'}`}>
                {monthName}
              </span>
            </button>
          </div>
          <button
            onClick={() => adjustMonth(1)}
            className={`p-3 rounded-xl transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-900'}`}
          >
            <ICONS.ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={() => setSelectedMonth(new Date().toISOString().slice(0, 7))}
          className={`text-[10px] font-black uppercase tracking-widest transition-colors px-3 py-2 ${isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
        >
          Today
        </button>
      </div>

      {/* Salary & Summary Card */}
      <div className={`rounded-3xl p-6 shadow-2xl relative overflow-hidden group ${isDark ? 'bg-[#111] border border-zinc-800' : 'bg-white border border-gray-200'}`}>
        <div className={`absolute top-0 right-0 p-8 transition-opacity ${isDark ? 'opacity-[0.03] group-hover:opacity-[0.05]' : 'opacity-[0.02] group-hover:opacity-[0.04]'}`}>
          <ICONS.Table className="w-32 h-32" />
        </div>

        <div className="flex items-center gap-8 relative z-10">
          <div className="flex-1">
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-zinc-600' : 'bg-gray-400'}`} />
              Expected Salary
            </p>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>¥</span>
              <input
                type="number"
                value={budget.salary || ''}
                onChange={(e) => handleSalaryChange(e.target.value)}
                placeholder="0"
                className={`w-full bg-transparent border-none text-4xl font-bold focus:ring-0 p-0 tracking-tighter outline-none ${isDark ? 'text-white' : 'text-gray-900'}`}
              />
            </div>
          </div>
          <div className="text-right">
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Available</p>
            <p className={`text-2xl font-bold tracking-tight ${leftToBudget < 0 ? 'text-rose-500' : leftToBudget === 0 ? (isDark ? 'text-zinc-500' : 'text-gray-400') : 'text-emerald-500'}`}>
              ¥{leftToBudget.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
      </div>

      {/* Right Column - Budget Table (2 cols on desktop) */}
      <div className="lg:col-span-2 space-y-6">
      {/* Expenses Table */}
      <div className={`rounded-3xl overflow-hidden shadow-sm ${isDark ? 'bg-zinc-900/20 border border-zinc-800' : 'bg-white border border-gray-200'}`}>
        <div className={`p-5 border-b flex items-center justify-between ${isDark ? 'border-zinc-800 bg-zinc-900/40' : 'border-gray-200 bg-gray-50'}`}>
           <h3 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Budget Allocation</h3>
           <div className="flex gap-1">
              <div className="w-1 h-1 rounded-full bg-rose-500" />
              <div className="w-1 h-1 rounded-full bg-blue-500" />
              <div className="w-1 h-1 rounded-full bg-amber-500" />
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`text-[9px] font-black uppercase tracking-[0.25em] border-b ${isDark ? 'text-zinc-600 border-zinc-800/50' : 'text-gray-400 border-gray-200'}`}>
                <th className="px-6 py-4">Expense</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-right">Budget</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-zinc-800/50' : 'divide-gray-100'}`}>
              {CATEGORIES.map((cat) => {
                const catBudget = budget.categories[cat];
                const percentage = budget.salary > 0 ? ((catBudget.amount / budget.salary) * 100).toFixed(1) : '0';

                return (
                  <tr key={cat} className={`group transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'}`}>
                    <td className="px-6 py-4">
                      <p className={`text-xs font-bold tracking-wide ${catBudget.amount > 0 ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-zinc-600' : 'text-gray-400')}`}>
                        {cat}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[8px] font-black px-2 py-1 rounded-md tracking-tighter ${
                        catBudget.type === 'NEED' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                        catBudget.type === 'WANT' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                        catBudget.type === 'SAVE' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                        isDark ? 'bg-zinc-800 text-zinc-500 border border-zinc-700' : 'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}>
                        {catBudget.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <input
                          type="number"
                          value={catBudget.amount || ''}
                          onChange={(e) => handleCategoryAmountChange(cat, e.target.value)}
                          placeholder="0"
                          className={`w-24 bg-transparent border-none text-right font-bold text-sm focus:ring-0 p-0 outline-none ${isDark ? 'text-white' : 'text-gray-900'}`}
                        />
                        <span className={`text-[8px] font-bold mt-0.5 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>{percentage}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr className={`backdrop-blur-md ${isDark ? 'bg-zinc-900/60' : 'bg-gray-50'}`}>
                <td colSpan={2} className={`px-6 py-5 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Total Planned</td>
                <td className="px-6 py-5 text-right">
                  <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>¥{totalBudgeted.toLocaleString()}</p>
                  <p className={`text-[8px] font-bold mt-0.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                    {budget.salary > 0 ? Math.round((totalBudgeted / budget.salary) * 100) : 0}% OF SALARY
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="pb-12 px-2 lg:pb-0">
        <div className={`flex items-start gap-3 p-4 rounded-2xl ${isDark ? 'bg-zinc-900/30 border border-zinc-800/50' : 'bg-gray-50 border border-gray-200'}`}>
          <ICONS.AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
          <p className={`text-[10px] leading-relaxed font-medium ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
            Setting your budget ahead of time helps you visualize your cash flow.
            The system uses the budget for {monthName} to calculate your progress in the Track tab.
          </p>
        </div>
      </div>
      </div>
    </div>
  );
};

export default BudgetManager;
