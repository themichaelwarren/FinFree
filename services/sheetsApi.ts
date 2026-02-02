import { Expense, AppConfig, MonthlyBudget, AccountBalances, CategoryDefinition, Income, Transfer, BankAccount } from '../types';
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
            properties: { title: 'Transactions', index: 0 },
            data: [{
              startRow: 0,
              startColumn: 0,
              rowData: [{
                values: ['ID', 'Date', 'Timestamp', 'TransactionType', 'Amount', 'Category', 'ExpenseType', 'PaymentMethod', 'Description', 'Notes', 'Source', 'Deleted'].map(v => ({
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
            properties: { title: 'Transfers', index: 4 },
            data: [{
              startRow: 0,
              startColumn: 0,
              rowData: [{
                values: ['ID', 'Date', 'Timestamp', 'Amount', 'FromAccountId', 'ToAccountId', 'Direction', 'Description', 'Notes', 'Deleted'].map(v => ({
                  userEnteredValue: { stringValue: v },
                  userEnteredFormat: { textFormat: { bold: true } }
                }))
              }]
            }]
          },
          {
            properties: { title: 'Accounts', index: 5 },
            data: [{
              startRow: 0,
              startColumn: 0,
              rowData: [{
                values: ['ID', 'Name', 'IsDefault', 'CreatedAt'].map(v => ({
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

  // Get all expenses (reads from Transactions sheet, falls back to legacy Expenses sheet)
  getExpenses: async (accessToken: string, spreadsheetId: string): Promise<Expense[]> => {
    const expenses: Expense[] = [];

    // Try reading from new Transactions sheet (now includes Deleted column at L)
    try {
      const transactionValues = await sheetsApi.getValues(accessToken, spreadsheetId, 'Transactions!A2:L');
      transactionValues
        .filter(row => String(row[3]) === 'expense')
        .filter(row => String(row[11] || '').toLowerCase() !== 'true')  // Filter out deleted
        .forEach(row => {
          expenses.push({
            id: String(row[0]),
            date: String(row[1]),
            timestamp: String(row[2]),
            // row[3] is TransactionType
            amount: Number(row[4]),
            category: String(row[5]) as Expense['category'],
            type: String(row[6] || 'NEED') as Expense['type'],
            paymentMethod: (String(row[7]) || 'Cash') as Expense['paymentMethod'],
            store: String(row[8] || ''),
            notes: String(row[9] || ''),
            source: (String(row[10]) || 'manual') as Expense['source'],
            synced: true
          });
        });
    } catch {
      // Transactions sheet might not exist
    }

    // Also read from legacy Expenses sheet (for backwards compatibility)
    try {
      const legacyValues = await sheetsApi.getValues(accessToken, spreadsheetId, 'Expenses!A2:J');
      const existingIds = new Set(expenses.map(e => e.id));

      legacyValues.forEach(row => {
        const id = String(row[0]);
        if (!existingIds.has(id)) {
          expenses.push({
            id,
            date: String(row[1]),
            timestamp: String(row[2]),
            amount: Number(row[3]),
            category: String(row[4]) as Expense['category'],
            type: String(row[5]) as Expense['type'],
            paymentMethod: (String(row[6]) || 'Cash') as Expense['paymentMethod'],
            store: String(row[7] || ''),
            notes: String(row[8] || ''),
            source: (String(row[9]) || 'manual') as Expense['source'],
            synced: true
          });
        }
      });
    } catch {
      // Legacy sheet might not exist
    }

    return expenses;
  },

  // Add or update expenses (writes to Transactions sheet)
  addExpenses: async (accessToken: string, spreadsheetId: string, expenses: Expense[]): Promise<void> => {
    if (expenses.length === 0) return;

    // Ensure Transactions sheet exists
    await sheetsApi.ensureTransactionsSheet(accessToken, spreadsheetId);

    // Get existing expenses to determine which need adding vs updating
    const existing = await sheetsApi.getExpenses(accessToken, spreadsheetId);
    const existingIds = new Set(existing.map(e => e.id));

    const newExpenses = expenses.filter(e => !existingIds.has(e.id));

    // Append new expenses to Transactions sheet
    if (newExpenses.length > 0) {
      const rows = newExpenses.map(e => [
        e.id,
        e.date,
        e.timestamp,
        'expense',  // TransactionType
        e.amount,
        e.category,
        e.type || 'NEED',  // ExpenseType
        e.paymentMethod || 'Cash',
        e.store || '',  // Description
        e.notes || '',
        e.source || 'manual',
        ''  // Deleted (empty = not deleted)
      ]);
      await sheetsApi.appendValues(accessToken, spreadsheetId, 'Transactions!A:L', rows);
    }
  },


  // Get all income (reads from Transactions sheet, falls back to legacy Income sheet)
  getIncome: async (accessToken: string, spreadsheetId: string): Promise<Income[]> => {
    const incomeList: Income[] = [];

    // Try reading from new Transactions sheet (now includes Deleted column at L)
    try {
      const transactionValues = await sheetsApi.getValues(accessToken, spreadsheetId, 'Transactions!A2:L');
      transactionValues
        .filter(row => String(row[3]) === 'income')
        .filter(row => String(row[11] || '').toLowerCase() !== 'true')  // Filter out deleted
        .forEach(row => {
          incomeList.push({
            id: String(row[0]),
            date: String(row[1]),
            timestamp: String(row[2]),
            // row[3] is TransactionType
            amount: Number(row[4]),
            category: String(row[5]) as Income['category'],
            // row[6] is ExpenseType (not used for income)
            paymentMethod: (String(row[7]) || 'Bank') as Income['paymentMethod'],
            description: String(row[8] || ''),
            notes: String(row[9] || ''),
            synced: true
          });
        });
    } catch {
      // Transactions sheet might not exist
    }

    // Also read from legacy Income sheet (for backwards compatibility)
    try {
      const legacyValues = await sheetsApi.getValues(accessToken, spreadsheetId, 'Income!A2:H');
      const existingIds = new Set(incomeList.map(i => i.id));

      legacyValues.forEach(row => {
        const id = String(row[0]);
        if (!existingIds.has(id)) {
          incomeList.push({
            id,
            date: String(row[1]),
            timestamp: String(row[2]),
            amount: Number(row[3]),
            category: String(row[4]) as Income['category'],
            paymentMethod: (String(row[5]) || 'Bank') as Income['paymentMethod'],
            description: String(row[6] || ''),
            notes: String(row[7] || ''),
            synced: true
          });
        }
      });
    } catch {
      // Legacy sheet might not exist
    }

    return incomeList;
  },

  // Add or update income (writes to Transactions sheet)
  addIncome: async (accessToken: string, spreadsheetId: string, income: Income[]): Promise<void> => {
    if (income.length === 0) return;

    // Ensure Transactions sheet exists
    await sheetsApi.ensureTransactionsSheet(accessToken, spreadsheetId);

    // Get existing income to determine which need adding vs updating
    const existing = await sheetsApi.getIncome(accessToken, spreadsheetId);
    const existingIds = new Set(existing.map(i => i.id));

    const newIncome = income.filter(i => !existingIds.has(i.id));

    // Append new income to Transactions sheet
    if (newIncome.length > 0) {
      const rows = newIncome.map(i => [
        i.id,
        i.date,
        i.timestamp,
        'income',  // TransactionType
        i.amount,
        i.category,
        '',  // ExpenseType (not used for income)
        i.paymentMethod || 'Bank',
        i.description || '',
        i.notes || '',
        '',  // Source (not used for income)
        ''  // Deleted (empty = not deleted)
      ]);
      await sheetsApi.appendValues(accessToken, spreadsheetId, 'Transactions!A:L', rows);
    }
  },

  // Ensure Transactions sheet exists (migration helper for older spreadsheets)
  ensureTransactionsSheet: async (accessToken: string, spreadsheetId: string): Promise<void> => {
    try {
      const spreadsheet = await sheetsApi.getSpreadsheet(accessToken, spreadsheetId);
      if (!spreadsheet.sheets.includes('Transactions')) {
        // Add Transactions sheet via batchUpdate
        const response = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [{
              addSheet: {
                properties: { title: 'Transactions' }
              }
            }]
          })
        });

        if (response.ok) {
          // Add header row
          await sheetsApi.updateValues(accessToken, spreadsheetId, 'Transactions!A1:L1', [
            ['ID', 'Date', 'Timestamp', 'TransactionType', 'Amount', 'Category', 'ExpenseType', 'PaymentMethod', 'Description', 'Notes', 'Source', 'Deleted']
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
      // Check if Categories sheet exists first to avoid 400 error
      const spreadsheet = await sheetsApi.getSpreadsheet(accessToken, spreadsheetId);
      if (!spreadsheet.sheets.includes('Categories')) {
        return null;
      }

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
    // Ensure Categories sheet exists (for older spreadsheets)
    await sheetsApi.ensureCategoriesSheet(accessToken, spreadsheetId);

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

  // Ensure Categories sheet exists (migration helper for older spreadsheets)
  ensureCategoriesSheet: async (accessToken: string, spreadsheetId: string): Promise<void> => {
    try {
      const spreadsheet = await sheetsApi.getSpreadsheet(accessToken, spreadsheetId);
      if (!spreadsheet.sheets.includes('Categories')) {
        // Add Categories sheet via batchUpdate
        const response = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [{
              addSheet: {
                properties: { title: 'Categories' }
              }
            }]
          })
        });

        if (response.ok) {
          // Add header row
          await sheetsApi.updateValues(accessToken, spreadsheetId, 'Categories!A1:D1', [
            ['ID', 'Name', 'Type', 'Icon']
          ]);
        }
      }
    } catch {
      // Ignore errors - sheet might already exist
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

  // Get all transfers (now includes Deleted column at J)
  getTransfers: async (accessToken: string, spreadsheetId: string): Promise<Transfer[]> => {
    try {
      // Check if Transfers sheet exists first to avoid 400 error
      const spreadsheet = await sheetsApi.getSpreadsheet(accessToken, spreadsheetId);
      if (!spreadsheet.sheets.includes('Transfers')) {
        return [];
      }

      const values = await sheetsApi.getValues(accessToken, spreadsheetId, 'Transfers!A2:J');

      return values
        .filter(row => String(row[9] || '').toLowerCase() !== 'true')  // Filter out deleted
        .map(row => {
          // Handle both old format (7 cols) and new format (9+ cols)
          const hasNewFormat = row.length >= 9 || (row[4] && !['BANK_TO_CASH', 'CASH_TO_BANK'].includes(String(row[4])));

          if (hasNewFormat) {
            // New format: ID, Date, Timestamp, Amount, FromAccountId, ToAccountId, Direction, Description, Notes, Deleted
            return {
              id: String(row[0]),
              date: String(row[1]),
              timestamp: String(row[2]),
              amount: Number(row[3]),
              fromAccountId: String(row[4] || 'cash'),
              toAccountId: String(row[5] || 'bank_default'),
              direction: (String(row[6] || '') || undefined) as Transfer['direction'],
              description: String(row[7] || ''),
              notes: String(row[8] || ''),
              synced: true
            };
          } else {
            // Old format: ID, Date, Timestamp, Amount, Direction, Description, Notes
            const direction = String(row[4]) as Transfer['direction'];
            return {
              id: String(row[0]),
              date: String(row[1]),
              timestamp: String(row[2]),
              amount: Number(row[3]),
              fromAccountId: direction === 'BANK_TO_CASH' ? 'bank_default' : 'cash',
              toAccountId: direction === 'BANK_TO_CASH' ? 'cash' : 'bank_default',
              direction,
              description: String(row[5] || ''),
              notes: String(row[6] || ''),
              synced: true
            };
          }
        });
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

    // Append new transfers with new format (includes fromAccountId, toAccountId, Deleted)
    if (newTransfers.length > 0) {
      const rows = newTransfers.map(t => [
        t.id,
        t.date,
        t.timestamp,
        t.amount,
        t.fromAccountId || 'cash',
        t.toAccountId || 'bank_default',
        t.direction || '',
        t.description || '',
        t.notes || '',
        ''  // Deleted (empty = not deleted)
      ]);
      await sheetsApi.appendValues(accessToken, spreadsheetId, 'Transfers!A:J', rows);
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
          // Add header row with new format (includes Deleted)
          await sheetsApi.updateValues(accessToken, spreadsheetId, 'Transfers!A1:J1', [
            ['ID', 'Date', 'Timestamp', 'Amount', 'FromAccountId', 'ToAccountId', 'Direction', 'Description', 'Notes', 'Deleted']
          ]);
        }
      }
    } catch {
      // Ignore errors - sheet might already exist
    }
  },

  // Get all bank accounts
  getAccounts: async (accessToken: string, spreadsheetId: string): Promise<BankAccount[]> => {
    try {
      // Check if Accounts sheet exists first to avoid 400 error
      const spreadsheet = await sheetsApi.getSpreadsheet(accessToken, spreadsheetId);
      if (!spreadsheet.sheets.includes('Accounts')) {
        return [];
      }

      const values = await sheetsApi.getValues(accessToken, spreadsheetId, 'Accounts!A2:D');

      return values.map(row => ({
        id: String(row[0]),
        name: String(row[1]),
        isDefault: String(row[2]).toLowerCase() === 'true',
        createdAt: String(row[3] || new Date().toISOString())
      }));
    } catch {
      // Accounts sheet might not exist in older spreadsheets
      return [];
    }
  },

  // Save bank accounts (replace all)
  saveAccounts: async (accessToken: string, spreadsheetId: string, accounts: BankAccount[]): Promise<void> => {
    // Ensure Accounts sheet exists
    await sheetsApi.ensureAccountsSheet(accessToken, spreadsheetId);

    const rows = accounts.map(a => [
      a.id,
      a.name,
      String(a.isDefault),
      a.createdAt
    ]);

    // Clear and rewrite
    await sheetsApi.clearValues(accessToken, spreadsheetId, 'Accounts!A2:D');
    if (rows.length > 0) {
      await sheetsApi.updateValues(accessToken, spreadsheetId, 'Accounts!A2:D', rows);
    }
  },

  // Ensure Accounts sheet exists (migration helper for older spreadsheets)
  ensureAccountsSheet: async (accessToken: string, spreadsheetId: string): Promise<void> => {
    try {
      const spreadsheet = await sheetsApi.getSpreadsheet(accessToken, spreadsheetId);
      if (!spreadsheet.sheets.includes('Accounts')) {
        // Add Accounts sheet via batchUpdate
        const response = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [{
              addSheet: {
                properties: { title: 'Accounts' }
              }
            }]
          })
        });

        if (response.ok) {
          // Add header row
          await sheetsApi.updateValues(accessToken, spreadsheetId, 'Accounts!A1:D1', [
            ['ID', 'Name', 'IsDefault', 'CreatedAt']
          ]);
        }
      }
    } catch {
      // Ignore errors - sheet might already exist
    }
  },

  // Mark a transaction as deleted by ID (sets Deleted column to 'true')
  markTransactionAsDeleted: async (
    accessToken: string,
    spreadsheetId: string,
    id: string,
    type: 'expense' | 'income' | 'transfer'
  ): Promise<boolean> => {
    try {
      if (type === 'transfer') {
        // Transfers are in separate sheet
        const values = await sheetsApi.getValues(accessToken, spreadsheetId, 'Transfers!A2:A');
        const rowIndex = values.findIndex(row => String(row[0]) === id);
        if (rowIndex === -1) return false;

        // Row index is 0-based, but sheet rows start at 2 (row 1 is header)
        const sheetRow = rowIndex + 2;
        await sheetsApi.updateValues(accessToken, spreadsheetId, `Transfers!J${sheetRow}`, [['true']]);
        return true;
      } else {
        // Expenses and income are in Transactions sheet
        const values = await sheetsApi.getValues(accessToken, spreadsheetId, 'Transactions!A2:A');
        const rowIndex = values.findIndex(row => String(row[0]) === id);
        if (rowIndex === -1) return false;

        const sheetRow = rowIndex + 2;
        await sheetsApi.updateValues(accessToken, spreadsheetId, `Transactions!L${sheetRow}`, [['true']]);
        return true;
      }
    } catch (error) {
      console.error('Failed to mark as deleted:', error);
      return false;
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
    accounts: BankAccount[];
  }> => {
    const [expenses, budgets, config, categories, income, transfers, accounts] = await Promise.all([
      sheetsApi.getExpenses(accessToken, spreadsheetId),
      sheetsApi.getBudgets(accessToken, spreadsheetId),
      sheetsApi.getConfig(accessToken, spreadsheetId),
      sheetsApi.getCategories(accessToken, spreadsheetId),
      sheetsApi.getIncome(accessToken, spreadsheetId),
      sheetsApi.getTransfers(accessToken, spreadsheetId),
      sheetsApi.getAccounts(accessToken, spreadsheetId)
    ]);

    return { expenses, budgets, config, categories, income, transfers, accounts };
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
