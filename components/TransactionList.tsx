
import React, { useState, useMemo } from 'react';
import { Expense, ExpenseType, PaymentMethod, CategoryDefinition } from '../types';
import { ICONS, DEFAULT_CATEGORIES, PAYMENT_METHODS, renderCategoryIcon } from '../constants';

type GroupBy = 'day' | 'category' | 'none';

interface TransactionListProps {
  expenses: Expense[];
  onDelete: (id: string) => void;
  onEdit?: (id: string, updates: Partial<Expense>) => void;
  categories?: CategoryDefinition[];
  isDark?: boolean;
  limit?: number; // Optional limit for preview mode
}

const TransactionList: React.FC<TransactionListProps> = ({
  expenses,
  onDelete,
  onEdit,
  categories = DEFAULT_CATEGORIES,
  isDark = true,
  limit
}) => {
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ExpenseType | 'ALL'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Expense>>({});

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

  // Filter and sort expenses
  const filteredExpenses = useMemo(() => {
    let result = [...expenses];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.store.toLowerCase().includes(query) ||
        e.category.toLowerCase().includes(query) ||
        e.notes?.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (typeFilter !== 'ALL') {
      result = result.filter(e => e.type === typeFilter);
    }

    // Sort by date (newest first)
    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Apply limit if specified
    if (limit) {
      result = result.slice(0, limit);
    }

    return result;
  }, [expenses, searchQuery, typeFilter, limit]);

  // Group expenses
  const groupedExpenses = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', label: 'All Transactions', expenses: filteredExpenses }];
    }

    const groups = new Map<string, Expense[]>();

    filteredExpenses.forEach(expense => {
      const key = groupBy === 'day' ? expense.date : expense.category;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(expense);
    });

    return Array.from(groups.entries()).map(([key, exps]) => ({
      key,
      label: groupBy === 'day' ? formatDate(key) : key,
      expenses: exps
    }));
  }, [filteredExpenses, groupBy]);

  const getCategoryIcon = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    if (cat) {
      return renderCategoryIcon(cat.icon, 'w-4 h-4');
    }
    return <ICONS.AlertCircle className="w-4 h-4" />;
  };

  const getCategoryName = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || categoryId;
  };

  const startEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setEditForm({
      amount: expense.amount,
      store: expense.store,
      category: expense.category,
      type: expense.type,
      date: expense.date,
      paymentMethod: expense.paymentMethod,
      notes: expense.notes
    });
  };

  const saveEdit = () => {
    if (editingId && onEdit) {
      onEdit(editingId, editForm);
      setEditingId(null);
      setEditForm({});
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const totalFiltered = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Compact mode for preview (no controls)
  const isPreviewMode = limit !== undefined;

  return (
    <div className="space-y-4">
      {!isPreviewMode && (
        <>
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

            {/* Type Filter Chips */}
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
                {filteredExpenses.length} • ¥{totalFiltered.toLocaleString()}
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
            {filteredExpenses.length} entries
          </span>
        </div>
      )}

      {/* Transaction Groups */}
      <div className="space-y-6 pb-10">
        {groupedExpenses.length > 0 && groupedExpenses.some(g => g.expenses.length > 0) ? (
          groupedExpenses.filter(g => g.expenses.length > 0).map((group) => (
            <div key={group.key} className="space-y-2">
              {/* Group Header - shown in both full and preview modes when grouped by day */}
              {(groupBy === 'day' || (!isPreviewMode && groupBy !== 'none')) && (
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    {groupBy === 'category' && getCategoryIcon(group.key)}
                    <h4 className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                      {groupBy === 'category' ? getCategoryName(group.key) : group.label}
                    </h4>
                  </div>
                  <span className={`text-[10px] font-bold ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                    ¥{group.expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                  </span>
                </div>
              )}

              {/* Transactions */}
              <div className="space-y-2">
                {group.expenses.map((expense) => {
                  const isExpanded = expandedId === expense.id;
                  const isEditing = editingId === expense.id;

                  return (
                    <div
                      key={expense.id}
                      className={`rounded-2xl overflow-hidden transition-all ${isDark ? 'bg-zinc-900/40 border border-zinc-800/40' : 'bg-white border border-gray-200'}`}
                    >
                      {/* Main Row */}
                      <div
                        className={`p-4 flex items-center justify-between gap-3 cursor-pointer group ${isDark ? 'active:bg-zinc-800' : 'active:bg-gray-50'}`}
                        onClick={() => !isEditing && setExpandedId(isExpanded ? null : expense.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${isDark ? 'bg-zinc-800 text-zinc-400 border border-zinc-700/50' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                            {getCategoryIcon(expense.category)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className={`font-bold leading-tight truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {expense.store}
                              </p>
                              <span className={`shrink-0 text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${getTypeColor(expense.type)}`}>
                                {expense.type}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 overflow-hidden">
                              {groupBy !== 'day' && (
                                <span className={`shrink-0 text-[10px] font-medium ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                                  {formatDate(expense.date)}
                                </span>
                              )}
                              {groupBy !== 'category' && (
                                <span className={`truncate text-[10px] font-medium ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                                  {groupBy === 'day' ? getCategoryName(expense.category) : `• ${getCategoryName(expense.category)}`}
                                </span>
                              )}
                              <span className={`shrink-0 text-[10px] font-medium ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                                • {expense.paymentMethod}
                              </span>
                              {expense.notes && (
                                <span className={`shrink-0 text-[10px] ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>📝</span>
                              )}
                              {!expense.synced && (
                                <ICONS.CloudOff className="shrink-0 w-3 h-3 text-amber-500" />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className={`font-bold tracking-tight text-base whitespace-nowrap ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            ¥{expense.amount.toLocaleString()}
                          </p>
                          <ICONS.ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''} ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
                        </div>
                      </div>

                      {/* Expanded Details / Edit Form */}
                      {isExpanded && (
                        <div className={`border-t ${isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-gray-100 bg-gray-50'}`}>
                          {isEditing ? (
                            /* Edit Form */
                            <div className="p-4 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Amount</label>
                                  <input
                                    type="number"
                                    value={editForm.amount || ''}
                                    onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })}
                                    className={`w-full rounded-lg py-2 px-3 text-sm font-bold outline-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                  />
                                </div>
                                <div>
                                  <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Date</label>
                                  <input
                                    type="date"
                                    value={editForm.date || ''}
                                    onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                    className={`w-full rounded-lg py-2 px-3 text-sm font-medium outline-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                  />
                                </div>
                              </div>
                              <div>
                                <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Store</label>
                                <input
                                  type="text"
                                  value={editForm.store || ''}
                                  onChange={(e) => setEditForm({ ...editForm, store: e.target.value })}
                                  className={`w-full rounded-lg py-2 px-3 text-sm font-medium outline-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                />
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Category</label>
                                  <select
                                    value={editForm.category || ''}
                                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                    className={`w-full rounded-lg py-2 px-2 text-sm font-medium outline-none appearance-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                  >
                                    {categories.map(cat => (
                                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Type</label>
                                  <select
                                    value={editForm.type || ''}
                                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value as ExpenseType })}
                                    className={`w-full rounded-lg py-2 px-2 text-sm font-medium outline-none appearance-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                  >
                                    <option value="NEED">NEED</option>
                                    <option value="WANT">WANT</option>
                                    <option value="SAVE">SAVE</option>
                                    <option value="DEBT">DEBT</option>
                                  </select>
                                </div>
                                <div>
                                  <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Payment</label>
                                  <select
                                    value={editForm.paymentMethod || ''}
                                    onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value as PaymentMethod })}
                                    className={`w-full rounded-lg py-2 px-2 text-sm font-medium outline-none appearance-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}
                                  >
                                    {PAYMENT_METHODS.map(m => (
                                      <option key={m} value={m}>{m}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Notes</label>
                                <textarea
                                  value={editForm.notes || ''}
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
                                  {formatDateFull(expense.date)}
                                </span>
                              </div>

                              {/* Notes */}
                              {expense.notes && (
                                <div className={`p-3 rounded-xl ${isDark ? 'bg-zinc-800/50' : 'bg-white border border-gray-200'}`}>
                                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Notes</p>
                                  <p className={`text-sm whitespace-pre-wrap ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                                    {expense.notes}
                                  </p>
                                </div>
                              )}

                              {/* Source & Sync Status */}
                              <div className="flex items-center gap-4 text-[10px]">
                                <span className={`font-medium ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                                  Source: {expense.source === 'receipt' ? '📷 Receipt scan' : '✏️ Manual entry'}
                                </span>
                                <span className={expense.synced ? 'text-emerald-500' : 'text-amber-500'}>
                                  {expense.synced ? '✓ Synced' : '○ Pending sync'}
                                </span>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex gap-2 pt-1">
                                {onEdit && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); startEdit(expense); }}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 ${isDark ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
                                  >
                                    <ICONS.Settings className="w-3.5 h-3.5" />
                                    Edit
                                  </button>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); onDelete(expense.id); }}
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
              {searchQuery || typeFilter !== 'ALL' ? 'No matching transactions.' : 'Ready for your first entry.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionList;
