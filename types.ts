
export type ExpenseType = 'NEED' | 'WANT' | 'SAVE' | 'DEBT';

export type PaymentMethod = 'Cash' | 'Card' | 'Bank';

export type Theme = 'light' | 'dark' | 'system';

// Icon names available for categories
export type CategoryIcon =
  | 'Home' | 'Zap' | 'Flame' | 'Droplets' | 'Phone'
  | 'Utensils' | 'Bus' | 'ShoppingBag' | 'Smile' | 'PiggyBank'
  | 'CreditCard' | 'Coffee' | 'Gift' | 'Heart' | 'Briefcase'
  | 'Gamepad2' | 'Shirt' | 'Dumbbell' | 'Stethoscope' | 'GraduationCap'
  | 'Wifi' | 'Shield' | 'Repeat' | 'Wrench' | 'Car';

// Category definition for customizable categories
export interface CategoryDefinition {
  id: string;           // Unique identifier (uppercase, e.g., 'RENT')
  name: string;         // Display name (e.g., 'Rent')
  icon: CategoryIcon;   // Icon to display
  defaultType: ExpenseType;  // Default NEED/WANT/SAVE classification
}

// Category is now a string to support custom categories
export type Category = string;

export interface Expense {
  id: string;
  timestamp: string;
  date: string;
  time?: string;  // HH:MM format from receipt, for chronological sorting
  amount: number;
  category: Category;
  type: ExpenseType;
  paymentMethod: PaymentMethod;
  store: string;
  notes: string;
  source: 'manual' | 'receipt';
  synced: boolean;
}

// Income tracking types
export type IncomeCategory = 'SALARY' | 'FREELANCE' | 'BONUS' | 'REFUND' | 'GIFT' | 'OTHER';

// Income only comes in as Cash or Bank (no Card)
export type IncomePaymentMethod = 'Cash' | 'Bank';

export interface Income {
  id: string;
  timestamp: string;
  date: string;
  amount: number;
  category: IncomeCategory;
  paymentMethod: IncomePaymentMethod;
  description: string;
  notes: string;
  synced: boolean;
}

// Bank Account Definition (user-defined accounts)
export interface BankAccount {
  id: string;           // e.g., 'bank_ufj', 'bank_rakuten'
  name: string;         // e.g., 'UFJ Checking', 'Rakuten'
  isDefault: boolean;   // Default for Card payments
  createdAt: string;
}

// Reserved account ID for Cash (cannot be deleted)
export const CASH_ACCOUNT_ID = 'cash';

// Account transfers (ATM withdrawal, deposit cash to bank, bank-to-bank)
export type TransferDirection = 'BANK_TO_CASH' | 'CASH_TO_BANK';

export interface Transfer {
  id: string;
  timestamp: string;
  date: string;
  amount: number;
  fromAccountId: string;  // 'cash' or bank account ID
  toAccountId: string;    // 'cash' or bank account ID
  description: string;
  notes: string;
  synced: boolean;
  direction?: TransferDirection;  // Legacy, kept for migration
}

// Per-account starting balance with its own date
export interface AccountStartingBalance {
  balance: number;
  asOfDate: string;  // YYYY-MM-DD
}

// Starting balance for running total calculations
// Supports per-account dates: each account can have its own starting date
export interface StartingBalance {
  // New per-account format with individual dates
  cash?: AccountStartingBalance;
  accountBalances?: Record<string, AccountStartingBalance>;  // accountId → {balance, asOfDate}

  // Legacy format (single date for all) - kept for backwards compatibility
  accounts?: Record<string, number>;  // accountId → balance (deprecated)
  asOfDate?: string;  // YYYY-MM-DD (deprecated, used as fallback)
  bank?: number;  // Deprecated, kept for migration
}

export interface CategoryBudget {
  amount: number;
  type: ExpenseType;
}

export interface MonthlyBudget {
  salary: number;
  categories: Record<Category, CategoryBudget>;
}

export interface AccountBalances {
  cash: number;
  accounts: Record<string, number>;  // accountId → balance
  lastUpdated: string;
  startingBalance?: StartingBalance;
  bank?: number;  // Deprecated, kept for migration
}

export type SyncMode = 'oauth' | 'appsscript' | 'local';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  picture: string;
  accessToken: string;
  expiresAt: number;
}

export interface AppConfig {
  geminiKey: string;
  sheetsUrl: string;
  sheetsSecret: string; // Secret token for API authentication
  spreadsheetId: string | null; // For OAuth mode
  categories: CategoryDefinition[]; // Custom categories
  budgets: Record<string, MonthlyBudget>; // Keyed by YYYY-MM
  balances: AccountBalances;
  theme: Theme;
}

export interface ReceiptItem {
  name: string;
  price: number;
}

export interface ReceiptExtraction {
  store: string;
  date: string;
  time?: string;  // HH:MM format extracted from receipt
  total: number;
  items: ReceiptItem[];
  confidence: 'high' | 'medium' | 'low';
  suggestedCategory?: string;  // AI-suggested category ID
  suggestedType?: ExpenseType; // AI-suggested expense type
}
