
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

  // Credit Card Reconciliation: Card spending vs DEBT payments
  const creditCardSummary = useMemo(() => {
    // Card spending = expenses paid with Card payment method
    const cardSpending = monthlyExpenses
      .filter(e => e.paymentMethod === 'Card' || e.paymentMethod.startsWith('Card:'))
      .reduce((sum, e) => sum + e.amount, 0);

    // DEBT payments = expenses categorized as DEBT (typically CC payments)
    const debtPayments = monthlyExpenses
      .filter(e => e.category === 'DEBT')
      .reduce((sum, e) => sum + e.amount, 0);

    // Count of transactions
    const cardCount = monthlyExpenses.filter(e => e.paymentMethod === 'Card' || e.paymentMethod.startsWith('Card:')).length;
    const debtCount = monthlyExpenses.filter(e => e.category === 'DEBT').length;

    const difference = cardSpending - debtPayments;
    const isBalanced = Math.abs(difference) < 100; // Within ¥100 tolerance

    return { cardSpending, debtPayments, cardCount, debtCount, difference, isBalanced };
  }, [monthlyExpenses]);

  // Memoize balance items to avoid key warnings from inline array creation
  const balanceItems = useMemo(() => {
    const startingBalance = config.balances?.startingBalance;
    const cashStarting = startingBalance?.cash;

    const items = [
      {
        id: 'cash',
        name: 'Cash',
        balance: runningBalance.cash,
        isDefault: false,
        hasStartingBalance: !!cashStarting,
        startingDate: cashStarting?.asOfDate
      }
    ];
    if (bankAccounts.length === 0) {
      const legacyStarting = startingBalance?.accounts?.['bank_default'] !== undefined || startingBalance?.bank !== undefined;
      items.push({
        id: 'bank-legacy',
        name: 'Bank',
        balance: runningBalance.bank || 0,
        isDefault: false,
        hasStartingBalance: legacyStarting,
        startingDate: legacyStarting ? startingBalance?.asOfDate : undefined
      });
    } else {
      bankAccounts.forEach(acc => {
        const accStarting = startingBalance?.accountBalances?.[acc.id];
        items.push({
          id: acc.id,
          name: acc.name,
          balance: runningBalance.accounts[acc.id] || 0,
          isDefault: acc.isDefault,
          hasStartingBalance: !!accStarting,
          startingDate: accStarting?.asOfDate
        });
      });
    }
    return items;
  }, [runningBalance, bankAccounts, config.balances?.startingBalance]);

  return (
    <div className={`rounded-xl p-4 mb-6 overflow-hidden ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-gray-200'}`}>

      {/* Running Balance - Cash on Hand */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Cash on Hand</h3>
          {onUpdateStartingBalance && (
            <button
              onClick={() => setShowStartingBalanceEdit(!showStartingBalanceEdit)}
              className={`text-xs font-medium ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {showStartingBalanceEdit ? 'Hide' : 'Edit Starting Balances'}
            </button>
          )}
        </div>

        <div className={`grid gap-4 mb-3 ${bankAccounts.length > 1 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {balanceItems.map(item => (
            <div key={item.id}>
              <p className={`text-xs font-medium mb-1 flex items-center gap-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                {item.name}
                {item.isDefault && <span className="text-amber-500">*</span>}
              </p>
              <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ¥{item.balance.toLocaleString()}
              </p>
              <p className={`text-xs mt-0.5 ${item.hasStartingBalance ? (isDark ? 'text-emerald-500' : 'text-emerald-600') : (isDark ? 'text-zinc-600' : 'text-gray-400')}`}>
                {item.hasStartingBalance
                  ? `Set: ${new Date(item.startingDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  : 'No starting balance'}
              </p>
            </div>
          ))}
        </div>

        <div className={`pt-2 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex justify-between items-center">
            <p className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Total</p>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>¥{runningBalance.total.toLocaleString()}</p>
          </div>
        </div>

        {/* Starting Balance Edit - Per-account with individual dates */}
        {showStartingBalanceEdit && onUpdateStartingBalance && (
          <div className={`mt-4 pt-4 border-t space-y-4 ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
            <p className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Starting Balances</p>
            <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
              Set each account's balance as of a specific date. Only transactions after that date will be counted.
            </p>

            {/* Cash with its own date */}
            <div className={`p-3 rounded-xl space-y-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'}`}>
              <label className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Cash</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Balance</label>
                  <input
                    type="number"
                    value={config.balances?.startingBalance?.cash?.balance ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      const currentCash = config.balances?.startingBalance?.cash;
                      onUpdateStartingBalance({
                        ...config.balances?.startingBalance,
                        cash: value === '' ? undefined : {
                          balance: Number(value) || 0,
                          asOfDate: currentCash?.asOfDate || new Date().toISOString().split('T')[0]
                        }
                      });
                    }}
                    className={`w-full p-2 rounded-lg text-sm font-medium ${isDark ? 'bg-zinc-900 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                    placeholder="Not set"
                  />
                </div>
                <div>
                  <label className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>As of Date</label>
                  <input
                    type="date"
                    value={config.balances?.startingBalance?.cash?.asOfDate || ''}
                    onChange={(e) => {
                      const currentCash = config.balances?.startingBalance?.cash;
                      if (currentCash?.balance !== undefined || e.target.value) {
                        onUpdateStartingBalance({
                          ...config.balances?.startingBalance,
                          cash: {
                            balance: currentCash?.balance || 0,
                            asOfDate: e.target.value
                          }
                        });
                      }
                    }}
                    disabled={config.balances?.startingBalance?.cash?.balance === undefined}
                    className={`w-full p-2 rounded-lg text-sm font-medium ${isDark ? 'bg-zinc-900 text-white disabled:opacity-50' : 'bg-white text-gray-900 border border-gray-200 disabled:opacity-50'}`}
                  />
                </div>
              </div>
              {config.balances?.startingBalance?.cash && (
                <button
                  onClick={() => {
                    const { cash, ...rest } = config.balances?.startingBalance || {};
                    onUpdateStartingBalance(Object.keys(rest).length > 0 ? rest : undefined as any);
                  }}
                  className={`text-xs font-medium ${isDark ? 'text-rose-400 hover:text-rose-300' : 'text-rose-500 hover:text-rose-600'}`}
                >
                  Clear cash starting balance
                </button>
              )}
            </div>

            {/* Bank accounts with individual dates */}
            {bankAccounts.map(account => {
              const accountBalance = config.balances?.startingBalance?.accountBalances?.[account.id];
              return (
                <div key={account.id} className={`p-3 rounded-xl space-y-2 ${isDark ? 'bg-zinc-800' : 'bg-gray-50'}`}>
                  <label className={`text-xs font-medium flex items-center gap-1 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                    {account.name}
                    {account.isDefault && <span className="text-amber-500">*</span>}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Balance</label>
                      <input
                        type="number"
                        value={accountBalance?.balance ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          const currentAccountBalances = config.balances?.startingBalance?.accountBalances || {};
                          let newAccountBalances: Record<string, { balance: number; asOfDate: string }>;

                          if (value === '') {
                            // Remove this account's starting balance
                            const { [account.id]: removed, ...rest } = currentAccountBalances;
                            newAccountBalances = rest;
                          } else {
                            newAccountBalances = {
                              ...currentAccountBalances,
                              [account.id]: {
                                balance: Number(value) || 0,
                                asOfDate: accountBalance?.asOfDate || new Date().toISOString().split('T')[0]
                              }
                            };
                          }

                          onUpdateStartingBalance({
                            ...config.balances?.startingBalance,
                            accountBalances: Object.keys(newAccountBalances).length > 0 ? newAccountBalances : undefined
                          });
                        }}
                        className={`w-full p-2 rounded-lg text-sm font-medium ${isDark ? 'bg-zinc-900 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                        placeholder="Not set"
                      />
                    </div>
                    <div>
                      <label className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>As of Date</label>
                      <input
                        type="date"
                        value={accountBalance?.asOfDate || ''}
                        onChange={(e) => {
                          const currentAccountBalances = config.balances?.startingBalance?.accountBalances || {};
                          onUpdateStartingBalance({
                            ...config.balances?.startingBalance,
                            accountBalances: {
                              ...currentAccountBalances,
                              [account.id]: {
                                balance: accountBalance?.balance || 0,
                                asOfDate: e.target.value
                              }
                            }
                          });
                        }}
                        disabled={accountBalance?.balance === undefined}
                        className={`w-full p-2 rounded-lg text-sm font-medium ${isDark ? 'bg-zinc-900 text-white disabled:opacity-50' : 'bg-white text-gray-900 border border-gray-200 disabled:opacity-50'}`}
                      />
                    </div>
                  </div>
                  {accountBalance && (
                    <button
                      onClick={() => {
                        const currentAccountBalances = config.balances?.startingBalance?.accountBalances || {};
                        const { [account.id]: removed, ...rest } = currentAccountBalances;
                        onUpdateStartingBalance({
                          ...config.balances?.startingBalance,
                          accountBalances: Object.keys(rest).length > 0 ? rest : undefined
                        });
                      }}
                      className={`text-xs font-medium ${isDark ? 'text-rose-400 hover:text-rose-300' : 'text-rose-500 hover:text-rose-600'}`}
                    >
                      Clear {account.name} starting balance
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Prompt to set starting balance if none set */}
        {!config.balances?.startingBalance && onUpdateStartingBalance && (
          <button
            onClick={() => setShowStartingBalanceEdit(true)}
            className={`mt-3 w-full py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
              isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
            }`}
          >
            Set Starting Balances
          </button>
        )}
      </div>

      {/* Daily Budget Allowance */}
      {dailyAllowance.daysRemaining > 0 && (
        <div className={`mb-6 p-4 rounded-xl ${isDark ? 'bg-emerald-950 border border-emerald-900' : 'bg-emerald-50 border border-emerald-200'}`}>
          <div className="flex justify-between items-center">
            <div>
              <p className={`text-xs font-medium mb-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Daily Budget</p>
              <p className={`text-2xl font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                ¥{Math.round(dailyAllowance.overall).toLocaleString()}<span className="text-sm font-medium opacity-60">/day</span>
              </p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-medium mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{dailyAllowance.daysRemaining} days left</p>
              <p className={`text-sm font-medium ${dailyAllowance.budgetRemaining >= 0 ? (isDark ? 'text-zinc-400' : 'text-gray-600') : 'text-rose-500'}`}>
                ¥{Math.round(dailyAllowance.budgetRemaining).toLocaleString()} remaining
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-8">
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
                className={`text-sm font-semibold transition-colors cursor-pointer ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-700'}`}
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
          <p className={`text-xs font-medium mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Target</p>
          <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>¥{budget.salary.toLocaleString()}</p>
        </div>
      </div>

      {/* Monthly Income & Net Cash Flow */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className={`p-3 rounded-xl ${isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-50 border border-gray-200'}`}>
          <p className={`text-xs font-medium mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Income</p>
          <p className={`text-sm font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>+¥{monthlyIncome.toLocaleString()}</p>
        </div>
        <div className={`p-3 rounded-xl ${isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-50 border border-gray-200'}`}>
          <p className={`text-xs font-medium mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Expenses</p>
          <p className={`text-sm font-bold ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>-¥{totalSpent.toLocaleString()}</p>
        </div>
        <div className={`p-3 rounded-xl ${isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-50 border border-gray-200'}`}>
          <p className={`text-xs font-medium mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Net</p>
          <p className={`text-sm font-bold ${netCashFlow >= 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-rose-400' : 'text-rose-600')}`}>
            {netCashFlow >= 0 ? '+' : ''}¥{netCashFlow.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Progress Bar (Total Spent vs Salary) */}
      <div className="space-y-4 mb-8">
        <div className={`h-2 w-full rounded-full flex overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
          <div
            className="h-full bg-rose-500 rounded-full transition-colors duration-500"
            style={{ width: `${Math.min(getPercentage(typeSpent.NEED), 100)}%` }}
          />
          <div
            className="h-full bg-blue-500 rounded-full transition-colors duration-500 mx-px"
            style={{ width: `${Math.min(getPercentage(typeSpent.WANT), 100)}%` }}
          />
          <div
            className="h-full bg-amber-500 rounded-full transition-colors duration-500"
            style={{ width: `${Math.min(getPercentage(typeSpent.SAVE), 100)}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div className="flex flex-col gap-0.5">
            <span className="text-rose-500 font-medium">Need {getPercentage(typeSpent.NEED)}%</span>
            <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>¥{typeSpent.NEED.toLocaleString()}</span>
          </div>
          <div className="flex flex-col gap-0.5 text-center">
            <span className="text-blue-500 font-medium">Want {getPercentage(typeSpent.WANT)}%</span>
            <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>¥{typeSpent.WANT.toLocaleString()}</span>
          </div>
          <div className="flex flex-col gap-0.5 text-right">
            <span className="text-amber-500 font-medium">Save {getPercentage(typeSpent.SAVE)}%</span>
            <span className={isDark ? 'text-zinc-500' : 'text-gray-400'}>¥{typeSpent.SAVE.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Category Breakdown vs Budget */}
      <div className={`space-y-4 pt-6 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
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
              <div key={cat} className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className={`text-sm font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{cat}</span>
                  <div className="text-right">
                    <span className={`text-sm font-semibold ${spent > catBudget && catBudget > 0 ? 'text-rose-500' : isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
                      ¥{spent.toLocaleString()}
                    </span>
                    {catBudget > 0 && (
                      <span className={`text-xs ml-2 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                        / ¥{catBudget.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`h-1 w-full rounded-full overflow-hidden ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                  <div
                    className={`h-full transition-colors duration-500 ${spent > catBudget && catBudget > 0 ? 'bg-rose-500' : isDark ? 'bg-zinc-600' : 'bg-gray-400'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
      </div>

      {/* Credit Card Reconciliation */}
      {(creditCardSummary.cardSpending > 0 || creditCardSummary.debtPayments > 0) && (
        <div className={`mt-6 pt-6 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-xs font-medium flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
              <ICONS.CreditCard className="w-3.5 h-3.5" />
              Credit Card
            </h3>
            {creditCardSummary.isBalanced ? (
              <span className="text-xs font-medium text-emerald-500 flex items-center gap-1">
                <ICONS.CheckCircle2 className="w-3 h-3" />
                Balanced
              </span>
            ) : (
              <span className="text-xs font-medium text-amber-500">
                ¥{Math.abs(creditCardSummary.difference).toLocaleString()} {creditCardSummary.difference > 0 ? 'unpaid' : 'overpaid'}
              </span>
            )}
          </div>

          {creditCardSummary.isBalanced ? (
            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
              ¥{creditCardSummary.cardSpending.toLocaleString()} spent on card ({creditCardSummary.cardCount} txns)
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-xl p-3 ${isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-50 border border-gray-200'}`}>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Card Spending</p>
                <p className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  ¥{creditCardSummary.cardSpending.toLocaleString()}
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                  {creditCardSummary.cardCount} transaction{creditCardSummary.cardCount !== 1 ? 's' : ''}
                </p>
              </div>

              <div className={`rounded-xl p-3 ${isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-50 border border-gray-200'}`}>
                <p className={`text-xs font-medium mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>CC Payments</p>
                <p className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  ¥{creditCardSummary.debtPayments.toLocaleString()}
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                  {creditCardSummary.debtCount} payment{creditCardSummary.debtCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}

          {!creditCardSummary.isBalanced && creditCardSummary.difference > 0 && (
            <p className={`text-xs mt-3 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
              Record a DEBT expense for ¥{creditCardSummary.difference.toLocaleString()} to balance your CC spending
            </p>
          )}
        </div>
      )}

      {/* Legacy Account Balances (manual entry) - only show if no starting balance set */}
      {onUpdateBalances && !config.balances?.startingBalance && (
        <div className={`mt-6 pt-6 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Manual Balances</h3>
            {config.balances?.lastUpdated && (
              <span className={`text-xs ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                Updated {new Date(config.balances.lastUpdated).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl p-4 ${isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-50 border border-gray-200'}`}>
              <p className={`text-xs font-medium mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Cash</p>
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
            <div className={`rounded-xl p-4 ${isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-50 border border-gray-200'}`}>
              <p className={`text-xs font-medium mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Bank</p>
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
          <p className={`text-xs mt-3 font-medium ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
            Total: ¥{((config.balances?.cash || 0) + (config.balances?.bank || 0)).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
};

export default BudgetSummary;
