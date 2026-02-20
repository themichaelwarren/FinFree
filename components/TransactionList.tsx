
import React, { useState, useMemo } from 'react';
import { Expense, ExpenseType, PaymentMethod, CategoryDefinition, Income, IncomeCategory, IncomePaymentMethod, Transfer, TransferDirection, BankAccount } from '../types';
import { ICONS, DEFAULT_CATEGORIES, PAYMENT_METHODS, renderCategoryIcon, INCOME_CATEGORIES, INCOME_PAYMENT_METHODS, TRANSFER_DIRECTIONS } from '../constants';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import { FutureBalanceWarning } from '../services/calculations';
import { getPaymentMethodDisplay } from '../services/storage';

type GroupBy = 'day' | 'category' | 'none';
type TransactionFilter = 'ALL' | 'EXPENSES' | 'INCOME' | 'TRANSFERS';
type DuplicateFilter = 'ALL' | 'DUPLICATES';

// Unified transaction type for combined list
interface Transaction {
  id: string;
  type: 'expense' | 'income' | 'transfer';
  date: string;
  time?: string; // HH:MM format for chronological sorting
  timestamp: string;
  amount: number;
  category: string;
  paymentMethod: string;
  description: string; // store for expenses, description for income/transfers
  notes: string;
  synced: boolean;
  expenseType?: ExpenseType; // Only for expenses
  source?: string; // Only for expenses
  transferDirection?: TransferDirection; // Only for transfers (legacy)
  fromAccountId?: string; // Only for transfers
  toAccountId?: string; // Only for transfers
}

interface TransactionListProps {
  expenses: Expense[];
  income?: Income[];
  transfers?: Transfer[];
  onDeleteExpense: (id: string) => void;
  onDeleteIncome?: (id: string) => void;
  onDeleteTransfer?: (id: string) => void;
  onEditExpense?: (id: string, updates: Partial<Expense>) => void;
  onEditIncome?: (id: string, updates: Partial<Income>) => void;
  onEditTransfer?: (id: string, updates: Partial<Transfer>) => void;
  categories?: CategoryDefinition[];
  bankAccounts?: BankAccount[];
  isDark?: boolean;
  limit?: number; // Optional limit for preview mode
  futureBalanceWarnings?: Map<string, FutureBalanceWarning>; // Warnings for insufficient funds
}

