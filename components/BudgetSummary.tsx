
import React, { useState, useRef, useMemo } from 'react';
import { Expense, AppConfig, AccountBalances, Income, StartingBalance, Transfer, BankAccount } from '../types';
import { CATEGORIES, getBudgetForMonth, ICONS } from '../constants';
import { calculations } from '../services/calculations';

interface BudgetSummaryProps {
  expenses: Expense[];
  income: Income[];
  transfers?: Transfer[];
  config: AppConfig;
  bankAccounts?: BankAccount[];
  onUpdateBalances?: (balances: AccountBalances) => void;
  onUpdateStartingBalance?: (startingBalance: StartingBalance) => void;
  isDark?: boolean;
}

const BudgetSummary: React.FC<BudgetSummaryProps> = ({
  expenses,
  income,
  transfers = [],
  config,
  bankAccounts = [],
  onUpdateBalances,
  onUpdateStartingBalance,
  isDark = true
}) => {
  const [viewMonth, setViewMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showStartingBalanceEdit, setShowStartingBalanceEdit] = useState(false);
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

  // Calculate running balance from starting balance + income - expenses + transfers
  const runningBalance = useMemo(() =>
    calculations.calculateRunningBalance(
      config.balances?.startingBalance,
      income,
      expenses,
      transfers,
      bankAccounts
    ),
    [config.balances?.startingBalance, income, expenses, transfers, bankAccounts]
  );

  // Calculate daily allowance for current month
  const dailyAllowance = useMemo(() =>
    calculations.calculateDailyAllowance(
      budget,
      expenses,
      viewMonth
    ),
    [budget, expenses, viewMonth]
  );

  // Monthly income and net cash flow
  const monthlyIncome = calculations.getMonthlyIncome(income, viewMonth);
  const netCashFlow = calculations.getNetCashFlow(income, expenses, viewMonth);

  // Memoize balance items to avoid key warnings from inline array creation
  const balanceItems = useMemo(() => {
    const items = [
      { id: 'cash', name: 'Cash', balance: runningBalance.cash, isDefault: false }
    ];
    if (bankAccounts.length === 0) {
      items.push({ id: 'bank-legacy', name: 'Bank', balance: runningBalance.bank || 0, isDefault: false });
    } else {
      bankAccounts.forEach(acc => {
        items.push({ id: acc.id, name: acc.name, balance: runningBalance.accounts[acc.id] || 0, isDefault: acc.isDefault });
      });
    }
    return items;
  }, [runningBalance, bankAccounts]);

  return (
    <div className={`rounded-3xl p-6 mb-8 shadow-2xl overflow-hidden relative group ${isDark ? 'bg-[#111] border border-zinc-800' : 'bg-white border border-gray-200'}`}>
      {/* Background Month Watermark */}
      <div className={`absolute -top-4 -right-4 text-[120px] font-black pointer-events-none select-none tracking-tighter uppercase leading-none ${isDark ? 'text-white/[0.02]' : 'text-black/[0.02]'}`}>
        {new Date(viewMonth + '-01').getMonth() + 1}
      </div>

      {/* Running Balance - Cash on Hand */}
      <div className={`mb-6 p-4 rounded-2xl relative z-10 ${isDark ? 'bg-zinc-900/50 border border-zinc-800/50' : 'bg-gray-50 border border-gray-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Cash on Hand</h3>
          {config.balances?.startingBalance && (
            <button
              onClick={() => setShowStartingBalanceEdit(!showStartingBalanceEdit)}
              className={`text-[8px] font-medium ${isDark ? 'text-zinc-600 hover:text-zinc-400' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {showStartingBalanceEdit ? 'Hide' : 'Edit Starting Balance'}
            </button>
          )}
        </div>

        <div className={`grid gap-4 mb-3 ${bankAccounts.length > 1 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {balanceItems.map(item => (
            <div key={item.id}>
              <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                {item.name}
                {item.isDefault && <span className="text-amber-500">*</span>}
              </p>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ¥{item.balance.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <div className={`pt-2 border-t ${isDark ? 'border-zinc-800/50' : 'border-gray-200'}`}>
          <div className="flex justify-between items-center">
            <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Total</p>
            <p className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>¥{runningBalance.total.toLocaleString()}</p>
          </div>
        </div>

        {/* Starting Balance Edit */}
        {showStartingBalanceEdit && onUpdateStartingBalance && (
          <div className={`mt-4 pt-4 border-t space-y-3 ${isDark ? 'border-zinc-800/50' : 'border-gray-200'}`}>
            <p className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Starting Balance</p>
            {/* Cash input */}
            <div>
              <label className={`text-[8px] font-medium ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Cash</label>
              <input
                type="number"
                value={config.balances?.startingBalance?.cash || ''}
                onChange={(e) => onUpdateStartingBalance({
                  cash: Number(e.target.value) || 0,
                  accounts: config.balances?.startingBalance?.accounts || {},
                  asOfDate: config.balances?.startingBalance?.asOfDate || new Date().toISOString().split('T')[0],
                  bank: config.balances?.startingBalance?.bank
                })}
                className={`w-full p-2 rounded-lg text-sm font-medium ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                placeholder="0"
              />
            </div>
            {/* Bank account inputs */}
            {bankAccounts.length === 0 ? (
              <div>
                <label className={`text-[8px] font-medium ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Bank</label>
                <input
                  type="number"
                  value={config.balances?.startingBalance?.bank || ''}
                  onChange={(e) => onUpdateStartingBalance({
                    cash: config.balances?.startingBalance?.cash || 0,
                    accounts: {},
                    asOfDate: config.balances?.startingBalance?.asOfDate || new Date().toISOString().split('T')[0],
                    bank: Number(e.target.value) || 0
                  })}
                  className={`w-full p-2 rounded-lg text-sm font-medium ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                  placeholder="0"
                />
              </div>
            ) : (
              <div className={`grid gap-2 ${bankAccounts.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {bankAccounts.map(account => (
                  <div key={account.id}>
                    <label className={`text-[8px] font-medium ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                      {account.name} {account.isDefault && '(Default)'}
                    </label>
                    <input
                      type="number"
                      value={config.balances?.startingBalance?.accounts?.[account.id] || ''}
                      onChange={(e) => onUpdateStartingBalance({
                        cash: config.balances?.startingBalance?.cash || 0,
                        accounts: {
                          ...config.balances?.startingBalance?.accounts,
                          [account.id]: Number(e.target.value) || 0
                        },
                        asOfDate: config.balances?.startingBalance?.asOfDate || new Date().toISOString().split('T')[0]
                      })}
                      className={`w-full p-2 rounded-lg text-sm font-medium ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            )}
            {/* Date on its own row for full visibility */}
            <div>
              <label className={`text-[8px] font-medium ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>As of Date</label>
              <input
                type="date"
                value={config.balances?.startingBalance?.asOfDate || ''}
                onChange={(e) => onUpdateStartingBalance({
                  cash: config.balances?.startingBalance?.cash || 0,
                  accounts: config.balances?.startingBalance?.accounts || {},
                  asOfDate: e.target.value
                })}
                className={`w-full p-2 rounded-lg text-sm font-medium ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
              />
            </div>
          </div>
        )}

        {/* Prompt to set starting balance if not set */}
        {!config.balances?.startingBalance && onUpdateStartingBalance && (
          <button
            onClick={() => {
              // Initialize accounts from bank accounts
              const initialAccounts: Record<string, number> = {};
              bankAccounts.forEach(acc => {
                initialAccounts[acc.id] = 0;
              });
              onUpdateStartingBalance({
                cash: config.balances?.cash || 0,
                accounts: initialAccounts,
                asOfDate: new Date().toISOString().split('T')[0],
                bank: config.balances?.bank || 0
              });
            }}
            className={`mt-3 w-full py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
              isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
            }`}
          >
            Set Starting Balance
          </button>
        )}
      </div>

      {/* Daily Budget Allowance */}
      {dailyAllowance.daysRemaining > 0 && (
        <div className={`mb-6 p-4 rounded-2xl relative z-10 ${isDark ? 'bg-emerald-950/30 border border-emerald-900/30' : 'bg-emerald-50 border border-emerald-200'}`}>
          <div className="flex justify-between items-center">
            <div>
              <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-emerald-500/70' : 'text-emerald-600'}`}>Daily Budget</p>
              <p className={`text-2xl font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                ¥{Math.round(dailyAllowance.overall).toLocaleString()}<span className="text-sm font-medium opacity-60">/day</span>
              </p>
            </div>
            <div className="text-right">
              <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{dailyAllowance.daysRemaining} days left</p>
              <p className={`text-sm font-medium ${dailyAllowance.budgetRemaining >= 0 ? (isDark ? 'text-zinc-400' : 'text-gray-600') : 'text-rose-500'}`}>
                ¥{Math.round(dailyAllowance.budgetRemaining).toLocaleString()} remaining
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-8 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <button onClick={() => adjustMonth(-1)} className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-600 hover:text-zinc-400' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`}>
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
                className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors cursor-pointer ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {monthName}
              </button>
            </div>
            <button onClick={() => adjustMonth(1)} className={`p-1 rounded transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-600 hover:text-zinc-400' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`}>
              <ICONS.ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <h2 className={`text-4xl font-bold tracking-tighter ${isDark ? 'text-white' : 'text-gray-900'}`}>¥{totalSpent.toLocaleString()}</h2>
        </div>
        <div className="text-right">
          <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Target</p>
          <p className={`font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>¥{budget.salary.toLocaleString()}</p>
        </div>
      </div>

      {/* Monthly Income & Net Cash Flow */}
      <div className={`grid grid-cols-3 gap-3 mb-6 relative z-10`}>
        <div className={`p-3 rounded-xl ${isDark ? 'bg-zinc-900/50 border border-zinc-800/50' : 'bg-gray-50 border border-gray-200'}`}>
          <p className={`text-[8px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Income</p>
          <p className={`text-sm font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>+¥{monthlyIncome.toLocaleString()}</p>
        </div>
        <div className={`p-3 rounded-xl ${isDark ? 'bg-zinc-900/50 border border-zinc-800/50' : 'bg-gray-50 border border-gray-200'}`}>
          <p className={`text-[8px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Expenses</p>
          <p className={`text-sm font-bold ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>-¥{totalSpent.toLocaleString()}</p>
        </div>
        <div className={`p-3 rounded-xl ${isDark ? 'bg-zinc-900/50 border border-zinc-800/50' : 'bg-gray-50 border border-gray-200'}`}>
          <p className={`text-[8px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Net</p>
          <p className={`text-sm font-bold ${netCashFlow >= 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-rose-400' : 'text-rose-600')}`}>
            {netCashFlow >= 0 ? '+' : ''}¥{netCashFlow.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Progress Bar (Total Spent vs Salary) */}
      <div className="space-y-5 mb-10 relative z-10">
        <div className={`h-2.5 w-full rounded-full flex overflow-hidden p-0.5 ${isDark ? 'bg-zinc-900 border border-zinc-800/50' : 'bg-gray-100 border border-gray-200'}`}>
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
        <div className={`grid grid-cols-3 gap-4 text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
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
      <div className={`space-y-5 pt-6 border-t relative z-10 ${isDark ? 'border-zinc-800/50' : 'border-gray-200'}`}>
        {CATEGORIES
          .map(cat => {
            const spent = monthlyExpenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0);
            const catBudget = budget.categories[cat]?.amount || 0;
            return { cat, spent, catBudget };
          })
          .filter(({ spent, catBudget }) => spent > 0 || catBudget > 0)
          .map(({ cat, spent, catBudget }) => {
            const percent = catBudget > 0 ? Math.min(Math.round((spent / catBudget) * 100), 100) : 0;

            return (
              <div key={cat} className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{cat}</span>
                  <div className="text-right">
                    <span className={`text-xs font-black tracking-tight ${spent > catBudget && catBudget > 0 ? 'text-rose-500' : isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                      ¥{spent.toLocaleString()}
                    </span>
                    {catBudget > 0 && (
                      <span className={`text-[9px] font-bold ml-2 tracking-widest ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                        / ¥{catBudget.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`h-1 w-full rounded-full overflow-hidden ${isDark ? 'bg-zinc-900/50 border border-zinc-800/30' : 'bg-gray-100 border border-gray-200'}`}>
                  <div
                    className={`h-full transition-all duration-1000 ${spent > catBudget && catBudget > 0 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]' : isDark ? 'bg-zinc-700' : 'bg-gray-400'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
      </div>

      {/* Legacy Account Balances (manual entry) - only show if no starting balance set */}
      {onUpdateBalances && !config.balances?.startingBalance && (
        <div className={`mt-8 pt-6 border-t relative z-10 ${isDark ? 'border-zinc-800/50' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Manual Balances</h3>
            {config.balances?.lastUpdated && (
              <span className={`text-[8px] ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                Updated {new Date(config.balances.lastUpdated).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl p-4 ${isDark ? 'bg-zinc-900/50 border border-zinc-800/50' : 'bg-gray-50 border border-gray-200'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Cash</p>
              <div className="flex items-center gap-1">
                <span className={`font-bold ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>¥</span>
                <input
                  type="number"
                  value={config.balances?.cash || ''}
                  onChange={(e) => onUpdateBalances({
                    ...config.balances,
                    cash: Number(e.target.value) || 0,
                    lastUpdated: new Date().toISOString()
                  })}
                  className={`w-full bg-transparent text-lg font-bold focus:ring-0 p-0 outline-none ${isDark ? 'text-white' : 'text-gray-900'}`}
                  placeholder="0"
                />
              </div>
            </div>
            <div className={`rounded-xl p-4 ${isDark ? 'bg-zinc-900/50 border border-zinc-800/50' : 'bg-gray-50 border border-gray-200'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Bank</p>
              <div className="flex items-center gap-1">
                <span className={`font-bold ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>¥</span>
                <input
                  type="number"
                  value={config.balances?.bank || ''}
                  onChange={(e) => onUpdateBalances({
                    ...config.balances,
                    bank: Number(e.target.value) || 0,
                    lastUpdated: new Date().toISOString()
                  })}
                  className={`w-full bg-transparent text-lg font-bold focus:ring-0 p-0 outline-none ${isDark ? 'text-white' : 'text-gray-900'}`}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <p className={`text-xs mt-3 font-bold ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
            Total: ¥{((config.balances?.cash || 0) + (config.balances?.bank || 0)).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
};

export default BudgetSummary;
