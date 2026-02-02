
import { Expense, AppConfig, MonthlyBudget, Income, Transfer, BankAccount, AccountBalances, StartingBalance, CategoryDefinition } from "../types";
import { DEFAULT_CONFIG, DEFAULT_CATEGORIES } from "../constants";

const STORAGE_KEYS = {
  EXPENSES: 'finfree_expenses',
  CONFIG: 'finfree_config',
  INCOME: 'finfree_income',
  TRANSFERS: 'finfree_transfers',
  ACCOUNTS: 'finfree_accounts',
  MIGRATION: 'finfree_migration',
};

// Default bank account for new/migrated users
const DEFAULT_BANK_ACCOUNT: BankAccount = {
  id: 'bank_default',
  name: 'Bank',
  isDefault: true,
  createdAt: new Date().toISOString()
};

export interface CloudData {
  config: AppConfig | null;
  expenses: Expense[];
  budgets: Record<string, MonthlyBudget> | null;
  income: Income[];
  transfers: Transfer[];
  accounts?: BankAccount[];
}

// Helper: Resolve legacy payment methods to account IDs
export const resolveAccountId = (paymentMethod: string): string => {
  if (paymentMethod === 'Cash') return 'cash';
  if (paymentMethod === 'Bank' || paymentMethod === 'Card') return 'bank_default';
  if (paymentMethod.startsWith('Card:')) return paymentMethod.split(':')[1];
  return paymentMethod;
};

// Helper: Check if payment method is a card payment
export const isCardPayment = (paymentMethod: string): boolean => {
  return paymentMethod === 'Card' || paymentMethod.startsWith('Card:');
};

// Helper: Get display name for payment method
export const getPaymentMethodDisplay = (paymentMethod: string, accounts: BankAccount[]): string => {
  if (paymentMethod === 'Cash') return 'Cash';
  if (paymentMethod === 'Card' || paymentMethod === 'Bank') return 'Bank';

  if (paymentMethod.startsWith('Card:')) {
    const accountId = paymentMethod.split(':')[1];
    const account = accounts.find(a => a.id === accountId);
    return `Card (${account?.name || 'Unknown'})`;
  }

  const account = accounts.find(a => a.id === paymentMethod);
  return account?.name || paymentMethod;
};

