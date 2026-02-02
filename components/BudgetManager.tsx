
import React, { useState, useRef, useMemo } from 'react';
import { ICONS, DEFAULT_CATEGORIES, AVAILABLE_ICONS, renderCategoryIcon } from '../constants';
import { AppConfig, Category, ExpenseType, CategoryDefinition, CategoryIcon } from '../types';

interface BudgetManagerProps {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
  isDark?: boolean;
}

type SortColumn = 'expense' | 'type' | 'budget';
type SortDirection = 'asc' | 'desc';

const BudgetManager: React.FC<BudgetManagerProps> = ({ config, onSave, isDark = true }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryDefinition | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState<CategoryIcon>('Home');
  const [newCategoryType, setNewCategoryType] = useState<ExpenseType>('NEED');
  const [sortColumn, setSortColumn] = useState<SortColumn>('expense');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const monthInputRef = useRef<HTMLInputElement>(null);

  const categories = config.categories || DEFAULT_CATEGORIES;

  // Filter categories based on search input (for duplicate detection while adding)
  const filteredCategories = useMemo(() => {
    if (!newCategoryName.trim()) return categories;
    const searchTerm = newCategoryName.toLowerCase().trim();
    return categories.filter(cat =>
      cat.name.toLowerCase().includes(searchTerm) ||
      cat.id.toLowerCase().includes(searchTerm)
    );
  }, [categories, newCategoryName]);

  const budget = config.budgets[selectedMonth] || {
    salary: 0,
    categories: categories.reduce((acc, cat) => {
      acc[cat.id] = { amount: 0, type: cat.defaultType };
      return acc;
    }, {} as Record<Category, { amount: number; type: ExpenseType }>)
  };

  // Sort categories for budget table
  const sortedCategories = useMemo(() => {
    const typeOrder: Record<ExpenseType, number> = { NEED: 0, WANT: 1, SAVE: 2, DEBT: 3 };

    return [...categories].sort((a, b) => {
      const aBudget = budget.categories[a.id] || { amount: 0, type: a.defaultType };
      const bBudget = budget.categories[b.id] || { amount: 0, type: b.defaultType };

      let comparison = 0;
      switch (sortColumn) {
        case 'expense':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          comparison = typeOrder[aBudget.type] - typeOrder[bBudget.type];
          break;
        case 'budget':
          comparison = aBudget.amount - bBudget.amount;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [categories, budget, sortColumn, sortDirection]);

  // Toggle sort column/direction
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const adjustMonth = (delta: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const handleSalaryChange = (val: string) => {
    const num = parseInt(val) || 0;
    const newConfig = {
      ...config,
      budgets: JSON.parse(JSON.stringify(config.budgets))
    };
    if (!newConfig.budgets[selectedMonth]) {
      newConfig.budgets[selectedMonth] = {
        salary: num,
        categories: JSON.parse(JSON.stringify(budget.categories))
      };
    } else {
      newConfig.budgets[selectedMonth].salary = num;
    }
    onSave(newConfig);
  };

  const handleCategoryAmountChange = (cat: Category, val: string) => {
    const num = parseInt(val) || 0;
    const newConfig = {
      ...config,
      budgets: JSON.parse(JSON.stringify(config.budgets))
    };
    if (!newConfig.budgets[selectedMonth]) {
      newConfig.budgets[selectedMonth] = {
        salary: budget.salary,
        categories: JSON.parse(JSON.stringify(budget.categories))
      };
    }
    // Ensure the category exists in the budget (for newly added categories)
    if (!newConfig.budgets[selectedMonth].categories[cat]) {
      const catDef = categories.find(c => c.id === cat);
      newConfig.budgets[selectedMonth].categories[cat] = {
        amount: 0,
        type: catDef?.defaultType || 'NEED'
      };
    }
    newConfig.budgets[selectedMonth].categories[cat].amount = num;
    onSave(newConfig);
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;

    const id = newCategoryName.toUpperCase().replace(/\s+/g, '_');
    if (categories.some(c => c.id === id)) {
      alert('A category with this name already exists');
      return;
    }

    const newCategory: CategoryDefinition = {
      id,
      name: newCategoryName.trim(),
      icon: newCategoryIcon,
      defaultType: newCategoryType
    };

    const newConfig = {
      ...config,
      categories: [...categories, newCategory]
    };
    onSave(newConfig);
    setNewCategoryName('');
    setNewCategoryIcon('Home');
    setNewCategoryType('NEED');
  };

  const handleEditCategory = (cat: CategoryDefinition) => {
    setEditingCategory(cat);
    setNewCategoryName(cat.name);
    setNewCategoryIcon(cat.icon);
    setNewCategoryType(cat.defaultType);
  };

  const handleSaveEdit = () => {
    if (!editingCategory || !newCategoryName.trim()) return;

    const updatedCategories = categories.map(c =>
      c.id === editingCategory.id
        ? { ...c, name: newCategoryName.trim(), icon: newCategoryIcon, defaultType: newCategoryType }
        : c
    );

    const newConfig = {
      ...config,
      categories: updatedCategories
    };
    onSave(newConfig);
    setEditingCategory(null);
    setNewCategoryName('');
    setNewCategoryIcon('Home');
    setNewCategoryType('NEED');
  };

  const handleDeleteCategory = (catId: string) => {
    if (!confirm('Delete this category? Existing expenses will keep their category but it won\'t appear in dropdowns.')) return;

    const newConfig = {
      ...config,
      categories: categories.filter(c => c.id !== catId)
    };
    onSave(newConfig);
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setNewCategoryName('');
    setNewCategoryIcon('Home');
    setNewCategoryType('NEED');
  };

  const totalBudgeted = Object.values(budget.categories).reduce<number>((sum, c) => sum + (c as { amount: number }).amount, 0);
  const leftToBudget = budget.salary - totalBudgeted;

  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(selectedMonth + '-01'));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 lg:grid lg:grid-cols-3 lg:gap-8 lg:items-start">
      {/* Left Column - Month & Salary (1 col on desktop) - Sticky on desktop */}
      <div className="space-y-6 mb-6 lg:mb-0 lg:sticky lg:top-8">
      {/* Month Selector Header */}
      <div className={`flex items-center justify-between rounded-2xl p-2 pr-4 shadow-sm ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-gray-200'}`}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => adjustMonth(-1)}
            className={`p-3 rounded-xl transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-900'}`}
          >
            <ICONS.ChevronLeft className="w-5 h-5" />
          </button>
          <div className="relative">
            <input
              ref={monthInputRef}
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
            />
            <button
              type="button"
              onClick={() => monthInputRef.current?.showPicker()}
              className={`px-4 py-2 rounded-xl border flex items-center gap-3 transition-colors cursor-pointer ${isDark ? 'bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
            >
              <ICONS.Calendar className={`w-4 h-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
              <span className={`text-sm font-bold tracking-tight ${isDark ? 'text-zinc-200' : 'text-gray-700'}`}>
                {monthName}
              </span>
            </button>
          </div>
          <button
            onClick={() => adjustMonth(1)}
            className={`p-3 rounded-xl transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-900'}`}
          >
            <ICONS.ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={() => setSelectedMonth(new Date().toISOString().slice(0, 7))}
          className={`text-[10px] font-black uppercase tracking-widest transition-colors px-3 py-2 ${isDark ? 'text-zinc-500 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}
        >
          Today
        </button>
      </div>

      {/* Salary & Summary Card */}
      <div className={`rounded-3xl p-6 shadow-2xl relative overflow-hidden group ${isDark ? 'bg-[#111] border border-zinc-800' : 'bg-white border border-gray-200'}`}>
        <div className={`absolute top-0 right-0 p-8 transition-opacity ${isDark ? 'opacity-[0.03] group-hover:opacity-[0.05]' : 'opacity-[0.02] group-hover:opacity-[0.04]'}`}>
          <ICONS.Table className="w-32 h-32" />
        </div>

        <div className="flex items-center gap-8 relative z-10">
          <div className="flex-1">
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-zinc-600' : 'bg-gray-400'}`} />
              Expected Salary
            </p>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>¥</span>
              <input
                type="number"
                value={budget.salary || ''}
                onChange={(e) => handleSalaryChange(e.target.value)}
                placeholder="0"
                className={`w-full bg-transparent border-none text-4xl font-bold focus:ring-0 p-0 tracking-tighter outline-none ${isDark ? 'text-white' : 'text-gray-900'}`}
              />
            </div>
          </div>
          <div className="text-right">
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Available</p>
            <p className={`text-2xl font-bold tracking-tight ${leftToBudget < 0 ? 'text-rose-500' : leftToBudget === 0 ? (isDark ? 'text-zinc-500' : 'text-gray-400') : 'text-emerald-500'}`}>
              ¥{leftToBudget.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
      </div>

      {/* Right Column - Budget Table (2 cols on desktop) */}
      <div className="lg:col-span-2 space-y-6">
      {/* Expenses Table */}
      <div className={`rounded-3xl overflow-hidden shadow-sm ${isDark ? 'bg-zinc-900/20 border border-zinc-800' : 'bg-white border border-gray-200'}`}>
        <div className={`p-5 border-b flex items-center justify-between ${isDark ? 'border-zinc-800 bg-zinc-900/40' : 'border-gray-200 bg-gray-50'}`}>
           <h3 className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Budget Allocation</h3>
           <div className="flex gap-1">
              <div className="w-1 h-1 rounded-full bg-rose-500" />
              <div className="w-1 h-1 rounded-full bg-blue-500" />
              <div className="w-1 h-1 rounded-full bg-amber-500" />
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`text-[9px] font-black uppercase tracking-[0.25em] border-b ${isDark ? 'text-zinc-600 border-zinc-800/50' : 'text-gray-400 border-gray-200'}`}>
                <th className="px-6 py-4">
                  <button
                    onClick={() => handleSort('expense')}
                    className={`flex items-center gap-1 transition-colors ${sortColumn === 'expense' ? (isDark ? 'text-white' : 'text-gray-900') : ''} hover:${isDark ? 'text-zinc-400' : 'text-gray-600'}`}
                  >
                    Expense
                    {sortColumn === 'expense' && (
                      <span className="text-[8px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button
                    onClick={() => handleSort('type')}
                    className={`flex items-center gap-1 transition-colors ${sortColumn === 'type' ? (isDark ? 'text-white' : 'text-gray-900') : ''} hover:${isDark ? 'text-zinc-400' : 'text-gray-600'}`}
                  >
                    Type
                    {sortColumn === 'type' && (
                      <span className="text-[8px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleSort('budget')}
                    className={`flex items-center gap-1 ml-auto transition-colors ${sortColumn === 'budget' ? (isDark ? 'text-white' : 'text-gray-900') : ''} hover:${isDark ? 'text-zinc-400' : 'text-gray-600'}`}
                  >
                    Budget
                    {sortColumn === 'budget' && (
                      <span className="text-[8px]">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-zinc-800/50' : 'divide-gray-100'}`}>
              {sortedCategories.map((cat) => {
                const catBudget = budget.categories[cat.id] || { amount: 0, type: cat.defaultType };
                const percentage = budget.salary > 0 ? ((catBudget.amount / budget.salary) * 100).toFixed(1) : '0';

                return (
                  <tr key={cat.id} className={`group transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-gray-50'}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {renderCategoryIcon(cat.icon, `w-4 h-4 ${catBudget.amount > 0 ? (isDark ? 'text-zinc-400' : 'text-gray-500') : (isDark ? 'text-zinc-700' : 'text-gray-300')}`)}
                        <p className={`text-xs font-bold tracking-wide ${catBudget.amount > 0 ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-zinc-600' : 'text-gray-400')}`}>
                          {cat.name}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[8px] font-black px-2 py-1 rounded-md tracking-tighter ${
                        catBudget.type === 'NEED' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                        catBudget.type === 'WANT' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                        catBudget.type === 'SAVE' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                        isDark ? 'bg-zinc-800 text-zinc-500 border border-zinc-700' : 'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}>
                        {catBudget.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <input
                          type="number"
                          value={catBudget.amount || ''}
                          onChange={(e) => handleCategoryAmountChange(cat.id, e.target.value)}
                          placeholder="0"
                          className={`w-24 bg-transparent border-none text-right font-bold text-sm focus:ring-0 p-0 outline-none ${isDark ? 'text-white' : 'text-gray-900'}`}
                        />
                        <span className={`text-[8px] font-bold mt-0.5 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>{percentage}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr className={`backdrop-blur-md ${isDark ? 'bg-zinc-900/60' : 'bg-gray-50'}`}>
                <td colSpan={2} className={`px-6 py-5 text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Total Planned</td>
                <td className="px-6 py-5 text-right">
                  <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>¥{totalBudgeted.toLocaleString()}</p>
                  <p className={`text-[8px] font-bold mt-0.5 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                    {budget.salary > 0 ? Math.round((totalBudgeted / budget.salary) * 100) : 0}% OF SALARY
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="pb-12 px-2 lg:pb-0 space-y-4">
        <div className={`flex items-start gap-3 p-4 rounded-2xl ${isDark ? 'bg-zinc-900/30 border border-zinc-800/50' : 'bg-gray-50 border border-gray-200'}`}>
          <ICONS.AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
          <p className={`text-[10px] leading-relaxed font-medium ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
            Setting your budget ahead of time helps you visualize your cash flow.
            The system uses the budget for {monthName} to calculate your progress in the Track tab.
          </p>
        </div>

        {/* Category Management */}
        <button
          onClick={() => setShowCategoryEditor(!showCategoryEditor)}
          className={`w-full text-left p-4 rounded-2xl transition-colors ${isDark ? 'bg-zinc-900/30 border border-zinc-800/50 hover:bg-zinc-900/50' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'}`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
              Manage Categories
            </span>
            <ICONS.ChevronRight className={`w-4 h-4 transition-transform ${showCategoryEditor ? 'rotate-90' : ''} ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
          </div>
        </button>

        {showCategoryEditor && (
          <div className={`rounded-2xl overflow-hidden ${isDark ? 'bg-zinc-900/40 border border-zinc-800' : 'bg-white border border-gray-200'}`}>
            {/* Add/Edit Category Form */}
            <div className={`p-4 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-[0.15em] mb-3 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                {editingCategory ? 'Edit Category' : 'Add New Category'}
              </p>
              <div className="space-y-3">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                  className={`w-full rounded-xl py-2.5 px-3 text-sm font-medium outline-none ${isDark ? 'bg-zinc-800 text-white placeholder:text-zinc-600' : 'bg-gray-100 text-gray-900 placeholder:text-gray-400'}`}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1.5 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Icon</label>
                    <select
                      value={newCategoryIcon}
                      onChange={(e) => setNewCategoryIcon(e.target.value as CategoryIcon)}
                      className={`w-full rounded-xl py-2.5 px-3 text-sm font-medium outline-none appearance-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-gray-100 text-gray-900'}`}
                    >
                      {AVAILABLE_ICONS.map(icon => (
                        <option key={icon} value={icon}>{icon}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-[9px] font-bold uppercase tracking-widest mb-1.5 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Type</label>
                    <select
                      value={newCategoryType}
                      onChange={(e) => setNewCategoryType(e.target.value as ExpenseType)}
                      className={`w-full rounded-xl py-2.5 px-3 text-sm font-medium outline-none appearance-none ${isDark ? 'bg-zinc-800 text-white' : 'bg-gray-100 text-gray-900'}`}
                    >
                      <option value="NEED">NEED</option>
                      <option value="WANT">WANT</option>
                      <option value="SAVE">SAVE</option>
                      <option value="DEBT">DEBT</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  {editingCategory ? (
                    <>
                      <button
                        onClick={handleSaveEdit}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold ${isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleAddCategory}
                      disabled={!newCategoryName.trim()}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-opacity ${!newCategoryName.trim() ? 'opacity-50 cursor-not-allowed' : ''} ${isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                    >
                      Add Category
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Category List - filtered when typing to detect duplicates */}
            <div className={`px-4 py-2 border-b flex items-center justify-between ${isDark ? 'border-zinc-800/50 bg-zinc-900/30' : 'border-gray-100 bg-gray-50'}`}>
              <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                {newCategoryName.trim()
                  ? `Matching: ${filteredCategories.length} of ${categories.length}`
                  : `All Categories (${categories.length})`
                }
              </span>
              {newCategoryName.trim() && filteredCategories.length > 0 && (
                <span className={`text-[9px] font-medium ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>
                  Similar exists!
                </span>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredCategories.length === 0 && newCategoryName.trim() ? (
                <div className={`px-4 py-6 text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                  <p className="text-xs font-medium">No matching categories</p>
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                    "{newCategoryName}" appears to be new
                  </p>
                </div>
              ) : (
                filteredCategories.map(cat => (
                  <div
                    key={cat.id}
                    className={`flex items-center justify-between px-4 py-3 border-b last:border-b-0 ${isDark ? 'border-zinc-800/50' : 'border-gray-100'}`}
                  >
                    <div className="flex items-center gap-3">
                      {renderCategoryIcon(cat.icon, `w-4 h-4 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`)}
                      <div>
                        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{cat.name}</p>
                        <p className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>{cat.defaultType}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditCategory(cat)}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-500 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-700'}`}
                      >
                        <ICONS.Settings className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-rose-500/10 text-zinc-500 hover:text-rose-500' : 'hover:bg-rose-50 text-gray-400 hover:text-rose-500'}`}
                      >
                        <ICONS.AlertCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default BudgetManager;
