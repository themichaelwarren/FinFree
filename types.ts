
export type ExpenseType = 'NEED' | 'WANT' | 'SAVE' | 'DEBT';

export type PaymentMethod = 'Cash' | 'Card' | 'Bank';

export type Theme = 'light' | 'dark';

export type Category = 
  | 'RENT' 
  | 'ELECTRIC' 
  | 'GAS' 
  | 'WATER' 
  | 'PHONE' 
  | 'FOOD' 
  | 'TRANSPORT' 
  | 'TOILETRIES' 
  | 'EAT OUT' 
  | 'WANT' 
  | 'SAVE' 
  | 'DEBT';

export interface Expense {
  id: string;
  timestamp: string;
  date: string;
  amount: number;
  category: Category;
  type: ExpenseType;
  paymentMethod: PaymentMethod;
  store: string;
  notes: string;
  source: 'manual' | 'receipt';
  synced: boolean;
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
  bank: number;
  lastUpdated: string;
}

export interface AppConfig {
  geminiKey: string;
  sheetsUrl: string;
  sheetsSecret: string; // Secret token for API authentication
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
  total: number;
  items: ReceiptItem[];
  confidence: 'high' | 'medium' | 'low';
}
