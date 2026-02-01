
import React, { useState, useMemo } from 'react';
import { Expense, ExpenseType, PaymentMethod, CategoryDefinition, Income, IncomeCategory, IncomePaymentMethod, Transfer, TransferDirection } from '../types';
import { ICONS, DEFAULT_CATEGORIES, PAYMENT_METHODS, renderCategoryIcon, INCOME_CATEGORIES, INCOME_PAYMENT_METHODS, TRANSFER_DIRECTIONS } from '../constants';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react';

type GroupBy = 'day' | 'category' | 'none';
type TransactionFilter = 'ALL' | 'EXPENSES' | 'INCOME' | 'TRANSFERS';

// Unified transaction type for combined list
interface Transaction {
  id: string;
  type: 'expense' | 'income' | 'transfer';
  date: string;
  timestamp: string;
  amount: number;
  category: string;
  paymentMethod: string;
  description: string; // store for expenses, description for income/transfers
  notes: string;
  synced: boolean;
  expenseType?: ExpenseType; // Only for expenses
  source?: string; // Only for expenses
  transferDirection?: TransferDirection; // Only for transfers
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
  isDark?: boolean;
  limit?: number; // Optional limit for preview mode
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
  isDark = true,
  limit
}) => {
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ExpenseType | 'ALL'>('ALL');
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Expense> | Partial<Income> | Partial<Transfer>>({});
  const [editingType, setEditingType] = useState<'expense' | 'income' | 'transfer'>('expense');

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'NEED': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      case 'WANT': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'SAVE': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'DEBT': return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
      default: return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
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

    const transferTransactions: Transaction[] = transfers.map(t => ({
      id: t.id,
      type: 'transfer' as const,
      date: t.date,
      timestamp: t.timestamp,
      amount: t.amount,
      category: 'TRANSFER',
      paymentMethod: t.direction === 'BANK_TO_CASH' ? 'Bank → Cash' : 'Cash → Bank',
      description: t.description,
      notes: t.notes || '',
      synced: t.synced,
      transferDirection: t.direction
    }));

    return [...expenseTransactions, ...incomeTransactions, ...transferTransactions];
  }, [expenses, income, transfers]);

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let result = [...allTransactions];

    // Apply transaction type filter (expenses vs income vs transfers)
    if (transactionFilter === 'EXPENSES') {
      result = result.filter(t => t.type === 'expense');
    } else if (transactionFilter === 'INCOME') {
      result = result.filter(t => t.type === 'income');
    } else if (transactionFilter === 'TRANSFERS') {
      result = result.filter(t => t.type === 'transfer');
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.description.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        t.notes?.toLowerCase().includes(query)
      );
    }

    // Apply expense type filter (only for expenses)
    if (typeFilter !== 'ALL') {
      result = result.filter(t => t.type === 'income' || t.expenseType === typeFilter);
    }

    // Sort by date (newest first)
    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Apply limit if specified
    if (limit) {
      result = result.slice(0, limit);
    }

    return result;
  }, [allTransactions, searchQuery, typeFilter, transactionFilter, limit]);

  // Group transactions
  const groupedTransactions = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: 'All Transactions', transactions: filteredTransactions }];
    }

    const groups = new Map<string, Transaction[]>();

    filteredTransactions.forEach(transaction => {
      const key = groupBy === 'day' ? transaction.date : transaction.category;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(transaction);
    });

    return Array.from(groups.entries()).map(([key, txns]) => ({
      key,
      label: groupBy === 'day' ? formatDate(key) : key,
      transactions: txns
    }));
  }, [filteredTransactions, groupBy]);

  const getCategoryIcon = (categoryId: string, transactionType: 'expense' | 'income' | 'transfer') => {
    if (transactionType === 'transfer') {
      return <ArrowLeftRight className="w-4 h-4" />;
    }

    if (transactionType === 'income') {
      const incomeCat = INCOME_CATEGORIES.find(c => c.id === categoryId);
      if (incomeCat) {
        return incomeCat.icon;
      }
      return <ArrowUpRight className="w-4 h-4" />;
    }

    const cat = categories.find(c => c.id === categoryId);
    if (cat) {
      return renderCategoryIcon(cat.icon, 'w-4 h-4');
    }
    return <ICONS.AlertCircle className="w-4 h-4" />;
  };

  const getCategoryName = (categoryId: string, transactionType: 'expense' | 'income' | 'transfer') => {
    if (transactionType === 'transfer') {
      return 'Transfer';
    }
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
      if (expense) {
        setEditForm({
          amount: expense.amount,
          store: expense.store,
          category: expense.category,
          type: expense.type,
          date: expense.date,
          paymentMethod: expense.paymentMethod,
          notes: expense.notes
        });
      }
    } else if (transaction.type === 'income') {
      const inc = income.find(i => i.id === transaction.id);
      if (inc) {
        setEditForm({
          amount: inc.amount,
          description: inc.description,
          category: inc.category,
          date: inc.date,
          paymentMethod: inc.paymentMethod,
          notes: inc.notes
        });
      }
    } else if (transaction.type === 'transfer') {
      const transfer = transfers.find(t => t.id === transaction.id);
      if (transfer) {
        setEditForm({
          amount: transfer.amount,
          description: transfer.description,
          direction: transfer.direction,
          date: transfer.date,
          notes: transfer.notes
        });
      }
    }
  };

  const saveEdit = () => {
    if (!editingId) return;

    if (editingType === 'expense' && onEditExpense) {
      onEditExpense(editingId, editForm as Partial<Expense>);
    } else if (editingType === 'income' && onEditIncome) {
      onEditIncome(editingId, editForm as Partial<Income>);
    } else if (editingType === 'transfer' && onEditTransfer) {
      onEditTransfer(editingId, editForm as Partial<Transfer>);
    }

    setEditingId(null);
    setEditForm({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleDelete = (transaction: Transaction) => {
    if (transaction.type === 'expense') {
      onDeleteExpense(transaction.id);
    } else if (transaction.type === 'income' && onDeleteIncome) {
      onDeleteIncome(transaction.id);
    } else if (transaction.type === 'transfer' && onDeleteTransfer) {
      onDeleteTransfer(transaction.id);
    }
  };

  const totalFiltered = filteredTransactions.reduce((sum, t) => {
    return sum + (t.type === 'income' ? t.amount : -t.amount);
  }, 0);

  const expenseTotal = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const incomeTotal = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);

  // Compact mode for preview (no controls)
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
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                    transactionFilter === f
                      ? f === 'INCOME'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : f === 'EXPENSES'
                          ? isDark ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-500 text-white shadow-sm'
                          : f === 'TRANSFERS'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : isDark ? 'bg-zinc-700 text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm'
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
            </div>

            {/* Type Filter Chips (only show when viewing expenses or all) */}
            {transactionFilter !== 'INCOME' && (
              <div className="flex gap-2 flex-wrap">
                {(['ALL', 'NEED', 'WANT', 'SAVE', 'DEBT'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      typeFilter === t
                        ? t === 'ALL'
                          ? isDark ? 'bg-white text-black' : 'bg-gray-900 text-white'
                          : getTypeColor(t) + ' border'
                        : isDark ? 'bg-zinc-900 text-zinc-500 border border-zinc-800' : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            {/* Group By Controls */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className={`hidden sm:inline text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Group:</span>
                <div className={`flex p-0.5 rounded-lg ${isDark ? 'bg-zinc-900' : 'bg-gray-100'}`}>
                  {(['day', 'category', 'none'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGroupBy(g)}
                      className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                        groupBy === g
                          ? isDark ? 'bg-zinc-700 text-white' : 'bg-white text-gray-900 shadow-sm'
                          : isDark ? 'text-zinc-500' : 'text-gray-500'
                      }`}
                    >
                      {g === 'none' ? 'Flat' : g}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`text-[10px] font-bold whitespace-nowrap ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                {filteredTransactions.length} entries
                {transactionFilter === 'ALL' && income.length > 0 && (
                  <span className={totalFiltered >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                    {' '}• Net: {totalFiltered >= 0 ? '+' : ''}¥{totalFiltered.toLocaleString()}
                  </span>
                )}
                {transactionFilter === 'EXPENSES' && (
                  <span className="text-rose-400"> • ¥{expenseTotal.toLocaleString()}</span>
                )}
                {transactionFilter === 'INCOME' && (
                  <span className="text-emerald-400"> • ¥{incomeTotal.toLocaleString()}</span>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {isPreviewMode && (
        <div className="flex items-center justify-between px-1">
          <h3 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
            Recent
          </h3>
          <span className={`text-[10px] font-bold ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
            {filteredTransactions.length} entries
          </span>
        </div>
      )}

      {/* Transaction Groups */}
      <div className="space-y-6 pb-10">
        {groupedTransactions.length > 0 && groupedTransactions.some(g => g.transactions.length > 0) ? (
          groupedTransactions.filter(g => g.transactions.length > 0).map((group) => (
            <div key={group.key} className="space-y-2">
              {/* Group Header */}
              {(groupBy === 'day' || (!isPreviewMode && groupBy !== 'none')) && (
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                      {groupBy === 'category' ? group.label : group.label}
                    </h4>
                  </div>
                  <span className={`text-[10px] font-bold ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                    {(() => {
                      const groupNet = group.transactions.reduce((sum, t) =>
                        sum + (t.type === 'income' ? t.amount : -t.amount), 0);
                      return groupNet >= 0 ? `+¥${groupNet.toLocaleString()}` : `-¥${Math.abs(groupNet).toLocaleString()}`;
                    })()}
                  </span>
                </div>
              )}

              {/* Transactions */}
              <div className="space-y-2">
                {group.transactions.map((transaction) => {
                  const isExpanded = expandedId === transaction.id;
                  const isEditing = editingId === transaction.id;
                  const isIncome = transaction.type === 'income';
                  const isTransfer = transaction.type === 'transfer';

                  return (
                    <div
                      key={transaction.id}
                      className={`rounded-2xl overflow-hidden transition-all ${
                        isIncome
                          ? isDark ? 'bg-emerald-950/20 border border-emerald-900/30' : 'bg-emerald-50 border border-emerald-200'
                          : isTransfer
                            ? isDark ? 'bg-blue-950/20 border border-blue-900/30' : 'bg-blue-50 border border-blue-200'
                            : isDark ? 'bg-zinc-900/40 border border-zinc-800/40' : 'bg-white border border-gray-200'
                      }`}
                    >
                      {/* Main Row */}
                      <div
                        className={`p-4 flex items-center justify-between gap-3 cursor-pointer group ${
                          isIncome
                            ? isDark ? 'active:bg-emerald-900/30' : 'active:bg-emerald-100'
                            : isTransfer
                              ? isDark ? 'active:bg-blue-900/30' : 'active:bg-blue-100'
                              : isDark ? 'active:bg-zinc-800' : 'active:bg-gray-50'
                        }`}
                        onClick={() => !isEditing && setExpandedId(isExpanded ? null : transaction.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${
                            isIncome
                              ? isDark ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800/50' : 'bg-emerald-100 text-emerald-600 border border-emerald-200'
                              : isTransfer
                                ? isDark ? 'bg-blue-900/50 text-blue-400 border border-blue-800/50' : 'bg-blue-100 text-blue-600 border border-blue-200'
                                : isDark ? 'bg-zinc-800 text-zinc-400 border border-zinc-700/50' : 'bg-gray-100 text-gray-500 border border-gray-200'
                          }`}>
                            {getCategoryIcon(transaction.category, transaction.type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className={`font-bold leading-tight truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {transaction.description}
                              </p>
                              {isIncome ? (
                                <span className="shrink-0 text-[8px] font-black uppercase px-1.5 py-0.5 rounded border text-emerald-500 bg-emerald-500/10 border-emerald-500/20">
                                  INCOME
                                </span>
                              ) : isTransfer ? (
                                <span className="shrink-0 text-[8px] font-black uppercase px-1.5 py-0.5 rounded border text-blue-500 bg-blue-500/10 border-blue-500/20">
                                  {transaction.transferDirection === 'BANK_TO_CASH' ? 'ATM' : 'DEPOSIT'}
                                </span>
                              ) : transaction.expenseType && (
                                <span className={`shrink-0 text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${getTypeColor(transaction.expenseType)}`}>
                                  {transaction.expenseType}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 overflow-hidden">
                              {groupBy !== 'day' && (
                                <span className={`shrink-0 text-[10px] font-medium ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                                  {formatDate(transaction.date)}
                                </span>
                              )}
                              {groupBy !== 'category' && (
                                <span className={`truncate text-[10px] font-medium ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                                  {groupBy === 'day' ? getCategoryName(transaction.category, transaction.type) : `• ${getCategoryName(transaction.category, transaction.type)}`}
                                </span>
                              )}
                              <span className={`shrink-0 text-[10px] font-medium ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                                • {transaction.paymentMethod}
                              </span>
                              {transaction.notes && (
                                <span className={`shrink-0 text-[10px] ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>📝</span>
                              )}
                              {!transaction.synced && (
                                <ICONS.CloudOff className="shrink-0 w-3 h-3 text-amber-500" />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className={`font-bold tracking-tight text-base whitespace-nowrap ${
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
                          isIncome
                            ? isDark ? 'border-emerald-900/30 bg-emerald-950/30' : 'border-emerald-100 bg-emerald-50/50'
                            : isTransfer
                              ? isDark ? 'border-blue-900/30 bg-blue-950/30' : 'border-blue-100 bg-blue-50/50'
                              : isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-gray-100 bg-gray-50'
                        }`}>
                          {isEditing ? (
                            /* Edit Form */
                            <div className="p-4 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Amount</label>
                                  <input
                                    type="number"
                                    value={(editForm as any).amount || ''}
                                    onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })}
                                    className={`w-full rounded-lg py-2 px-3 text-sm font-bold outline-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                  />
                                </div>
                                <div>
                                  <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Date</label>
                                  <input
                                    type="date"
                                    value={(editForm as any).date || ''}
                                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                    className={`w-full rounded-lg py-2 px-3 text-sm font-medium outline-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                                  {editingType === 'expense' ? 'Store' : 'Description'}
                                </label>
                                <input
                                  type="text"
                                  value={editingType === 'expense' ? (editForm as Partial<Expense>).store || '' : (editForm as Partial<Income> | Partial<Transfer>).description || ''}
                                  onChange={(e) => setEditForm({
                                    ...editForm,
                                    [editingType === 'expense' ? 'store' : 'description']: e.target.value
                                  })}
                                  className={`w-full rounded-lg py-2 px-3 text-sm font-medium outline-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                />
                              </div>
                              {editingType === 'transfer' ? (
                                /* Transfer-specific fields */
                                <div>
                                  <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Direction</label>
                                  <select
                                    value={(editForm as Partial<Transfer>).direction || ''}
                                    onChange={(e) => setEditForm({ ...editForm, direction: e.target.value as TransferDirection })}
                                    className={`w-full rounded-lg py-2 px-2 text-sm font-medium outline-none appearance-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                  >
                                    {TRANSFER_DIRECTIONS.map(dir => (
                                      <option key={dir.id} value={dir.id}>{dir.name} ({dir.description})</option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                /* Expense/Income fields */
                                <div className={`grid ${editingType === 'expense' ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
                                  <div>
                                    <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Category</label>
                                    <select
                                      value={(editForm as any).category || ''}
                                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                      className={`w-full rounded-lg py-2 px-2 text-sm font-medium outline-none appearance-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                    >
                                      {editingType === 'expense' ? (
                                        categories.map(cat => (
                                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))
                                      ) : (
                                        INCOME_CATEGORIES.map(cat => (
                                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))
                                      )}
                                    </select>
                                  </div>
                                  {editingType === 'expense' && (
                                    <div>
                                      <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Type</label>
                                      <select
                                        value={(editForm as Partial<Expense>).type || ''}
                                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value as ExpenseType })}
                                        className={`w-full rounded-lg py-2 px-2 text-sm font-medium outline-none appearance-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                      >
                                        <option value="NEED">NEED</option>
                                        <option value="WANT">WANT</option>
                                        <option value="SAVE">SAVE</option>
                                        <option value="DEBT">DEBT</option>
                                      </select>
                                    </div>
                                  )}
                                  <div>
                                    <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Payment</label>
                                    <select
                                      value={(editForm as any).paymentMethod || ''}
                                      onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value as PaymentMethod })}
                                      className={`w-full rounded-lg py-2 px-2 text-sm font-medium outline-none appearance-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                    >
                                      {editingType === 'expense' ? (
                                        PAYMENT_METHODS.map(m => (
                                          <option key={m} value={m}>{m}</option>
                                        ))
                                      ) : (
                                        INCOME_PAYMENT_METHODS.map(m => (
                                          <option key={m} value={m}>{m}</option>
                                        ))
                                      )}
                                    </select>
                                  </div>
                                </div>
                              )}
                              <div>
                                <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Notes</label>
                                <textarea
                                  value={(editForm as any).notes || ''}
                                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                  rows={2}
                                  className={`w-full rounded-lg py-2 px-3 text-sm font-medium outline-none resize-none ${isDark ? 'bg-zinc-800 text-white placeholder:text-zinc-600' : 'bg-white text-gray-900 border border-gray-200 placeholder:text-gray-400'}`}
                                  placeholder="Add notes..."
                                />
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={saveEdit}
                                  className={`flex-1 py-2 rounded-lg text-xs font-bold ${isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                                >
                                  Save Changes
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className={`px-4 py-2 rounded-lg text-xs font-bold ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-600'}`}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* View Details */
                            <div className="p-4 space-y-3">
                              {/* Full Date */}
                              <div className="flex items-center gap-2">
                                <ICONS.Calendar className={`w-3.5 h-3.5 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
                                <span className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                                  {formatDateFull(transaction.date)}
                                </span>
                              </div>

                              {/* Notes */}
                              {transaction.notes && (
                                <div className={`p-3 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-white border border-gray-200'}`}>
                                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Notes</p>
                                  <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                                    {transaction.notes}
                                  </p>
                                </div>
                              )}

                              {/* Source & Sync Status */}
                              <div className="flex items-center gap-4 text-[10px]">
                                {transaction.type === 'expense' && (
                                  <span className={`font-medium ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                                    Source: {transaction.source === 'receipt' ? '📷 Receipt scan' : '✏️ Manual entry'}
                                  </span>
                                )}
                                <span className={transaction.synced ? 'text-emerald-500' : 'text-amber-500'}>
                                  {transaction.synced ? '✓ Synced' : '○ Pending sync'}
                                </span>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex gap-2 pt-1">
                                {((transaction.type === 'expense' && onEditExpense) || (transaction.type === 'income' && onEditIncome) || (transaction.type === 'transfer' && onEditTransfer)) && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); startEdit(transaction); }}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 ${isDark ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
                                  >
                                    <ICONS.Settings className="w-3.5 h-3.5" />
                                    Edit
                                  </button>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDelete(transaction); }}
                                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 ${isDark ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}
                                >
                                  <ICONS.AlertCircle className="w-3.5 h-3.5" />
                                  Delete
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
