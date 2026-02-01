
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

export const calculations = {
  /**
   * Calculate running balance from starting balance, income, expenses, and transfers
   * Supports multiple bank accounts
   */
  calculateRunningBalance: (
    startingBalance: StartingBalance | undefined,
    income: Income[],
    expenses: Expense[],
    transfers: Transfer[] = [],
    bankAccounts: BankAccount[] = []
  ): RunningBalance => {
    // Initialize cash and accounts balances
    let cash = startingBalance?.cash ?? 0;
    const accounts: Record<string, number> = {};
    const asOfDate = startingBalance?.asOfDate ?? '1970-01-01';

    // Initialize each bank account balance from starting balance
    bankAccounts.forEach(account => {
      accounts[account.id] = startingBalance?.accounts?.[account.id] ??
        (account.id === 'bank_default' ? startingBalance?.bank ?? 0 : 0);
    });

    // Handle legacy 'bank' field for migration
    if (startingBalance?.bank !== undefined && !accounts['bank_default'] && bankAccounts.some(a => a.id === 'bank_default')) {
      accounts['bank_default'] = startingBalance.bank;
    }

    // Ensure bank_default exists if any accounts reference it
    if (!accounts['bank_default'] && bankAccounts.length === 0) {
      accounts['bank_default'] = startingBalance?.bank ?? 0;
    }

    // Add all income after starting date
    income
      .filter(i => i.date >= asOfDate)
      .forEach(i => {
        const accountId = resolveAccountId(i.paymentMethod);
        if (accountId === 'cash') {
          cash += i.amount;
        } else if (accounts[accountId] !== undefined) {
          accounts[accountId] += i.amount;
        } else {
          // Account doesn't exist, use default
          accounts['bank_default'] = (accounts['bank_default'] || 0) + i.amount;
        }
      });

    // Subtract all expenses after starting date
    expenses
      .filter(e => e.date >= asOfDate)
      .forEach(e => {
        const accountId = resolveAccountId(e.paymentMethod);
        if (accountId === 'cash') {
          cash -= e.amount;
        } else if (accounts[accountId] !== undefined) {
          accounts[accountId] -= e.amount;
        } else {
          // Account doesn't exist, use default
          accounts['bank_default'] = (accounts['bank_default'] || 0) - e.amount;
        }
      });

    // Apply transfers after starting date (moves money between accounts)
    transfers
      .filter(t => t.date >= asOfDate)
      .forEach(t => {
        // Use new fromAccountId/toAccountId fields, fall back to legacy direction
        let fromId: string;
        let toId: string;

        if (t.fromAccountId && t.toAccountId) {
          fromId = t.fromAccountId;
          toId = t.toAccountId;
        } else if (t.direction) {
          // Legacy direction field
          fromId = t.direction === 'BANK_TO_CASH' ? 'bank_default' : 'cash';
          toId = t.direction === 'BANK_TO_CASH' ? 'cash' : 'bank_default';
        } else {
          return; // Invalid transfer
        }

        // Deduct from source
        if (fromId === 'cash') {
          cash -= t.amount;
        } else if (accounts[fromId] !== undefined) {
          accounts[fromId] -= t.amount;
        } else {
          accounts['bank_default'] = (accounts['bank_default'] || 0) - t.amount;
        }

        // Add to destination
        if (toId === 'cash') {
          cash += t.amount;
        } else if (accounts[toId] !== undefined) {
          accounts[toId] += t.amount;
        } else {
          accounts['bank_default'] = (accounts['bank_default'] || 0) + t.amount;
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
  }
};
