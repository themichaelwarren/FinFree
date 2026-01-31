
export type ExpenseType = 'NEED' | 'WANT' | 'SAVE' | 'DEBT';

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

export interface AppConfig {
  geminiKey: string;
  sheetsUrl: string;
  budgets: Record<string, MonthlyBudget>; // Keyed by YYYY-MM
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
