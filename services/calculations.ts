
import { Expense, Income, Transfer, StartingBalance, MonthlyBudget, BankAccount } from '../types';
import { resolveAccountId } from './storage';

export interface RunningBalance {
  cash: number;
  accounts: Record<string, number>;  // accountId → balance
  total: number;
  calculatedAt: string;
  bank?: number;  // Legacy: sum of all bank accounts for backwards compatibility
}

export interface DailyAllowance {
  overall: number;
  byCategory: Record<string, number>;
  daysRemaining: number;
  budgetRemaining: number;
}

export interface FutureBalanceWarning {
  transactionId: string;
  transactionType: 'expense' | 'income' | 'transfer';
  accountId: string;
  accountName: string;
  projectedBalance: number;
  shortfall: number;
  date: string;
}

// Helper to get starting balance and date for a specific account
const getAccountStartingInfo = (
  startingBalance: StartingBalance | undefined,
  accountId: string
): { balance: number; asOfDate: string } => {
  const defaultDate = '1970-01-01';

  if (accountId === 'cash') {
    // Check new per-account format first
    if (startingBalance?.cash?.balance !== undefined) {
      return {
        balance: startingBalance.cash.balance,
        asOfDate: startingBalance.cash.asOfDate || defaultDate
      };
    }
    // No starting balance for cash - start from 0
    return { balance: 0, asOfDate: defaultDate };
  }

  // Bank account
  // Check new per-account format first
  if (startingBalance?.accountBalances?.[accountId]?.balance !== undefined) {
    return {
      balance: startingBalance.accountBalances[accountId].balance,
      asOfDate: startingBalance.accountBalances[accountId].asOfDate || defaultDate
    };
  }

  // Fall back to legacy format (single date for all)
  if (startingBalance?.accounts?.[accountId] !== undefined) {
    return {
      balance: startingBalance.accounts[accountId],
      asOfDate: startingBalance.asOfDate || defaultDate
    };
  }

  // Legacy 'bank' field for bank_default
  if (accountId === 'bank_default' && startingBalance?.bank !== undefined) {
    return {
      balance: startingBalance.bank,
      asOfDate: startingBalance.asOfDate || defaultDate
    };
  }

  // No starting balance - start from 0
  return { balance: 0, asOfDate: defaultDate };
};

