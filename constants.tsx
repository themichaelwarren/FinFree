
import React from 'react';
import {
  Home,
  Zap,
  Utensils,
  Bus,
  ShoppingBag,
  Smile,
  PiggyBank,
  AlertCircle,
  Plus,
  Camera,
  History,
  LayoutGrid,
  Settings as SettingsIcon,
  CloudOff,
  CheckCircle2,
  Table,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Sun,
  Moon
} from 'lucide-react';
import { Category, ExpenseType, AppConfig, MonthlyBudget, PaymentMethod } from './types';

export const CATEGORIES: Category[] = [
  'RENT',
  'ELECTRIC',
  'GAS',
  'WATER',
  'PHONE',
  'FOOD',
  'TRANSPORT',
  'TOILETRIES',
  'EAT OUT',
  'WANT',
  'SAVE',
  'DEBT'
];

export const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Card', 'Bank'];

export const CATEGORY_TYPES: Record<Category, ExpenseType> = {
  RENT: 'NEED',
  ELECTRIC: 'NEED',
  GAS: 'NEED',
  WATER: 'NEED',
  PHONE: 'NEED',
  FOOD: 'NEED',
  TRANSPORT: 'NEED',
  TOILETRIES: 'NEED',
  'EAT OUT': 'WANT',
  WANT: 'WANT',
  SAVE: 'SAVE',
  DEBT: 'DEBT'
};

export const CATEGORY_ICONS: Record<Category, React.ReactNode> = {
  RENT: <Home className="w-4 h-4" />,
  ELECTRIC: <Zap className="w-4 h-4" />,
  GAS: <Zap className="w-4 h-4" />,
  WATER: <Zap className="w-4 h-4" />,
  PHONE: <Zap className="w-4 h-4" />,
  FOOD: <Utensils className="w-4 h-4" />,
  TRANSPORT: <Bus className="w-4 h-4" />,
  TOILETRIES: <ShoppingBag className="w-4 h-4" />,
  'EAT OUT': <Utensils className="w-4 h-4" />,
  WANT: <Smile className="w-4 h-4" />,
  SAVE: <PiggyBank className="w-4 h-4" />,
  DEBT: <AlertCircle className="w-4 h-4" />
};

export const ICONS = {
  Plus,
  Camera,
  History,
  LayoutGrid,
  Settings: SettingsIcon,
  CloudOff,
  CheckCircle2,
  AlertCircle,
  Table,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Sun,
  Moon
};

const createEmptyBudget = (): MonthlyBudget => ({
  salary: 0,
  categories: CATEGORIES.reduce((acc, cat) => {
    acc[cat] = { amount: 0, type: CATEGORY_TYPES[cat] };
    return acc;
  }, {} as Record<Category, { amount: number; type: ExpenseType }>)
});

export const DEFAULT_CONFIG: AppConfig = {
  geminiKey: process.env.GEMINI_API_KEY || '',
  sheetsUrl: process.env.SHEETS_URL || '',
  sheetsSecret: '',
  budgets: {
    [new Date().toISOString().slice(0, 7)]: {
      salary: 320000,
      categories: {
        RENT: { amount: 108000, type: 'NEED' },
        ELECTRIC: { amount: 10000, type: 'NEED' },
        GAS: { amount: 0, type: 'NEED' },
        WATER: { amount: 0, type: 'NEED' },
        PHONE: { amount: 8000, type: 'NEED' },
        FOOD: { amount: 40000, type: 'NEED' },
        TRANSPORT: { amount: 5000, type: 'NEED' },
        TOILETRIES: { amount: 4000, type: 'NEED' },
        'EAT OUT': { amount: 36000, type: 'WANT' },
        WANT: { amount: 9000, type: 'WANT' },
        SAVE: { amount: 100000, type: 'SAVE' },
        DEBT: { amount: 0, type: 'DEBT' }
      }
    }
  },
  balances: {
    cash: 0,
    bank: 0,
    lastUpdated: ''
  },
  theme: 'dark'
};

export const getBudgetForMonth = (budgets: Record<string, MonthlyBudget>, monthKey: string): MonthlyBudget => {
  return budgets[monthKey] || createEmptyBudget();
};
