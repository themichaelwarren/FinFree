
import { Expense, AppConfig } from "../types";
import { DEFAULT_CONFIG } from "../constants";

const STORAGE_KEYS = {
  EXPENSES: 'finfree_expenses',
  CONFIG: 'finfree_config',
};

export interface CloudData {
  config: AppConfig | null;
  expenses: Expense[];
}

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
        expenses: result.data.expenses || []
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

      await fetch(sheetsUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'config', config: configToSync, secret })
      });

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
      await fetch(sheetsUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses: unsynced, secret })
      });

      return unsynced.map(e => e.id);
    } catch (error) {
      console.error('Expense sync failed:', error);
      return [];
    }
  },

  // Merge cloud data with local (cloud wins for conflicts)
  mergeWithCloud: (cloudData: CloudData): { config: AppConfig; expenses: Expense[] } => {
    const localConfig = storage.getConfig();
    const localExpenses = storage.getExpenses();

    // Merge config: cloud budgets/balances win, keep local API keys
    const mergedConfig: AppConfig = {
      geminiKey: localConfig.geminiKey,
      sheetsUrl: localConfig.sheetsUrl,
      theme: cloudData.config?.theme || localConfig.theme,
      budgets: cloudData.config?.budgets || localConfig.budgets,
      balances: cloudData.config?.balances || localConfig.balances
    };

    // Merge expenses: combine both, dedupe by ID, prefer local unsynced
    const expenseMap = new Map<string, Expense>();

    // Add cloud expenses first
    cloudData.expenses.forEach(e => {
      expenseMap.set(e.id, { ...e, synced: true });
    });

    // Add local expenses (overwrite if unsynced to preserve local changes)
    localExpenses.forEach(e => {
      if (!e.synced || !expenseMap.has(e.id)) {
        expenseMap.set(e.id, e);
      }
    });

    const mergedExpenses = Array.from(expenseMap.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { config: mergedConfig, expenses: mergedExpenses };
  },

  // Legacy method for backwards compatibility
  syncToSheets: async (expenses: Expense[], sheetsUrl: string, secret: string): Promise<string[]> => {
    return storage.syncExpensesToCloud(expenses, sheetsUrl, secret);
  }
};
