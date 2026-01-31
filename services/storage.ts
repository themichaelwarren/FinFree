
import { Expense, AppConfig } from "../types";
import { DEFAULT_CONFIG } from "../constants";

const STORAGE_KEYS = {
  EXPENSES: 'finfree_expenses',
  CONFIG: 'finfree_config',
};

export const storage = {
  getExpenses: (): Expense[] => {
    const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    return data ? JSON.parse(data) : [];
  },

  saveExpense: (expense: Expense) => {
    const expenses = storage.getExpenses();
    const updated = [expense, ...expenses];
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(updated));
    return updated;
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
    return data ? JSON.parse(data) : DEFAULT_CONFIG;
  },

  saveConfig: (config: AppConfig) => {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  },

  syncToSheets: async (expenses: Expense[], sheetsUrl: string): Promise<string[]> => {
    if (!sheetsUrl) return [];

    const unsynced = expenses.filter(e => !e.synced);
    if (unsynced.length === 0) return [];

    try {
      // Send as a batch
      const response = await fetch(sheetsUrl, {
        method: 'POST',
        mode: 'no-cors', // Apps Script usually requires no-cors for simple deployments
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unsynced)
      });

      // Since mode is no-cors, we won't see the response content, 
      // but if the fetch doesn't throw, we assume success for the batch.
      return unsynced.map(e => e.id);
    } catch (error) {
      console.error('Sync failed:', error);
      return [];
    }
  }
};
