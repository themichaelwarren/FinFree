import { Expense, AppConfig, MonthlyBudget, AccountBalances, CategoryDefinition, Income, Transfer } from '../types';
import { CATEGORIES, CATEGORY_TYPES } from '../constants';

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

interface SheetRange {
  values: (string | number)[][];
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
            properties: { title: 'Categories', index: 2 },
            data: [{
              startRow: 0,
              startColumn: 0,
              rowData: [{
                values: ['ID', 'Name', 'Type', 'Icon'].map(v => ({
                  userEnteredValue: { stringValue: v },
                  userEnteredFormat: { textFormat: { bold: true } }
                }))
              }]
            }]
          },
          {
            properties: { title: 'Config', index: 3 },
            data: [{
              startRow: 0,
              startColumn: 0,
              rowData: [
                { values: [{ userEnteredValue: { stringValue: 'Key' } }, { userEnteredValue: { stringValue: 'Value' } }] },
                { values: [{ userEnteredValue: { stringValue: 'theme' } }, { userEnteredValue: { stringValue: 'dark' } }] },
                { values: [{ userEnteredValue: { stringValue: 'balances' } }, { userEnteredValue: { stringValue: '{}' } }] }
              ]
            }]
          },
          {
            properties: { title: 'Income', index: 4 },
            data: [{
              startRow: 0,
              startColumn: 0,
              rowData: [{
                values: ['ID', 'Date', 'Timestamp', 'Amount', 'Category', 'Payment Method', 'Description', 'Notes'].map(v => ({
                  userEnteredValue: { stringValue: v },
                  userEnteredFormat: { textFormat: { bold: true } }
                }))
              }]
            }]
          },
          {
            properties: { title: 'Transfers', index: 5 },
            data: [{
              startRow: 0,
              startColumn: 0,
              rowData: [{
                values: ['ID', 'Date', 'Timestamp', 'Amount', 'Direction', 'Description', 'Notes'].map(v => ({
                  userEnteredValue: { stringValue: v },
                  userEnteredFormat: { textFormat: { bold: true } }
                }))
              }]
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

  // Get all income
  getIncome: async (accessToken: string, spreadsheetId: string): Promise<Income[]> => {
    try {
      const values = await sheetsApi.getValues(accessToken, spreadsheetId, 'Income!A2:H');

      return values.map(row => ({
        id: String(row[0]),
        date: String(row[1]),
        timestamp: String(row[2]),
        amount: Number(row[3]),
        category: String(row[4]) as Income['category'],
        paymentMethod: (String(row[5]) || 'Bank') as Income['paymentMethod'],
        description: String(row[6] || ''),
        notes: String(row[7] || ''),
        synced: true
      }));
    } catch {
      // Income sheet might not exist in older spreadsheets
      return [];
    }
  },

  // Add or update income
  addIncome: async (accessToken: string, spreadsheetId: string, income: Income[]): Promise<void> => {
    if (income.length === 0) return;

    // Ensure Income sheet exists (for older spreadsheets)
    await sheetsApi.ensureIncomeSheet(accessToken, spreadsheetId);

    // Get existing income to determine which need adding vs updating
    const existing = await sheetsApi.getIncome(accessToken, spreadsheetId);
    const existingIds = new Set(existing.map(i => i.id));

    const newIncome = income.filter(i => !existingIds.has(i.id));
    const updatedIncome = income.filter(i => existingIds.has(i.id));

    // Append new income
    if (newIncome.length > 0) {
      const rows = newIncome.map(i => [
        i.id,
        i.date,
        i.timestamp,
        i.amount,
        i.category,
        i.paymentMethod || 'Bank',
        i.description || '',
        i.notes || ''
      ]);
      await sheetsApi.appendValues(accessToken, spreadsheetId, 'Income!A:H', rows);
    }

    // Update existing income
    if (updatedIncome.length > 0) {
      await sheetsApi.updateIncome(accessToken, spreadsheetId, updatedIncome);
    }
  },

  // Update existing income by finding their rows and updating in place
  updateIncome: async (accessToken: string, spreadsheetId: string, income: Income[]): Promise<void> => {
    if (income.length === 0) return;

    // Get all current data to find row numbers
    const values = await sheetsApi.getValues(accessToken, spreadsheetId, 'Income!A:H');

    // Build a map of ID -> row index (1-based, accounting for header)
    const idToRow = new Map<string, number>();
    values.forEach((row, index) => {
      if (index === 0) return; // Skip header
      const id = String(row[0]);
      idToRow.set(id, index + 1); // +1 because Sheets rows are 1-indexed
    });

    // Update each income in its row
    for (const inc of income) {
      const rowNum = idToRow.get(inc.id);
      if (rowNum) {
        const row = [
          inc.id,
          inc.date,
          inc.timestamp,
          inc.amount,
          inc.category,
          inc.paymentMethod || 'Bank',
          inc.description || '',
          inc.notes || ''
        ];
        await sheetsApi.updateValues(accessToken, spreadsheetId, `Income!A${rowNum}:H${rowNum}`, [row]);
      }
    }
  },

  // Ensure Income sheet exists (migration helper for older spreadsheets)
  ensureIncomeSheet: async (accessToken: string, spreadsheetId: string): Promise<void> => {
    try {
      const spreadsheet = await sheetsApi.getSpreadsheet(accessToken, spreadsheetId);
      if (!spreadsheet.sheets.includes('Income')) {
        // Add Income sheet via batchUpdate
        const response = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [{
              addSheet: {
                properties: { title: 'Income' }
              }
            }]
          })
        });

        if (response.ok) {
          // Add header row
          await sheetsApi.updateValues(accessToken, spreadsheetId, 'Income!A1:H1', [
            ['ID', 'Date', 'Timestamp', 'Amount', 'Category', 'Payment Method', 'Description', 'Notes']
          ]);
        }
      }
    } catch {
      // Ignore errors - sheet might already exist
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

    // Build all rows - iterate over actual budget categories, not hardcoded constant
    const rows: (string | number)[][] = [];
    for (const month in merged) {
      const budget = merged[month];
      for (const category in budget.categories) {
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

  // Get categories from dedicated sheet
  getCategories: async (accessToken: string, spreadsheetId: string): Promise<CategoryDefinition[] | null> => {
    try {
      const values = await sheetsApi.getValues(accessToken, spreadsheetId, 'Categories!A2:D');
      if (!values || values.length === 0) return null;

      return values.map(row => ({
        id: String(row[0]),
        name: String(row[1]),
        defaultType: String(row[2]) as CategoryDefinition['defaultType'],
        icon: String(row[3]) as CategoryDefinition['icon']
      }));
    } catch {
      // Categories sheet might not exist in older spreadsheets
      return null;
    }
  },

  // Save categories to dedicated sheet
  saveCategories: async (
    accessToken: string,
    spreadsheetId: string,
    categories: CategoryDefinition[]
  ): Promise<void> => {
    const rows = categories.map(cat => [
      cat.id,
      cat.name,
      cat.defaultType,
      cat.icon
    ]);

    // Clear and rewrite
    await sheetsApi.clearValues(accessToken, spreadsheetId, 'Categories!A2:D');
    if (rows.length > 0) {
      await sheetsApi.updateValues(accessToken, spreadsheetId, 'Categories!A2:D', rows);
    }
  },

  // Get config (theme, balances) - categories are in dedicated sheet
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
      // Legacy: categories used to be stored here as JSON, now in dedicated sheet
      // We still read them for backwards compatibility during migration
      else if (key === 'categories') {
        try {
          config.categories = JSON.parse(value);
        } catch {
          // Ignore parse failures
        }
      }
    });

    return config;
  },

  // Save config (theme, balances) - categories saved via saveCategories
  saveConfig: async (
    accessToken: string,
    spreadsheetId: string,
    config: { theme?: AppConfig['theme']; balances?: AccountBalances }
  ): Promise<void> => {
    // Read existing config first to preserve values we're not updating
    const existing = await sheetsApi.getConfig(accessToken, spreadsheetId);

    // Merge with new values
    const merged = {
      theme: config.theme ?? existing.theme ?? 'dark',
      balances: config.balances ?? existing.balances ?? { cash: 0, bank: 0, lastUpdated: '' }
    };

    // Build rows for config values (no longer includes categories - use saveCategories)
    const rows: (string | number)[][] = [
      ['theme', merged.theme],
      ['balances', JSON.stringify(merged.balances)]
    ];

    await sheetsApi.updateValues(accessToken, spreadsheetId, 'Config!A2:B', rows);
  },

  // Get all transfers
  getTransfers: async (accessToken: string, spreadsheetId: string): Promise<Transfer[]> => {
    try {
      const values = await sheetsApi.getValues(accessToken, spreadsheetId, 'Transfers!A2:G');

      return values.map(row => ({
        id: String(row[0]),
        date: String(row[1]),
        timestamp: String(row[2]),
        amount: Number(row[3]),
        direction: String(row[4]) as Transfer['direction'],
        description: String(row[5] || ''),
        notes: String(row[6] || ''),
        synced: true
      }));
    } catch {
      // Transfers sheet might not exist in older spreadsheets
      return [];
    }
  },

  // Add or update transfers
  addTransfers: async (accessToken: string, spreadsheetId: string, transfers: Transfer[]): Promise<void> => {
    if (transfers.length === 0) return;

    // Ensure Transfers sheet exists (for older spreadsheets)
    await sheetsApi.ensureTransfersSheet(accessToken, spreadsheetId);

    // Get existing transfers to determine which need adding vs updating
    const existing = await sheetsApi.getTransfers(accessToken, spreadsheetId);
    const existingIds = new Set(existing.map(t => t.id));

    const newTransfers = transfers.filter(t => !existingIds.has(t.id));

    // Append new transfers
    if (newTransfers.length > 0) {
      const rows = newTransfers.map(t => [
        t.id,
        t.date,
        t.timestamp,
        t.amount,
        t.direction,
        t.description || '',
        t.notes || ''
      ]);
      await sheetsApi.appendValues(accessToken, spreadsheetId, 'Transfers!A:G', rows);
    }
  },

  // Ensure Transfers sheet exists (migration helper for older spreadsheets)
  ensureTransfersSheet: async (accessToken: string, spreadsheetId: string): Promise<void> => {
    try {
      const spreadsheet = await sheetsApi.getSpreadsheet(accessToken, spreadsheetId);
      if (!spreadsheet.sheets.includes('Transfers')) {
        // Add Transfers sheet via batchUpdate
        const response = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [{
              addSheet: {
                properties: { title: 'Transfers' }
              }
            }]
          })
        });

        if (response.ok) {
          // Add header row
          await sheetsApi.updateValues(accessToken, spreadsheetId, 'Transfers!A1:G1', [
            ['ID', 'Date', 'Timestamp', 'Amount', 'Direction', 'Description', 'Notes']
          ]);
        }
      }
    } catch {
      // Ignore errors - sheet might already exist
    }
  },

  // Fetch all data at once
  fetchAll: async (accessToken: string, spreadsheetId: string): Promise<{
    expenses: Expense[];
    budgets: Record<string, MonthlyBudget>;
    config: Partial<AppConfig>;
    categories: CategoryDefinition[] | null;
    income: Income[];
    transfers: Transfer[];
  }> => {
    const [expenses, budgets, config, categories, income, transfers] = await Promise.all([
      sheetsApi.getExpenses(accessToken, spreadsheetId),
      sheetsApi.getBudgets(accessToken, spreadsheetId),
      sheetsApi.getConfig(accessToken, spreadsheetId),
      sheetsApi.getCategories(accessToken, spreadsheetId),
      sheetsApi.getIncome(accessToken, spreadsheetId),
      sheetsApi.getTransfers(accessToken, spreadsheetId)
    ]);

    return { expenses, budgets, config, categories, income, transfers };
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
