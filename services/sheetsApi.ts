import { Expense, AppConfig, MonthlyBudget, AccountBalances } from '../types';
import { CATEGORIES, CATEGORY_TYPES } from '../constants';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

interface SheetRange {
  values: (string | number | boolean)[][];
}

export const sheetsApi = {
  // Create a new spreadsheet with the required sheets
  createSpreadsheet: async (accessToken: string, name: string = 'FinFree Data'): Promise<string> => {
    const response = await fetch(SHEETS_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: { title: name },
        sheets: [
          {
            properties: { title: 'Expenses', index: 0 },
            data: [{
              startRow: 0,
              startColumn: 0,
              rowData: [{
                values: ['ID', 'Date', 'Timestamp', 'Amount', 'Category', 'Type', 'Payment Method', 'Store', 'Notes', 'Source'].map(v => ({
                  userEnteredValue: { stringValue: v },
                  userEnteredFormat: { textFormat: { bold: true } }
                }))
              }]
            }]
          },
          {
            properties: { title: 'Budgets', index: 1 },
            data: [{
              startRow: 0,
              startColumn: 0,
              rowData: [{
                values: ['Month', 'Category', 'Type', 'Amount', 'Salary'].map(v => ({
                  userEnteredValue: { stringValue: v },
                  userEnteredFormat: { textFormat: { bold: true } }
                }))
              }]
            }]
          },
          {
            properties: { title: 'Config', index: 2 },
            data: [{
              startRow: 0,
              startColumn: 0,
              rowData: [
                { values: [{ userEnteredValue: { stringValue: 'Key' } }, { userEnteredValue: { stringValue: 'Value' } }] },
                { values: [{ userEnteredValue: { stringValue: 'theme' } }, { userEnteredValue: { stringValue: 'dark' } }] },
                { values: [{ userEnteredValue: { stringValue: 'balances' } }, { userEnteredValue: { stringValue: '{}' } }] }
              ]
            }]
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to create spreadsheet');
    }

    const data = await response.json();
    return data.spreadsheetId;
  },

  // Get spreadsheet metadata
  getSpreadsheet: async (accessToken: string, spreadsheetId: string): Promise<{ title: string; sheets: string[] }> => {
    const response = await fetch(`${SHEETS_API}/${spreadsheetId}?fields=properties.title,sheets.properties.title`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch spreadsheet');
    }

    const data = await response.json();
    return {
      title: data.properties.title,
      sheets: data.sheets.map((s: { properties: { title: string } }) => s.properties.title)
    };
  },

  // Get values from a range
  getValues: async (accessToken: string, spreadsheetId: string, range: string): Promise<(string | number)[][]> => {
    const response = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error('Failed to fetch values');
    }

    const data: SheetRange = await response.json();
    return data.values || [];
  },

  // Update values in a range
  updateValues: async (
    accessToken: string,
    spreadsheetId: string,
    range: string,
    values: (string | number | boolean)[][]
  ): Promise<void> => {
    const response = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      }
    );

    if (!response.ok) {
      throw new Error('Failed to update values');
    }
  },

  // Append values to a sheet
  appendValues: async (
    accessToken: string,
    spreadsheetId: string,
    range: string,
    values: (string | number | boolean)[][]
  ): Promise<void> => {
    const response = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      }
    );

    if (!response.ok) {
      throw new Error('Failed to append values');
    }
  },

  // Clear values in a range
  clearValues: async (accessToken: string, spreadsheetId: string, range: string): Promise<void> => {
    const response = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    // 404 is ok - means range was already empty
    if (!response.ok && response.status !== 404) {
      throw new Error('Failed to clear values');
    }
  },

  // Get all expenses
  getExpenses: async (accessToken: string, spreadsheetId: string): Promise<Expense[]> => {
    const values = await sheetsApi.getValues(accessToken, spreadsheetId, 'Expenses!A2:J');

    return values.map(row => ({
      id: String(row[0]),
      date: String(row[1]),
      timestamp: String(row[2]),
      amount: Number(row[3]),
      category: String(row[4]) as Expense['category'],
      type: String(row[5]) as Expense['type'],
      paymentMethod: (String(row[6]) || 'Cash') as Expense['paymentMethod'],
      store: String(row[7]),
      notes: String(row[8] || ''),
      source: (String(row[9]) || 'manual') as Expense['source'],
      synced: true
    }));
  },

  // Add or update expenses
  addExpenses: async (accessToken: string, spreadsheetId: string, expenses: Expense[]): Promise<void> => {
    if (expenses.length === 0) return;

    // Get existing expenses to determine which need adding vs updating
    const existing = await sheetsApi.getExpenses(accessToken, spreadsheetId);
    const existingIds = new Set(existing.map(e => e.id));

    const newExpenses = expenses.filter(e => !existingIds.has(e.id));
    const updatedExpenses = expenses.filter(e => existingIds.has(e.id));

    // Append new expenses
    if (newExpenses.length > 0) {
      const rows = newExpenses.map(e => [
        e.id,
        e.date,
        e.timestamp,
        e.amount,
        e.category,
        e.type,
        e.paymentMethod || 'Cash',
        e.store,
        e.notes || '',
        e.source || 'manual'
      ]);
      await sheetsApi.appendValues(accessToken, spreadsheetId, 'Expenses!A:J', rows);
    }

    // Update existing expenses
    if (updatedExpenses.length > 0) {
      await sheetsApi.updateExpenses(accessToken, spreadsheetId, updatedExpenses);
    }
  },

  // Update existing expenses by finding their rows and updating in place
  updateExpenses: async (accessToken: string, spreadsheetId: string, expenses: Expense[]): Promise<void> => {
    if (expenses.length === 0) return;

    // Get all current data to find row numbers
    const values = await sheetsApi.getValues(accessToken, spreadsheetId, 'Expenses!A:J');

    // Build a map of ID -> row index (1-based, accounting for header)
    const idToRow = new Map<string, number>();
    values.forEach((row, index) => {
      if (index === 0) return; // Skip header
      const id = String(row[0]);
      idToRow.set(id, index + 1); // +1 because Sheets rows are 1-indexed
    });

    // Update each expense in its row
    for (const expense of expenses) {
      const rowNum = idToRow.get(expense.id);
      if (rowNum) {
        const row = [
          expense.id,
          expense.date,
          expense.timestamp,
          expense.amount,
          expense.category,
          expense.type,
          expense.paymentMethod || 'Cash',
          expense.store,
          expense.notes || '',
          expense.source || 'manual'
        ];
        await sheetsApi.updateValues(accessToken, spreadsheetId, `Expenses!A${rowNum}:J${rowNum}`, [row]);
      }
    }
  },

  // Get budgets
  getBudgets: async (accessToken: string, spreadsheetId: string): Promise<Record<string, MonthlyBudget>> => {
    const values = await sheetsApi.getValues(accessToken, spreadsheetId, 'Budgets!A2:E');

    const budgets: Record<string, MonthlyBudget> = {};

    values.forEach(row => {
      const month = String(row[0]);
      const category = String(row[1]) as keyof typeof CATEGORY_TYPES;
      const type = String(row[2]) as MonthlyBudget['categories'][typeof category]['type'];
      const amount = Number(row[3]);
      const salary = Number(row[4]);

      if (!budgets[month]) {
        budgets[month] = {
          salary,
          categories: {} as MonthlyBudget['categories']
        };
      }

      budgets[month].categories[category] = { amount, type };
    });

    return budgets;
  },

  // Save budgets (replace all for given months)
  saveBudgets: async (
    accessToken: string,
    spreadsheetId: string,
    budgets: Record<string, MonthlyBudget>
  ): Promise<void> => {
    // Get existing budgets to preserve other months
    const existing = await sheetsApi.getBudgets(accessToken, spreadsheetId);
    const merged = { ...existing, ...budgets };

    // Build all rows
    const rows: (string | number)[][] = [];
    for (const month in merged) {
      const budget = merged[month];
      for (const category of CATEGORIES) {
        const cat = budget.categories[category];
        if (cat) {
          rows.push([month, category, cat.type, cat.amount, budget.salary]);
        }
      }
    }

    // Clear and rewrite (simpler than diffing)
    await sheetsApi.clearValues(accessToken, spreadsheetId, 'Budgets!A2:E');
    if (rows.length > 0) {
      await sheetsApi.updateValues(accessToken, spreadsheetId, 'Budgets!A2:E', rows);
    }
  },

  // Get config (theme, balances)
  getConfig: async (accessToken: string, spreadsheetId: string): Promise<Partial<AppConfig>> => {
    const values = await sheetsApi.getValues(accessToken, spreadsheetId, 'Config!A2:B');

    const config: Partial<AppConfig> = {};
    values.forEach(row => {
      const key = String(row[0]);
      const value = String(row[1]);

      if (key === 'theme') {
        config.theme = value as AppConfig['theme'];
      } else if (key === 'balances') {
        try {
          config.balances = JSON.parse(value);
        } catch {
          config.balances = { cash: 0, bank: 0, lastUpdated: '' };
        }
      }
    });

    return config;
  },

  // Save config
  saveConfig: async (
    accessToken: string,
    spreadsheetId: string,
    config: { theme?: AppConfig['theme']; balances?: AccountBalances }
  ): Promise<void> => {
    const rows: (string | number)[][] = [];

    if (config.theme) {
      rows.push(['theme', config.theme]);
    }
    if (config.balances) {
      rows.push(['balances', JSON.stringify(config.balances)]);
    }

    if (rows.length > 0) {
      await sheetsApi.updateValues(accessToken, spreadsheetId, 'Config!A2:B', rows);
    }
  },

  // Fetch all data at once
  fetchAll: async (accessToken: string, spreadsheetId: string): Promise<{
    expenses: Expense[];
    budgets: Record<string, MonthlyBudget>;
    config: Partial<AppConfig>;
  }> => {
    const [expenses, budgets, config] = await Promise.all([
      sheetsApi.getExpenses(accessToken, spreadsheetId),
      sheetsApi.getBudgets(accessToken, spreadsheetId),
      sheetsApi.getConfig(accessToken, spreadsheetId)
    ]);

    return { expenses, budgets, config };
  },

  // Extract spreadsheet ID from URL
  extractSpreadsheetId: (url: string): string | null => {
    // Handle formats:
    // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
    // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }
};
