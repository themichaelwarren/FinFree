/**
 * FinFree Google Apps Script
 * Deploy as Web App with "Anyone" access
 *
 * This script handles:
 * - Expense syncing to "Expenses" sheet
 * - Config/Budget syncing to "Config" sheet
 *
 * Security: All requests must include the correct API_SECRET
 */

// IMPORTANT: Change this to a random string only you know!
// Example: generate one at https://randomkeygen.com/
const API_SECRET = 'xK9mP2qL7nR4wY6j';

// Sheet names
const EXPENSES_SHEET = 'Expenses';
const CONFIG_SHEET = 'Config';
const BUDGETS_SHEET = 'Budgets';

function verifySecret(secret) {
  return secret === API_SECRET;
}

function unauthorizedResponse() {
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: 'Unauthorized'
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Verify secret
    if (!verifySecret(data.secret)) {
      return unauthorizedResponse();
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Handle config sync
    if (data.type === 'config') {
      return saveConfig(ss, data.config);
    }

    // Handle budgets sync
    if (data.type === 'budgets') {
      return saveBudgets(ss, data.budgets);
    }

    // Handle expense sync (default behavior)
    return saveExpenses(ss, data.expenses || data);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    // Verify secret from query parameter
    if (!verifySecret(e.parameter.secret)) {
      return unauthorizedResponse();
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const type = e.parameter.type || 'all';

    const result = {};

    if (type === 'config' || type === 'all') {
      result.config = getConfig(ss);
    }

    if (type === 'expenses' || type === 'all') {
      result.expenses = getExpenses(ss);
    }

    if (type === 'budgets' || type === 'all') {
      result.budgets = getBudgets(ss);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: result
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function saveConfig(ss, config) {
  let sheet = ss.getSheetByName(CONFIG_SHEET);

  // Create Config sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG_SHEET);
    sheet.getRange('A1').setValue('Config JSON');
    sheet.getRange('A2').setValue('Last Updated');
  }

  // Store config as JSON in cell B1
  sheet.getRange('B1').setValue(JSON.stringify(config));
  sheet.getRange('B2').setValue(new Date().toISOString());

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Config saved'
  })).setMimeType(ContentService.MimeType.JSON);
}

function getConfig(ss) {
  const sheet = ss.getSheetByName(CONFIG_SHEET);

  if (!sheet) {
    return null;
  }

  const configJson = sheet.getRange('B1').getValue();
  if (!configJson) {
    return null;
  }

  try {
    return JSON.parse(configJson);
  } catch {
    return null;
  }
}

function saveExpenses(ss, expenses) {
  let sheet = ss.getSheetByName(EXPENSES_SHEET);

  // Create Expenses sheet with headers if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(EXPENSES_SHEET);
    sheet.getRange('A1:K1').setValues([[
      'ID', 'Date', 'Timestamp', 'Amount', 'Category', 'Type',
      'Payment Method', 'Store', 'Notes', 'Source', 'Synced'
    ]]);
    sheet.getRange('A1:K1').setFontWeight('bold');
  }

  // Get existing data to check for duplicates and updates
  const existingData = sheet.getDataRange().getValues();

  // Build a map of existing IDs to their row numbers (1-indexed, accounting for header)
  const idToRowNum = {};
  existingData.slice(1).forEach((row, index) => {
    idToRowNum[row[0]] = index + 2; // +2 because: +1 for 1-indexed, +1 for header row
  });

  const expenseArray = Array.isArray(expenses) ? expenses : [expenses];

  // Separate into new expenses and updates
  const newExpenses = expenseArray.filter(exp => !idToRowNum[exp.id]);
  const updatedExpenses = expenseArray.filter(exp => idToRowNum[exp.id]);

  let addedCount = 0;
  let updatedCount = 0;

  // Update existing expenses
  for (const exp of updatedExpenses) {
    const rowNum = idToRowNum[exp.id];
    const rowData = [
      exp.id,
      exp.date,
      exp.timestamp,
      exp.amount,
      exp.category,
      exp.type,
      exp.paymentMethod || 'Cash',
      exp.store,
      exp.notes || '',
      exp.source || 'manual',
      'true'
    ];
    sheet.getRange(rowNum, 1, 1, 11).setValues([rowData]);
    updatedCount++;
  }

  // Append new expenses
  if (newExpenses.length > 0) {
    const rows = newExpenses.map(exp => [
      exp.id,
      exp.date,
      exp.timestamp,
      exp.amount,
      exp.category,
      exp.type,
      exp.paymentMethod || 'Cash',
      exp.store,
      exp.notes || '',
      exp.source || 'manual',
      'true'
    ]);

    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 11).setValues(rows);
    addedCount = rows.length;
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    added: addedCount,
    updated: updatedCount
  })).setMimeType(ContentService.MimeType.JSON);
}

function getExpenses(ss) {
  const sheet = ss.getSheetByName(EXPENSES_SHEET);

  if (!sheet) {
    return [];
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return [];
  }

  // Skip header row, map to expense objects
  return data.slice(1).map(row => ({
    id: row[0],
    date: row[1],
    timestamp: row[2],
    amount: row[3],
    category: row[4],
    type: row[5],
    paymentMethod: row[6] || 'Cash',
    store: row[7],
    notes: row[8] || '',
    source: row[9] || 'manual',
    synced: true
  }));
}

function saveBudgets(ss, budgetsData) {
  let sheet = ss.getSheetByName(BUDGETS_SHEET);

  // Create Budgets sheet with headers if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(BUDGETS_SHEET);
    sheet.getRange('A1:E1').setValues([['Month', 'Category', 'Type', 'Amount', 'Salary']]);
    sheet.getRange('A1:E1').setFontWeight('bold');
  }

  // budgetsData is Record<string, MonthlyBudget> keyed by YYYY-MM
  // Each MonthlyBudget has: { salary: number, categories: Record<Category, { amount, type }> }

  const rows = [];
  for (const month in budgetsData) {
    const budget = budgetsData[month];
    const salary = budget.salary || 0;

    // Delete existing rows for this month
    const existingData = sheet.getDataRange().getValues();
    for (let i = existingData.length - 1; i >= 1; i--) {
      if (existingData[i][0] === month) {
        sheet.deleteRow(i + 1);
      }
    }

    // Add rows for each category
    for (const category in budget.categories) {
      const cat = budget.categories[category];
      rows.push([month, category, cat.type, cat.amount, salary]);
    }
  }

  // Append new rows
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Budgets saved',
    rowsAdded: rows.length
  })).setMimeType(ContentService.MimeType.JSON);
}

function getBudgets(ss) {
  const sheet = ss.getSheetByName(BUDGETS_SHEET);

  if (!sheet) {
    // Fall back to legacy config format
    const config = getConfig(ss);
    return config && config.budgets ? config.budgets : {};
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return {};
  }

  // Convert rows back to Record<string, MonthlyBudget> format
  // Row format: [Month, Category, Type, Amount, Salary]
  const budgets = {};

  data.slice(1).forEach(row => {
    const month = row[0];
    const category = row[1];
    const type = row[2];
    const amount = row[3];
    const salary = row[4];

    if (!budgets[month]) {
      budgets[month] = {
        salary: salary,
        categories: {}
      };
    }

    budgets[month].categories[category] = {
      amount: amount,
      type: type
    };
  });

  return budgets;
}