export const calculations = {
  /**
   * Calculate running balance from starting balance, income, expenses, and transfers
   * Supports multiple bank accounts with per-account starting dates
   */
  calculateRunningBalance: (
    startingBalance: StartingBalance | undefined,
    income: Income[],
    expenses: Expense[],
    transfers: Transfer[] = [],
    bankAccounts: BankAccount[] = []
  ): RunningBalance => {
    // Get cash starting info
    const cashInfo = getAccountStartingInfo(startingBalance, 'cash');
    let cash = cashInfo.balance;
    const cashAsOfDate = cashInfo.asOfDate;

    // Initialize each bank account with its own starting balance and date
    const accounts: Record<string, number> = {};
    const accountDates: Record<string, string> = {};

    bankAccounts.forEach(account => {
      const info = getAccountStartingInfo(startingBalance, account.id);
      accounts[account.id] = info.balance;
      accountDates[account.id] = info.asOfDate;
    });

    // Ensure bank_default exists if needed but no accounts defined
    if (bankAccounts.length === 0) {
      const defaultInfo = getAccountStartingInfo(startingBalance, 'bank_default');
      accounts['bank_default'] = defaultInfo.balance;
      accountDates['bank_default'] = defaultInfo.asOfDate;
    }

    // Process income - only include if after the relevant account's asOfDate
    income.forEach(i => {
      const accountId = resolveAccountId(i.paymentMethod);
      const asOfDate = accountId === 'cash' ? cashAsOfDate : (accountDates[accountId] || accountDates['bank_default'] || '1970-01-01');

      if (i.date >= asOfDate) {
        if (accountId === 'cash') {
          cash += i.amount;
        } else if (accounts[accountId] !== undefined) {
          accounts[accountId] += i.amount;
        } else {
          accounts['bank_default'] = (accounts['bank_default'] || 0) + i.amount;
        }
      }
    });

    // Process expenses - only include if after the relevant account's asOfDate
    expenses.forEach(e => {
      const accountId = resolveAccountId(e.paymentMethod);
      const asOfDate = accountId === 'cash' ? cashAsOfDate : (accountDates[accountId] || accountDates['bank_default'] || '1970-01-01');

      if (e.date >= asOfDate) {
        if (accountId === 'cash') {
          cash -= e.amount;
        } else if (accounts[accountId] !== undefined) {
          accounts[accountId] -= e.amount;
        } else {
          accounts['bank_default'] = (accounts['bank_default'] || 0) - e.amount;
        }
      }
    });

    // Process transfers - check both source and destination account dates
    transfers.forEach(t => {
      let fromId: string;
      let toId: string;

      if (t.fromAccountId && t.toAccountId) {
        fromId = t.fromAccountId;
        toId = t.toAccountId;
      } else if (t.direction) {
        fromId = t.direction === 'BANK_TO_CASH' ? 'bank_default' : 'cash';
        toId = t.direction === 'BANK_TO_CASH' ? 'cash' : 'bank_default';
      } else {
        return; // Invalid transfer
      }

      const fromAsOfDate = fromId === 'cash' ? cashAsOfDate : (accountDates[fromId] || accountDates['bank_default'] || '1970-01-01');
      const toAsOfDate = toId === 'cash' ? cashAsOfDate : (accountDates[toId] || accountDates['bank_default'] || '1970-01-01');

      // Deduct from source if after its asOfDate
      if (t.date >= fromAsOfDate) {
        if (fromId === 'cash') {
          cash -= t.amount;
        } else if (accounts[fromId] !== undefined) {
          accounts[fromId] -= t.amount;
        } else {
          accounts['bank_default'] = (accounts['bank_default'] || 0) - t.amount;
        }
      }

      // Add to destination if after its asOfDate
      if (t.date >= toAsOfDate) {
        if (toId === 'cash') {
          cash += t.amount;
        } else if (accounts[toId] !== undefined) {
          accounts[toId] += t.amount;
        } else {
          accounts['bank_default'] = (accounts['bank_default'] || 0) + t.amount;
        }
      }
    });

    // Calculate totals
    const bankTotal = Object.values(accounts).reduce((sum, bal) => sum + bal, 0);
    const total = cash + bankTotal;

    return {
      cash,
      accounts,
      total,
      calculatedAt: new Date().toISOString(),
      bank: bankTotal  // Legacy compatibility
    };
  },

  /**
   * Calculate daily spending allowance based on budget remaining
   */
  calculateDailyAllowance: (
    budget: MonthlyBudget | undefined,
    expenses: Expense[],
    monthKey: string  // YYYY-MM format
  ): DailyAllowance => {
    if (!budget) {
      return {
        overall: 0,
        byCategory: {},
        daysRemaining: 0,
        budgetRemaining: 0
      };
    }

    const [year, month] = monthKey.split('-').map(Number);
    const today = new Date();
    const daysInMonth = new Date(year, month, 0).getDate();

    // Calculate days remaining in month
    let daysRemaining: number;
    if (today.getFullYear() === year && today.getMonth() + 1 === month) {
      daysRemaining = daysInMonth - today.getDate() + 1; // Include today
    } else if (new Date(year, month - 1, 1) > today) {
      daysRemaining = daysInMonth; // Future month
    } else {
      daysRemaining = 0; // Past month
    }

    // Filter expenses for this month
    const monthlyExpenses = expenses.filter(e => e.date.startsWith(monthKey));

    // Calculate overall budget remaining
    const totalBudgeted = Object.values(budget.categories).reduce((sum, cat) => sum + cat.amount, 0);
    const totalSpent = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
    const budgetRemaining = totalBudgeted - totalSpent;

    // Calculate overall daily allowance
    const overall = daysRemaining > 0 ? budgetRemaining / daysRemaining : 0;

    // Calculate per-category daily allowance
    const byCategory: Record<string, number> = {};
    for (const [category, catBudget] of Object.entries(budget.categories)) {
      const catSpent = monthlyExpenses
        .filter(e => e.category === category)
        .reduce((sum, e) => sum + e.amount, 0);
      const catRemaining = catBudget.amount - catSpent;
      byCategory[category] = daysRemaining > 0 ? catRemaining / daysRemaining : 0;
    }

    return {
      overall,
      byCategory,
      daysRemaining,
      budgetRemaining
    };
  },

  /**
   * Get total income for a month
   */
  getMonthlyIncome: (income: Income[], monthKey: string): number => {
    return income
      .filter(i => i.date.startsWith(monthKey))
      .reduce((sum, i) => sum + i.amount, 0);
  },

  /**
   * Get total expenses for a month
   */
  getMonthlyExpenses: (expenses: Expense[], monthKey: string): number => {
    return expenses
      .filter(e => e.date.startsWith(monthKey))
      .reduce((sum, e) => sum + e.amount, 0);
  },

  /**
   * Calculate net cash flow for a month (Income - Expenses)
   */
  getNetCashFlow: (income: Income[], expenses: Expense[], monthKey: string): number => {
    const monthlyIncome = calculations.getMonthlyIncome(income, monthKey);
    const monthlyExpenses = calculations.getMonthlyExpenses(expenses, monthKey);
    return monthlyIncome - monthlyExpenses;
  },

  /**
   * Get current month key in YYYY-MM format
   */
  getCurrentMonthKey: (): string => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  },

  /**
   * Calculate warnings for future transactions that would cause negative account balances
   * Returns a map of transaction ID -> warning details
   */
  calculateFutureBalanceWarnings: (
    startingBalance: StartingBalance | undefined,
    income: Income[],
    expenses: Expense[],
    transfers: Transfer[] = [],
    bankAccounts: BankAccount[] = []
  ): Map<string, FutureBalanceWarning> => {
    const warnings = new Map<string, FutureBalanceWarning>();
    const today = new Date().toISOString().split('T')[0];

    // Get current running balance (up to and including today)
    const currentBalance = calculations.calculateRunningBalance(
      startingBalance,
      income.filter(i => i.date <= today),
      expenses.filter(e => e.date <= today),
      transfers.filter(t => t.date <= today),
      bankAccounts
    );

    // Initialize projected balances from current state
    let projectedCash = currentBalance.cash;
    const projectedAccounts: Record<string, number> = { ...currentBalance.accounts };

    // Build account name lookup
    const accountNames: Record<string, string> = { cash: 'Cash' };
    bankAccounts.forEach(a => { accountNames[a.id] = a.name; });

    // Collect all future transactions and sort by date
    interface FutureTransaction {
      id: string;
      type: 'expense' | 'income' | 'transfer';
      date: string;
      amount: number;
      accountId: string;  // For expenses/income: target account
      fromAccountId?: string;  // For transfers
      toAccountId?: string;  // For transfers
      time?: string;
    }

    const futureTransactions: FutureTransaction[] = [];

    // Future expenses
    expenses
      .filter(e => e.date > today)
      .forEach(e => {
        futureTransactions.push({
          id: e.id,
          type: 'expense',
          date: e.date,
          time: e.time,
          amount: e.amount,
          accountId: resolveAccountId(e.paymentMethod)
        });
      });

    // Future income
    income
      .filter(i => i.date > today)
      .forEach(i => {
        futureTransactions.push({
          id: i.id,
          type: 'income',
          date: i.date,
          amount: i.amount,
          accountId: resolveAccountId(i.paymentMethod)
        });
      });

    // Future transfers
    transfers
      .filter(t => t.date > today)
      .forEach(t => {
        let fromId: string;
        let toId: string;

        if (t.fromAccountId && t.toAccountId) {
          fromId = t.fromAccountId;
          toId = t.toAccountId;
        } else if (t.direction) {
          fromId = t.direction === 'BANK_TO_CASH' ? 'bank_default' : 'cash';
          toId = t.direction === 'BANK_TO_CASH' ? 'cash' : 'bank_default';
        } else {
          return;
        }

        futureTransactions.push({
          id: t.id,
          type: 'transfer',
          date: t.date,
          amount: t.amount,
          accountId: fromId,  // Primary account affected
          fromAccountId: fromId,
          toAccountId: toId
        });
      });

    // Sort by date, then time (earliest first)
    futureTransactions.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time) return -1;
      if (b.time) return 1;
      return 0;
    });

    // Process transactions in chronological order
    for (const txn of futureTransactions) {
      if (txn.type === 'income') {
        // Income adds to account
        if (txn.accountId === 'cash') {
          projectedCash += txn.amount;
        } else {
          projectedAccounts[txn.accountId] = (projectedAccounts[txn.accountId] || 0) + txn.amount;
        }
      } else if (txn.type === 'expense') {
        // Expense subtracts from account
        let balance: number;
        if (txn.accountId === 'cash') {
          projectedCash -= txn.amount;
          balance = projectedCash;
        } else {
          projectedAccounts[txn.accountId] = (projectedAccounts[txn.accountId] || 0) - txn.amount;
          balance = projectedAccounts[txn.accountId];
        }

        // Check for negative balance
        if (balance < 0) {
          warnings.set(txn.id, {
            transactionId: txn.id,
            transactionType: 'expense',
            accountId: txn.accountId,
            accountName: accountNames[txn.accountId] || txn.accountId,
            projectedBalance: balance,
            shortfall: Math.abs(balance),
            date: txn.date
          });
        }
      } else if (txn.type === 'transfer' && txn.fromAccountId && txn.toAccountId) {
        // Transfer: deduct from source, add to destination
        let sourceBalance: number;

        if (txn.fromAccountId === 'cash') {
          projectedCash -= txn.amount;
          sourceBalance = projectedCash;
        } else {
          projectedAccounts[txn.fromAccountId] = (projectedAccounts[txn.fromAccountId] || 0) - txn.amount;
          sourceBalance = projectedAccounts[txn.fromAccountId];
        }

        if (txn.toAccountId === 'cash') {
          projectedCash += txn.amount;
        } else {
          projectedAccounts[txn.toAccountId] = (projectedAccounts[txn.toAccountId] || 0) + txn.amount;
        }

        // Check for negative balance on source account
        if (sourceBalance < 0) {
          warnings.set(txn.id, {
            transactionId: txn.id,
            transactionType: 'transfer',
            accountId: txn.fromAccountId,
            accountName: accountNames[txn.fromAccountId] || txn.fromAccountId,
            projectedBalance: sourceBalance,
            shortfall: Math.abs(sourceBalance),
            date: txn.date
          });
        }
      }
    }

    return warnings;
  }
};
