
import React from 'react';
import {
  Home,
  Zap,
  Flame,
  Droplets,
  Phone,
  Utensils,
  Bus,
  ShoppingBag,
  Smile,
  PiggyBank,
  CreditCard,
  Coffee,
  Gift,
  Heart,
  Briefcase,
  Gamepad2,
  Shirt,
  Dumbbell,
  Stethoscope,
  GraduationCap,
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
  Moon,
  Pencil,
  Trash2,
  X
} from 'lucide-react';
import { Category, ExpenseType, AppConfig, MonthlyBudget, PaymentMethod, CategoryDefinition, CategoryIcon } from './types';

// Icon components map for dynamic rendering
export const ICON_COMPONENTS: Record<CategoryIcon, React.ComponentType<{ className?: string }>> = {
  Home, Zap, Flame, Droplets, Phone,
  Utensils, Bus, ShoppingBag, Smile, PiggyBank,
  CreditCard, Coffee, Gift, Heart, Briefcase,
  Gamepad2, Shirt, Dumbbell, Stethoscope, GraduationCap
};

// Available icons for category picker
export const AVAILABLE_ICONS: CategoryIcon[] = [
  'Home', 'Zap', 'Flame', 'Droplets', 'Phone',
  'Utensils', 'Bus', 'ShoppingBag', 'Smile', 'PiggyBank',
  'CreditCard', 'Coffee', 'Gift', 'Heart', 'Briefcase',
  'Gamepad2', 'Shirt', 'Dumbbell', 'Stethoscope', 'GraduationCap'
];

// Default categories
export const DEFAULT_CATEGORIES: CategoryDefinition[] = [
  { id: 'RENT', name: 'Rent', icon: 'Home', defaultType: 'NEED' },
  { id: 'ELECTRIC', name: 'Electric', icon: 'Zap', defaultType: 'NEED' },
  { id: 'GAS', name: 'Gas', icon: 'Flame', defaultType: 'NEED' },
  { id: 'WATER', name: 'Water', icon: 'Droplets', defaultType: 'NEED' },
  { id: 'PHONE', name: 'Phone', icon: 'Phone', defaultType: 'NEED' },
  { id: 'FOOD', name: 'Food', icon: 'Utensils', defaultType: 'NEED' },
  { id: 'TRANSPORT', name: 'Transport', icon: 'Bus', defaultType: 'NEED' },
  { id: 'TOILETRIES', name: 'Toiletries', icon: 'ShoppingBag', defaultType: 'NEED' },
  { id: 'EAT OUT', name: 'Eat Out', icon: 'Coffee', defaultType: 'WANT' },
  { id: 'WANT', name: 'Want', icon: 'Smile', defaultType: 'WANT' },
  { id: 'SAVE', name: 'Save', icon: 'PiggyBank', defaultType: 'SAVE' },
  { id: 'DEBT', name: 'Debt', icon: 'CreditCard', defaultType: 'DEBT' }
];

// Helper to get categories array from CategoryDefinition[]
export const getCategoryIds = (categories: CategoryDefinition[]): Category[] =>
  categories.map(c => c.id);

// Helper to get category types map from CategoryDefinition[]
export const getCategoryTypes = (categories: CategoryDefinition[]): Record<Category, ExpenseType> =>
  categories.reduce((acc, c) => {
    acc[c.id] = c.defaultType;
    return acc;
  }, {} as Record<Category, ExpenseType>);

// Helper to render category icon
export const renderCategoryIcon = (iconName: CategoryIcon, className: string = "w-4 h-4"): React.ReactNode => {
  const IconComponent = ICON_COMPONENTS[iconName];
  return IconComponent ? <IconComponent className={className} /> : null;
};

// Legacy exports for backwards compatibility
export const CATEGORIES: Category[] = getCategoryIds(DEFAULT_CATEGORIES);
export const CATEGORY_TYPES: Record<Category, ExpenseType> = getCategoryTypes(DEFAULT_CATEGORIES);

export const PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Card', 'Bank'];

// Legacy icon map (use renderCategoryIcon for dynamic categories)
export const CATEGORY_ICONS: Record<string, React.ReactNode> = DEFAULT_CATEGORIES.reduce((acc, cat) => {
  acc[cat.id] = renderCategoryIcon(cat.icon);
  return acc;
}, {} as Record<string, React.ReactNode>);

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
  geminiKey: '',  // User enters via Settings UI
  sheetsUrl: '',  // User enters via Settings UI (Apps Script mode)
  sheetsSecret: '',  // Apps Script mode
  spreadsheetId: null,  // OAuth mode
  categories: DEFAULT_CATEGORIES,
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