export const storage = {
  // Local storage operations
  getExpenses: (): Expense[] => {
    const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    if (!data) return [];
    return JSON.parse(data).map((e: Expense) => ({
      ...e,
      paymentMethod: e.paymentMethod || 'Cash'
    }));
  },

  saveExpense: (expense: Expense) => {
    const expenses = storage.getExpenses();
    const updated = [expense, ...expenses];
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(updated));
    return updated;
  },

  setExpenses: (expenses: Expense[]) => {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
  },

  updateExpense: (id: string, updates: Partial<Expense>) => {
    const expenses = storage.getExpenses();
    const updated = expenses.map(e => e.id === id ? { ...e, ...updates } : e);
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(updated));
    return updated;
  },

  deleteExpense: (id: string) => {
    const expenses = storage.getExpenses();
    const updated = expenses.filter(e => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(updated));
    return updated;
  },

  // Income operations
  getIncome: (): Income[] => {
    const data = localStorage.getItem(STORAGE_KEYS.INCOME);
    if (!data) return [];
    return JSON.parse(data);
  },

  saveIncome: (income: Income) => {
    const incomes = storage.getIncome();
    const updated = [income, ...incomes];
    localStorage.setItem(STORAGE_KEYS.INCOME, JSON.stringify(updated));
    return updated;
  },

  setIncome: (income: Income[]) => {
    localStorage.setItem(STORAGE_KEYS.INCOME, JSON.stringify(income));
  },

  updateIncome: (id: string, updates: Partial<Income>) => {
    const incomes = storage.getIncome();
    const updated = incomes.map(i => i.id === id ? { ...i, ...updates } : i);
    localStorage.setItem(STORAGE_KEYS.INCOME, JSON.stringify(updated));
    return updated;
  },

  deleteIncome: (id: string) => {
    const incomes = storage.getIncome();
    const updated = incomes.filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEYS.INCOME, JSON.stringify(updated));
    return updated;
  },

  // Transfer operations
  getTransfers: (): Transfer[] => {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSFERS);
    if (!data) return [];
    return JSON.parse(data);
  },

  saveTransfer: (transfer: Transfer) => {
    const transfers = storage.getTransfers();
    const updated = [transfer, ...transfers];
    localStorage.setItem(STORAGE_KEYS.TRANSFERS, JSON.stringify(updated));
    return updated;
  },

  setTransfers: (transfers: Transfer[]) => {
    localStorage.setItem(STORAGE_KEYS.TRANSFERS, JSON.stringify(transfers));
  },

  updateTransfer: (id: string, updates: Partial<Transfer>) => {
    const transfers = storage.getTransfers();
    const updated = transfers.map(t => t.id === id ? { ...t, ...updates } : t);
    localStorage.setItem(STORAGE_KEYS.TRANSFERS, JSON.stringify(updated));
    return updated;
  },

  deleteTransfer: (id: string) => {
    const transfers = storage.getTransfers();
    const updated = transfers.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.TRANSFERS, JSON.stringify(updated));
    return updated;
  },

  // Bank Account operations
  getAccounts: (): BankAccount[] => {
    const data = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (!data) {
      // Return default account for unmigrated state
      return [DEFAULT_BANK_ACCOUNT];
    }
    return JSON.parse(data);
  },

  setAccounts: (accounts: BankAccount[]) => {
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  },

  saveAccount: (account: BankAccount): BankAccount[] => {
    const accounts = storage.getAccounts();
    const existingIndex = accounts.findIndex(a => a.id === account.id);

    if (existingIndex >= 0) {
      // Update existing
      accounts[existingIndex] = account;
    } else {
      // Add new
      accounts.push(account);
    }

    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
    return accounts;
  },

  updateAccount: (id: string, updates: Partial<BankAccount>): BankAccount[] => {
    const accounts = storage.getAccounts();
    const updated = accounts.map(a => a.id === id ? { ...a, ...updates } : a);
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
    return updated;
  },

  deleteAccount: (id: string): { success: boolean; error?: string; accounts: BankAccount[] } => {
    if (id === 'cash') {
      return { success: false, error: 'Cannot delete Cash account', accounts: storage.getAccounts() };
    }

    const accounts = storage.getAccounts();
    if (accounts.length === 1) {
      return { success: false, error: 'Must have at least one bank account', accounts };
    }

    // Check if account has transactions
    const expenses = storage.getExpenses();
    const income = storage.getIncome();
    const transfers = storage.getTransfers();

    const hasExpenses = expenses.some(e => resolveAccountId(e.paymentMethod) === id);
    const hasIncome = income.some(i => resolveAccountId(i.paymentMethod) === id);
    const hasTransfers = transfers.some(t => t.fromAccountId === id || t.toAccountId === id);

    if (hasExpenses || hasIncome || hasTransfers) {
      return {
        success: false,
        error: 'Cannot delete account with existing transactions',
        accounts
      };
    }

    const updated = accounts.filter(a => a.id !== id);

    // If deleting default, assign new default
    if (!updated.some(a => a.isDefault) && updated.length > 0) {
      updated[0].isDefault = true;
    }

    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
    return { success: true, accounts: updated };
  },

  setDefaultAccount: (id: string): BankAccount[] => {
    const accounts = storage.getAccounts();
    const updated = accounts.map(a => ({
      ...a,
      isDefault: a.id === id
    }));
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(updated));
    return updated;
  },

  getDefaultAccount: (): BankAccount | undefined => {
    const accounts = storage.getAccounts();
    return accounts.find(a => a.isDefault) || accounts[0];
  },

  // Migration: Convert legacy 2-account model to multi-account
  migrateToMultiAccount: (): void => {
    const migrationData = localStorage.getItem(STORAGE_KEYS.MIGRATION);
    const migration = migrationData ? JSON.parse(migrationData) : { version: 0 };

    if (migration.version >= 2) return; // Already migrated

    // 1. Ensure default bank account exists
    const existingAccounts = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (!existingAccounts) {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify([DEFAULT_BANK_ACCOUNT]));
    }

    // 2. Migrate config balances
    const configData = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (configData) {
      const config = JSON.parse(configData);
      if (config.balances && config.balances.bank !== undefined && !config.balances.accounts) {
        config.balances.accounts = {
          'bank_default': config.balances.bank
        };

        if (config.balances.startingBalance && config.balances.startingBalance.bank !== undefined) {
          config.balances.startingBalance.accounts = {
            'bank_default': config.balances.startingBalance.bank
          };
        }

        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
      }
    }

    // 3. Migrate transfers with fromAccountId/toAccountId
    const transfersData = localStorage.getItem(STORAGE_KEYS.TRANSFERS);
    if (transfersData) {
      const transfers: Transfer[] = JSON.parse(transfersData);
      const migratedTransfers = transfers.map(t => {
        if (t.fromAccountId && t.toAccountId) return t; // Already migrated

        // Derive from legacy direction field
        const direction = (t as { direction?: string }).direction;
        return {
          ...t,
          fromAccountId: direction === 'BANK_TO_CASH' ? 'bank_default' : 'cash',
          toAccountId: direction === 'BANK_TO_CASH' ? 'cash' : 'bank_default'
        };
      });
      localStorage.setItem(STORAGE_KEYS.TRANSFERS, JSON.stringify(migratedTransfers));
    }

    // 4. Mark version 2 complete
    migration.version = 2;
    localStorage.setItem(STORAGE_KEYS.MIGRATION, JSON.stringify({
      ...migration,
      migratedAt: new Date().toISOString()
    }));
  },

  // Migration: Always ensure all DEFAULT_CATEGORIES exist in user's config
  // This runs every time to catch any newly added categories
  migrateCategories: (): void => {
    const configData = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!configData) return; // No config yet, will use defaults

    const config = JSON.parse(configData);
    const existingCategories: CategoryDefinition[] = config.categories || [];
    const existingIds = new Set(existingCategories.map((c: CategoryDefinition) => c.id));

    // Add any categories from DEFAULT_CATEGORIES that don't exist yet
    const newCategories = DEFAULT_CATEGORIES.filter(c => !existingIds.has(c.id));

    if (newCategories.length > 0) {
      console.log(`Adding ${newCategories.length} new categories:`, newCategories.map(c => c.name));
      config.categories = [...existingCategories, ...newCategories];

      // Also add budget entries for new categories in all existing budgets
      if (config.budgets) {
        for (const monthKey of Object.keys(config.budgets)) {
          const budget = config.budgets[monthKey];
          if (budget.categories) {
            for (const cat of newCategories) {
              if (!budget.categories[cat.id]) {
                budget.categories[cat.id] = { amount: 0, type: cat.defaultType };
              }
            }
          }
        }
      }

      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    }
  },

  getConfig: (): AppConfig => {
    const data = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!data) return DEFAULT_CONFIG;
    const stored = JSON.parse(data);
    return {
      ...DEFAULT_CONFIG,
      ...stored,
      balances: { ...DEFAULT_CONFIG.balances, ...stored.balances }
    };
  },

  saveConfig: (config: AppConfig) => {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  },

  // Cloud sync operations
  fetchFromCloud: async (sheetsUrl: string, secret: string): Promise<CloudData | null> => {
    if (!sheetsUrl || !secret) return null;

    try {
      const response = await fetch(`${sheetsUrl}?type=all&secret=${encodeURIComponent(secret)}`);
      if (!response.ok) throw new Error('Cloud fetch failed');

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Unknown error');

      return {
        config: result.data.config || null,
        expenses: result.data.expenses || [],
        budgets: result.data.budgets || null,
        income: result.data.income || [],
        transfers: result.data.transfers || [],
        accounts: result.data.accounts || undefined
      };
    } catch (error) {
      console.error('Cloud fetch failed:', error);
      return null;
    }
  },

  syncConfigToCloud: async (config: AppConfig, sheetsUrl: string, secret: string): Promise<boolean> => {
    if (!sheetsUrl || !secret) return false;

    try {
      // Don't sync sensitive data to the cloud
      const configToSync = {
        ...config,
        geminiKey: '',      // Don't store API key in sheets
        sheetsUrl: '',      // Don't store sheets URL in sheets
        sheetsSecret: ''    // Don't store secret in sheets
      };

      const response = await fetch(sheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ type: 'config', config: configToSync, secret })
      });

      try {
        const result = await response.json();
        if (!result.success) {
          console.error('Config sync failed:', result.error);
          return false;
        }
      } catch {
        // Response might be opaque
      }

      return true;
    } catch (error) {
      console.error('Config sync failed:', error);
      return false;
    }
  },

  syncExpensesToCloud: async (expenses: Expense[], sheetsUrl: string, secret: string): Promise<string[]> => {
    if (!sheetsUrl || !secret) return [];

    const unsynced = expenses.filter(e => !e.synced);
    if (unsynced.length === 0) return [];

    try {
      const response = await fetch(sheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ expenses: unsynced, secret })
      });

      // Try to get actual response for debugging
      try {
        const result = await response.json();
        if (!result.success) {
          console.error('Sync failed:', result.error);
          return [];
        }
      } catch {
        // Response might be opaque, assume success
      }

      return unsynced.map(e => e.id);
    } catch (error) {
      console.error('Expense sync failed:', error);
      return [];
    }
  },

  syncBudgetsToCloud: async (budgets: Record<string, MonthlyBudget>, sheetsUrl: string, secret: string): Promise<boolean> => {
    if (!sheetsUrl || !secret) return false;

    try {
      const response = await fetch(sheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ type: 'budgets', budgets, secret })
      });

      try {
        const result = await response.json();
        if (!result.success) {
          console.error('Budgets sync failed:', result.error);
          return false;
        }
      } catch {
        // Response might be opaque
      }

      return true;
    } catch (error) {
      console.error('Budgets sync failed:', error);
      return false;
    }
  },

  // Merge cloud data with local (cloud wins for conflicts)
  // Note: Cloud data already has deleted items filtered out (Deleted column = 'true')
  mergeWithCloud: (cloudData: CloudData): { config: AppConfig; expenses: Expense[]; income: Income[]; transfers: Transfer[]; accounts: BankAccount[] } => {
    const localConfig = storage.getConfig();
    const localExpenses = storage.getExpenses();
    const localIncome = storage.getIncome();
    const localTransfers = storage.getTransfers();
    const localAccounts = storage.getAccounts();

    // Merge config: cloud budgets/balances win, keep local API keys and OAuth settings
    // Prefer budgets from dedicated Budgets sheet if available, fall back to config.budgets
    // For categories: cloud (if non-empty) > local (if non-empty) > DEFAULT_CATEGORIES
    const cloudCategories = cloudData.config?.categories;
    const hasCloudCategories = cloudCategories && cloudCategories.length > 0;
    const hasLocalCategories = localConfig.categories && localConfig.categories.length > 0;
    const mergedCategories = hasCloudCategories ? cloudCategories : (hasLocalCategories ? localConfig.categories : DEFAULT_CATEGORIES);
    const mergedConfig: AppConfig = {
      geminiKey: localConfig.geminiKey,
      sheetsUrl: localConfig.sheetsUrl,
      sheetsSecret: localConfig.sheetsSecret,
      spreadsheetId: localConfig.spreadsheetId,  // Preserve OAuth spreadsheet ID
      categories: mergedCategories,
      theme: cloudData.config?.theme || localConfig.theme,
      budgets: cloudData.budgets || cloudData.config?.budgets || localConfig.budgets,
      balances: cloudData.config?.balances || localConfig.balances
    };

    // Build set of cloud IDs (items not deleted in cloud)
    const cloudExpenseIds = new Set(cloudData.expenses.map(e => e.id));
    const cloudIncomeIds = new Set(cloudData.income.map(i => i.id));
    const cloudTransferIds = new Set(cloudData.transfers.map(t => t.id));

    // Merge expenses: combine both, dedupe by ID, prefer local unsynced
    const expenseMap = new Map<string, Expense>();

    // Add cloud expenses first
    cloudData.expenses.forEach(e => {
      expenseMap.set(e.id, { ...e, synced: true });
    });

    // Add local expenses (overwrite if unsynced to preserve local changes)
    // Skip local items that were deleted in cloud (not in cloudExpenseIds but synced)
    localExpenses.forEach(e => {
      if (!e.synced || !expenseMap.has(e.id)) {
        // If item is synced but not in cloud, it was deleted in cloud - don't add it back
        if (e.synced && !cloudExpenseIds.has(e.id)) {
          return;
        }
        expenseMap.set(e.id, e);
      }
    });

    const mergedExpenses = Array.from(expenseMap.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Merge income: same pattern as expenses
    const incomeMap = new Map<string, Income>();

    // Add cloud income first
    cloudData.income.forEach(i => {
      incomeMap.set(i.id, { ...i, synced: true });
    });

    // Add local income (overwrite if unsynced to preserve local changes)
    localIncome.forEach(i => {
      if (!i.synced || !incomeMap.has(i.id)) {
        if (i.synced && !cloudIncomeIds.has(i.id)) {
          return;
        }
        incomeMap.set(i.id, i);
      }
    });

    const mergedIncome = Array.from(incomeMap.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Merge transfers: same pattern as expenses and income
    const transferMap = new Map<string, Transfer>();

    // Add cloud transfers first
    cloudData.transfers.forEach(t => {
      transferMap.set(t.id, { ...t, synced: true });
    });

    // Add local transfers (overwrite if unsynced to preserve local changes)
    localTransfers.forEach(t => {
      if (!t.synced || !transferMap.has(t.id)) {
        if (t.synced && !cloudTransferIds.has(t.id)) {
          return;
        }
        transferMap.set(t.id, t);
      }
    });

    const mergedTransfers = Array.from(transferMap.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Merge accounts: cloud wins, but preserve local accounts not in cloud
    const accountMap = new Map<string, BankAccount>();

    // Add cloud accounts first
    if (cloudData.accounts) {
      cloudData.accounts.forEach(a => {
        accountMap.set(a.id, a);
      });
    }

    // Add local accounts that aren't in cloud
    localAccounts.forEach(a => {
      if (!accountMap.has(a.id)) {
        accountMap.set(a.id, a);
      }
    });

    // Ensure at least one account exists and one is default
    let mergedAccounts = Array.from(accountMap.values());
    if (mergedAccounts.length === 0) {
      mergedAccounts = [{ ...DEFAULT_BANK_ACCOUNT }];
    }
    if (!mergedAccounts.some(a => a.isDefault)) {
      mergedAccounts[0].isDefault = true;
    }

    return { config: mergedConfig, expenses: mergedExpenses, income: mergedIncome, transfers: mergedTransfers, accounts: mergedAccounts };
  },

  syncIncomeToCloud: async (income: Income[], sheetsUrl: string, secret: string): Promise<string[]> => {
    if (!sheetsUrl || !secret) return [];

    const unsynced = income.filter(i => !i.synced);
    if (unsynced.length === 0) return [];

    try {
      const response = await fetch(sheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ type: 'income', income: unsynced, secret })
      });

      // Try to get actual response for debugging
      try {
        const result = await response.json();
        if (!result.success) {
          console.error('Income sync failed:', result.error);
          return [];
        }
      } catch {
        // Response might be opaque, assume success
      }

      return unsynced.map(i => i.id);
    } catch (error) {
      console.error('Income sync failed:', error);
      return [];
    }
  },

  syncTransfersToCloud: async (transfers: Transfer[], sheetsUrl: string, secret: string): Promise<string[]> => {
    if (!sheetsUrl || !secret) return [];

    const unsynced = transfers.filter(t => !t.synced);
    if (unsynced.length === 0) return [];

    try {
      const response = await fetch(sheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ type: 'transfers', transfers: unsynced, secret })
      });

      // Try to get actual response for debugging
      try {
        const result = await response.json();
        if (!result.success) {
          console.error('Transfer sync failed:', result.error);
          return [];
        }
      } catch {
        // Response might be opaque, assume success
      }

      return unsynced.map(t => t.id);
    } catch (error) {
      console.error('Transfer sync failed:', error);
      return [];
    }
  },

  // Legacy method for backwards compatibility
  syncToSheets: async (expenses: Expense[], sheetsUrl: string, secret: string): Promise<string[]> => {
    return storage.syncExpensesToCloud(expenses, sheetsUrl, secret);
  }
};