const TransactionList: React.FC<TransactionListProps> = ({
  expenses,
  income = [],
  transfers = [],
  onDeleteExpense,
  onDeleteIncome,
  onDeleteTransfer,
  onEditExpense,
  onEditIncome,
  onEditTransfer,
  categories = DEFAULT_CATEGORIES,
  bankAccounts = [],
  isDark = true,
  limit,
  futureBalanceWarnings = new Map()
}) => {
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ExpenseType | 'ALL'>('ALL');
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL'); // 'ALL' or 'YYYY-MM'
  const [duplicateFilter, setDuplicateFilter] = useState<DuplicateFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Expense> | Partial<Income> | Partial<Transfer>>({});
  const [editingType, setEditingType] = useState<'expense' | 'income' | 'transfer'>('expense');

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'NEED': return 'text-rose-500';
      case 'WANT': return 'text-blue-500';
      case 'SAVE': return 'text-amber-500';
      case 'DEBT': return 'text-purple-500';
      default: return isDark ? 'text-zinc-500' : 'text-gray-500';
    }
  };

  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'NEED': return 'Need';
      case 'WANT': return 'Want';
      case 'SAVE': return 'Save';
      case 'DEBT': return 'Debt';
      default: return type;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) {
      return 'Today';
    } else if (dateStr === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday';
    } else {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }).format(date);
    }
  };

  const formatDateFull = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date(dateStr));
  };

  // Convert expenses, income and transfers to unified transactions
  const allTransactions = useMemo((): Transaction[] => {
    const expenseTransactions: Transaction[] = expenses.map(e => ({
      id: e.id,
      type: 'expense' as const,
      date: e.date,
      time: e.time,
      timestamp: e.timestamp,
      amount: e.amount,
      category: e.category,
      paymentMethod: e.paymentMethod,
      description: e.store,
      notes: e.notes || '',
      synced: e.synced,
      expenseType: e.type,
      source: e.source
    }));

    const incomeTransactions: Transaction[] = income.map(i => ({
      id: i.id,
      type: 'income' as const,
      date: i.date,
      timestamp: i.timestamp,
      amount: i.amount,
      category: i.category,
      paymentMethod: i.paymentMethod,
      description: i.description,
      notes: i.notes || '',
      synced: i.synced
    }));

    const transferTransactions: Transaction[] = transfers.map(t => {
      let paymentMethodDisplay: string;
      if (t.fromAccountId && t.toAccountId) {
        const fromName = t.fromAccountId === 'cash' ? 'Cash' : (bankAccounts.find(a => a.id === t.fromAccountId)?.name || 'Bank');
        const toName = t.toAccountId === 'cash' ? 'Cash' : (bankAccounts.find(a => a.id === t.toAccountId)?.name || 'Bank');
        paymentMethodDisplay = `${fromName} → ${toName}`;
      } else if (t.direction) {
        paymentMethodDisplay = t.direction === 'BANK_TO_CASH' ? 'Bank → Cash' : 'Cash → Bank';
      } else {
        paymentMethodDisplay = 'Transfer';
      }

      return {
        id: t.id,
        type: 'transfer' as const,
        date: t.date,
        timestamp: t.timestamp,
        amount: t.amount,
        category: 'TRANSFER',
        paymentMethod: paymentMethodDisplay,
        description: t.description,
        notes: t.notes || '',
        synced: t.synced,
        transferDirection: t.direction,
        fromAccountId: t.fromAccountId,
        toAccountId: t.toAccountId
      };
    });

    return [...expenseTransactions, ...incomeTransactions, ...transferTransactions];
  }, [expenses, income, transfers]);

  // Get available months from all transactions (sorted newest first)
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    allTransactions.forEach(t => {
      const month = t.date.slice(0, 7);
      monthSet.add(month);
    });
    return Array.from(monthSet).sort((a, b) => b.localeCompare(a));
  }, [allTransactions]);

  const formatMonth = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
  };

  // Detect potential duplicates
  const duplicateIds = useMemo(() => {
    const duplicates = new Set<string>();
    const checkableTransactions = allTransactions.filter(t => t.type !== 'transfer');
    const groups = new Map<string, Transaction[]>();
    checkableTransactions.forEach(t => {
      const key = `${t.amount}-${t.date}-${t.category}-${t.type}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    });
    groups.forEach(txns => {
      if (txns.length > 1) txns.forEach(t => duplicates.add(t.id));
    });
    return duplicates;
  }, [allTransactions]);

  const duplicateCount = duplicateIds.size;

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let result = [...allTransactions];
    if (monthFilter !== 'ALL') result = result.filter(t => t.date.startsWith(monthFilter));
    if (transactionFilter === 'EXPENSES') result = result.filter(t => t.type === 'expense');
    else if (transactionFilter === 'INCOME') result = result.filter(t => t.type === 'income');
    else if (transactionFilter === 'TRANSFERS') result = result.filter(t => t.type === 'transfer');
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.description.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        t.notes?.toLowerCase().includes(query)
      );
    }
    if (typeFilter !== 'ALL') result = result.filter(t => t.type === 'income' || t.expenseType === typeFilter);
    if (duplicateFilter === 'DUPLICATES') result = result.filter(t => duplicateIds.has(t.id));
    result.sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      if (a.time && b.time) return b.time.localeCompare(a.time);
      if (a.time && !b.time) return -1;
      if (!a.time && b.time) return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    if (limit) result = result.slice(0, limit);
    return result;
  }, [allTransactions, searchQuery, typeFilter, transactionFilter, monthFilter, duplicateFilter, duplicateIds, limit]);

  // Group transactions
  const groupedTransactions = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: 'All Transactions', transactions: filteredTransactions }];
    const groups = new Map<string, Transaction[]>();
    filteredTransactions.forEach(transaction => {
      const key = groupBy === 'day' ? transaction.date : transaction.category;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(transaction);
    });
    return Array.from(groups.entries()).map(([key, txns]) => ({
      key,
      label: groupBy === 'day' ? formatDate(key) : key,
      transactions: txns
    }));
  }, [filteredTransactions, groupBy]);

  const getCategoryIcon = (categoryId: string, transactionType: 'expense' | 'income' | 'transfer') => {
    if (transactionType === 'transfer') return <ArrowLeftRight className="w-4 h-4" />;
    if (transactionType === 'income') {
      const incomeCat = INCOME_CATEGORIES.find(c => c.id === categoryId);
      return incomeCat ? incomeCat.icon : <ArrowUpRight className="w-4 h-4" />;
    }
    const cat = categories.find(c => c.id === categoryId);
    return cat ? renderCategoryIcon(cat.icon, 'w-4 h-4') : <ICONS.AlertCircle className="w-4 h-4" />;
  };

  const getCategoryName = (categoryId: string, transactionType: 'expense' | 'income' | 'transfer') => {
    if (transactionType === 'transfer') return 'Transfer';
    if (transactionType === 'income') {
      const incomeCat = INCOME_CATEGORIES.find(c => c.id === categoryId);
      return incomeCat?.name || categoryId;
    }
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || categoryId;
  };

  const startEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setEditingType(transaction.type);
    if (transaction.type === 'expense') {
      const expense = expenses.find(e => e.id === transaction.id);
      if (expense) setEditForm({ amount: expense.amount, store: expense.store, category: expense.category, type: expense.type, date: expense.date, paymentMethod: expense.paymentMethod, notes: expense.notes });
    } else if (transaction.type === 'income') {
      const inc = income.find(i => i.id === transaction.id);
      if (inc) setEditForm({ amount: inc.amount, description: inc.description, category: inc.category, date: inc.date, paymentMethod: inc.paymentMethod, notes: inc.notes });
    } else if (transaction.type === 'transfer') {
      const transfer = transfers.find(t => t.id === transaction.id);
      if (transfer) setEditForm({ amount: transfer.amount, description: transfer.description, direction: transfer.direction, fromAccountId: transfer.fromAccountId, toAccountId: transfer.toAccountId, date: transfer.date, notes: transfer.notes });
    }
  };

  const saveEdit = () => {
    if (!editingId) return;
    if (editingType === 'expense' && onEditExpense) onEditExpense(editingId, editForm as Partial<Expense>);
    else if (editingType === 'income' && onEditIncome) onEditIncome(editingId, editForm as Partial<Income>);
    else if (editingType === 'transfer' && onEditTransfer) onEditTransfer(editingId, editForm as Partial<Transfer>);
    setEditingId(null);
    setEditForm({});
  };

  const cancelEdit = () => { setEditingId(null); setEditForm({}); };

  const handleDelete = (transaction: Transaction) => {
    if (transaction.type === 'expense') onDeleteExpense(transaction.id);
    else if (transaction.type === 'income' && onDeleteIncome) onDeleteIncome(transaction.id);
    else if (transaction.type === 'transfer' && onDeleteTransfer) onDeleteTransfer(transaction.id);
  };

  const totalFiltered = filteredTransactions.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
  const expenseTotal = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const incomeTotal = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const isPreviewMode = limit !== undefined;

  return (
    <div className="space-y-4">
      {!isPreviewMode && (
        <>
          {/* Transaction Type Filter */}
          {(income.length > 0 || transfers.length > 0) && (
            <div className={`flex p-1 rounded-xl ${isDark ? 'bg-zinc-900' : 'bg-gray-100'}`}>
              {(['ALL', 'EXPENSES', 'INCOME', 'TRANSFERS'] as TransactionFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setTransactionFilter(f)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                    transactionFilter === f
                      ? f === 'INCOME' ? 'bg-emerald-600 text-white'
                        : f === 'EXPENSES' ? 'bg-rose-600 text-white'
                          : f === 'TRANSFERS' ? 'bg-blue-600 text-white'
                            : isDark ? 'bg-zinc-700 text-white' : 'bg-white text-gray-900 shadow-sm'
                      : isDark ? 'text-zinc-500 hover:text-zinc-400' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f === 'ALL' ? 'All' : f === 'TRANSFERS' ? 'Xfer' : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          )}

          {/* Search and Filters */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search transactions..."
                  className={`w-full rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium outline-none ${isDark ? 'bg-zinc-900 text-white placeholder:text-zinc-600 border border-zinc-800' : 'bg-gray-100 text-gray-900 placeholder:text-gray-400 border border-gray-200'}`}
                />
                <ICONS.History className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
              </div>
              {availableMonths.length > 1 && (
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className={`rounded-xl py-2.5 px-3 text-sm font-medium outline-none appearance-none cursor-pointer ${isDark ? 'bg-zinc-900 text-white border border-zinc-800' : 'bg-gray-100 text-gray-900 border border-gray-200'}`}
                >
                  <option value="ALL">All Time</option>
                  {availableMonths.map(month => (
                    <option key={month} value={month}>{formatMonth(month)}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Type Filter Chips */}
            {transactionFilter !== 'INCOME' && (
              <div className="flex gap-2 flex-wrap">
                {(['ALL', 'NEED', 'WANT', 'SAVE', 'DEBT'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      typeFilter === t
                        ? t === 'ALL'
                          ? isDark ? 'bg-white text-black' : 'bg-gray-900 text-white'
                          : `${getTypeColor(t)} ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`
                        : isDark ? 'bg-zinc-900 text-zinc-500 border border-zinc-800' : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
                {duplicateCount > 0 && (
                  <button
                    onClick={() => setDuplicateFilter(duplicateFilter === 'ALL' ? 'DUPLICATES' : 'ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      duplicateFilter === 'DUPLICATES'
                        ? 'bg-orange-500 text-white'
                        : isDark ? 'bg-zinc-900 text-orange-500 border border-zinc-800' : 'bg-gray-100 text-orange-600 border border-gray-200'
                    }`}
                  >
                    {duplicateCount} Dupes
                  </button>
                )}
              </div>
            )}

            {/* Group By Controls */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className={`hidden sm:inline text-xs font-medium ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Group</span>
                <div className={`flex p-0.5 rounded-lg ${isDark ? 'bg-zinc-900' : 'bg-gray-100'}`}>
                  {(['day', 'category', 'none'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGroupBy(g)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                        groupBy === g
                          ? isDark ? 'bg-zinc-700 text-white' : 'bg-white text-gray-900 shadow-sm'
                          : isDark ? 'text-zinc-500' : 'text-gray-500'
                      }`}
                    >
                      {g === 'none' ? 'Flat' : g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`text-xs font-medium whitespace-nowrap ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                {monthFilter !== 'ALL' && <span className="text-blue-400">{formatMonth(monthFilter)} · </span>}
                {filteredTransactions.length} entries
                {transactionFilter === 'ALL' && income.length > 0 && (
                  <span className={totalFiltered >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                    {' '}· Net: {totalFiltered >= 0 ? '+' : ''}¥{totalFiltered.toLocaleString()}
                  </span>
                )}
                {transactionFilter === 'EXPENSES' && <span className="text-rose-400"> · ¥{expenseTotal.toLocaleString()}</span>}
                {transactionFilter === 'INCOME' && <span className="text-emerald-400"> · ¥{incomeTotal.toLocaleString()}</span>}
              </div>
            </div>
          </div>
        </>
      )}

      {isPreviewMode && (
        <div className="flex items-center justify-between px-1">
          <h3 className={`text-xs font-medium ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Recent</h3>
          <span className={`text-xs ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>{filteredTransactions.length} entries</span>
        </div>
      )}

      {/* Transaction Groups */}
      <div className="space-y-6 pb-10">
        {groupedTransactions.length > 0 && groupedTransactions.some(g => g.transactions.length > 0) ? (
          groupedTransactions.filter(g => g.transactions.length > 0).map((group) => (
            <div key={group.key} className="space-y-2">
              {(groupBy === 'day' || (!isPreviewMode && groupBy !== 'none')) && (
                <div className="flex items-center justify-between px-1">
                  <h4 className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>{group.label}</h4>
                  <span className={`text-xs font-medium ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                    {(() => {
                      const groupNet = group.transactions.reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
                      return groupNet >= 0 ? `+¥${groupNet.toLocaleString()}` : `-¥${Math.abs(groupNet).toLocaleString()}`;
                    })()}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                {group.transactions.map((transaction) => {
                  const isExpanded = expandedId === transaction.id;
                  const isEditing = editingId === transaction.id;
                  const isIncome = transaction.type === 'income';
                  const isTransfer = transaction.type === 'transfer';

                  return (
                    <div
                      key={transaction.id}
                      className={`rounded-xl overflow-hidden transition-colors ${
                        isIncome
                          ? isDark ? 'bg-emerald-950 border border-emerald-900' : 'bg-emerald-50 border border-emerald-200'
                          : isTransfer
                            ? isDark ? 'bg-blue-950 border border-blue-900' : 'bg-blue-50 border border-blue-200'
                            : isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-gray-200'
                      }`}
                    >
                      {/* Main Row */}
                      <div
                        className={`p-4 flex items-center justify-between gap-3 cursor-pointer ${
                          isIncome ? isDark ? 'active:bg-emerald-900' : 'active:bg-emerald-100'
                            : isTransfer ? isDark ? 'active:bg-blue-900' : 'active:bg-blue-100'
                              : isDark ? 'active:bg-zinc-800' : 'active:bg-gray-50'
                        }`}
                        onClick={() => !isEditing && setExpandedId(isExpanded ? null : transaction.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${
                            isIncome ? isDark ? 'bg-emerald-900 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
                              : isTransfer ? isDark ? 'bg-blue-900 text-blue-400' : 'bg-blue-100 text-blue-600'
                                : isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {getCategoryIcon(transaction.category, transaction.type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className={`font-semibold leading-tight truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {transaction.description}
                              </p>
                              {isIncome ? (
                                <span className="shrink-0 text-xs font-medium text-emerald-500">Income</span>
                              ) : isTransfer ? (
                                <span className="shrink-0 text-xs font-medium text-blue-500">
                                  {(() => {
                                    const toIsCash = transaction.toAccountId === 'cash' || transaction.transferDirection === 'BANK_TO_CASH';
                                    const fromIsCash = transaction.fromAccountId === 'cash' || transaction.transferDirection === 'CASH_TO_BANK';
                                    if (toIsCash && !fromIsCash) return 'ATM';
                                    if (fromIsCash && !toIsCash) return 'Deposit';
                                    return 'Transfer';
                                  })()}
                                </span>
                              ) : transaction.expenseType && (
                                <span className={`shrink-0 text-xs font-medium ${getTypeColor(transaction.expenseType)}`}>
                                  {getTypeLabel(transaction.expenseType)}
                                </span>
                              )}
                              {duplicateIds.has(transaction.id) && (
                                <span className="shrink-0 text-xs font-medium text-orange-500" title="Potential duplicate">Dupe</span>
                              )}
                              {futureBalanceWarnings.has(transaction.id) && (
                                <span className="shrink-0 text-xs font-medium text-rose-500 flex items-center gap-0.5" title={`Insufficient ${futureBalanceWarnings.get(transaction.id)?.accountName} balance`}>
                                  <AlertTriangle className="w-3 h-3" /> Low bal
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 overflow-hidden">
                              {groupBy !== 'day' && (
                                <span className={`shrink-0 text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{formatDate(transaction.date)}</span>
                              )}
                              {groupBy !== 'category' && (
                                <span className={`truncate text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                  {groupBy === 'day' ? getCategoryName(transaction.category, transaction.type) : `· ${getCategoryName(transaction.category, transaction.type)}`}
                                </span>
                              )}
                              <span className={`shrink-0 text-xs ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>· {getPaymentMethodDisplay(transaction.paymentMethod, bankAccounts)}</span>
                              {transaction.notes && <span className={`shrink-0 text-xs ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>+notes</span>}
                              {!transaction.synced && <ICONS.CloudOff className="shrink-0 w-3 h-3 text-amber-500" />}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className={`font-semibold text-base whitespace-nowrap ${
                            isIncome ? (isDark ? 'text-emerald-400' : 'text-emerald-600')
                              : isTransfer ? (isDark ? 'text-blue-400' : 'text-blue-600')
                              : (isDark ? 'text-white' : 'text-gray-900')
                          }`}>
                            {isIncome ? '+' : isTransfer ? '' : '-'}¥{transaction.amount.toLocaleString()}
                          </p>
                          <ICONS.ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''} ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
                        </div>
                      </div>

                      {/* Expanded Details / Edit Form */}
                      {isExpanded && (
                        <div className={`border-t ${
                          isIncome ? isDark ? 'border-emerald-900 bg-emerald-950' : 'border-emerald-100 bg-emerald-50/50'
                            : isTransfer ? isDark ? 'border-blue-900 bg-blue-950' : 'border-blue-100 bg-blue-50/50'
                              : isDark ? 'border-zinc-800 bg-zinc-900' : 'border-gray-100 bg-gray-50'
                        }`}>
                          {isEditing ? (
                            <div className="p-4 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Amount</label>
                                  <input type="number" value={(editForm as any).amount || ''} onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })} className={`w-full rounded-lg py-2 px-3 text-sm font-semibold outline-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`} />
                                </div>
                                <div>
                                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Date</label>
                                  <input type="date" value={(editForm as any).date || ''} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className={`w-full rounded-lg py-2 px-3 text-sm font-medium outline-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`} />
                                </div>
                              </div>
                              <div>
                                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{editingType === 'expense' ? 'Store' : 'Description'}</label>
                                <input type="text" value={editingType === 'expense' ? (editForm as Partial<Expense>).store || '' : (editForm as Partial<Income> | Partial<Transfer>).description || ''} onChange={(e) => setEditForm({ ...editForm, [editingType === 'expense' ? 'store' : 'description']: e.target.value })} className={`w-full rounded-lg py-2 px-3 text-sm font-medium outline-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`} />
                              </div>
                              {editingType === 'transfer' ? (
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>From</label>
                                    <select value={(editForm as Partial<Transfer>).fromAccountId || ''} onChange={(e) => setEditForm({ ...editForm, fromAccountId: e.target.value })} className={`w-full rounded-lg py-2 px-2 text-sm font-medium outline-none appearance-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}>
                                      <option value="cash">Cash</option>
                                      {bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}{acc.isDefault ? ' *' : ''}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>To</label>
                                    <select value={(editForm as Partial<Transfer>).toAccountId || ''} onChange={(e) => setEditForm({ ...editForm, toAccountId: e.target.value })} className={`w-full rounded-lg py-2 px-2 text-sm font-medium outline-none appearance-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}>
                                      <option value="cash">Cash</option>
                                      {bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}{acc.isDefault ? ' *' : ''}</option>)}
                                    </select>
                                  </div>
                                </div>
                              ) : (
                                <div className={`grid ${editingType === 'expense' ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
                                  <div>
                                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Category</label>
                                    <select value={(editForm as any).category || ''} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className={`w-full rounded-lg py-2 px-2 text-sm font-medium outline-none appearance-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}>
                                      {editingType === 'expense' ? categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>) : INCOME_CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </select>
                                  </div>
                                  {editingType === 'expense' && (
                                    <div>
                                      <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Type</label>
                                      <select value={(editForm as Partial<Expense>).type || ''} onChange={(e) => setEditForm({ ...editForm, type: e.target.value as ExpenseType })} className={`w-full rounded-lg py-2 px-2 text-sm font-medium outline-none appearance-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}>
                                        <option value="NEED">Need</option>
                                        <option value="WANT">Want</option>
                                        <option value="SAVE">Save</option>
                                        <option value="DEBT">Debt</option>
                                      </select>
                                    </div>
                                  )}
                                  <div>
                                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Payment</label>
                                    <select value={(editForm as any).paymentMethod || ''} onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value as PaymentMethod })} className={`w-full rounded-lg py-2 px-2 text-sm font-medium outline-none appearance-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}>
                                      {editingType === 'expense' ? (
                                        <>
                                          <option value="Cash">Cash</option>
                                          {bankAccounts.length > 0 ? (
                                            <>{bankAccounts.map(acc => <option key={acc.id} value={`Card:${acc.id}`}>Card: {acc.name}{acc.isDefault ? ' *' : ''}</option>)}</>
                                          ) : (
                                            <><option value="Card">Card</option><option value="Bank">Bank</option></>
                                          )}
                                        </>
                                      ) : (
                                        <>
                                          <option value="Cash">Cash</option>
                                          {bankAccounts.length > 0 ? bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}{acc.isDefault ? ' *' : ''}</option>) : <option value="Bank">Bank</option>}
                                        </>
                                      )}
                                    </select>
                                  </div>
                                </div>
                              )}
                              <div>
                                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Notes</label>
                                <textarea value={(editForm as any).notes || ''} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={2} className={`w-full rounded-lg py-2 px-3 text-sm font-medium outline-none resize-none ${isDark ? 'bg-zinc-800 text-white placeholder:text-zinc-600' : 'bg-white text-gray-900 border border-gray-200 placeholder:text-gray-400'}`} placeholder="Add notes..." />
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button onClick={saveEdit} className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>Save Changes</button>
                                <button onClick={cancelEdit} className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-600'}`}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <ICONS.Calendar className={`w-3.5 h-3.5 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
                                <span className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                                  {formatDateFull(transaction.date)}{transaction.time && ` at ${transaction.time}`}
                                </span>
                              </div>

                              {futureBalanceWarnings.has(transaction.id) && (() => {
                                const warning = futureBalanceWarnings.get(transaction.id)!;
                                return (
                                  <div className={`p-3 rounded-xl ${isDark ? 'bg-rose-950 border border-rose-900' : 'bg-rose-50 border border-rose-200'}`}>
                                    <div className="flex items-start gap-2">
                                      <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${isDark ? 'text-rose-400' : 'text-rose-500'}`} />
                                      <div>
                                        <p className={`text-xs font-semibold ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>Insufficient funds in {warning.accountName}</p>
                                        <p className={`text-xs mt-1 ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
                                          Shortfall of ¥{warning.shortfall.toLocaleString()} on {warning.date}. Projected: ¥{warning.projectedBalance.toLocaleString()}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}

                              {transaction.notes && (
                                <div className={`p-3 rounded-xl ${isDark ? 'bg-zinc-800' : 'bg-white border border-gray-200'}`}>
                                  <p className={`text-xs font-medium mb-1 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>Notes</p>
                                  <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{transaction.notes}</p>
                                </div>
                              )}

                              <div className="flex items-center gap-4 text-xs">
                                {transaction.type === 'expense' && (
                                  <span className={`font-medium ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                                    Source: {transaction.source === 'receipt' ? 'Receipt scan' : 'Manual entry'}
                                  </span>
                                )}
                                <span className={transaction.synced ? 'text-emerald-500' : 'text-amber-500'}>
                                  {transaction.synced ? 'Synced' : 'Pending sync'}
                                </span>
                              </div>

                              <div className="flex gap-2 pt-1">
                                {((transaction.type === 'expense' && onEditExpense) || (transaction.type === 'income' && onEditIncome) || (transaction.type === 'transfer' && onEditTransfer)) && (
                                  <button onClick={(e) => { e.stopPropagation(); startEdit(transaction); }} className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${isDark ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>
                                    <ICONS.Settings className="w-3.5 h-3.5" /> Edit
                                  </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(transaction); }} className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${isDark ? 'bg-rose-950 text-rose-500 hover:bg-rose-900' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}>
                                  <ICONS.AlertCircle className="w-3.5 h-3.5" /> Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center">
            <p className={`text-sm font-medium ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
              {searchQuery || typeFilter !== 'ALL' || transactionFilter !== 'ALL' ? 'No matching transactions.' : 'Ready for your first entry.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionList;
