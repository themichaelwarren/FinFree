
import React from 'react';
import { Expense } from '../types';
import { CATEGORY_ICONS, ICONS } from '../constants';

interface TransactionListProps {
  expenses: Expense[];
  onDelete: (id: string) => void;
  isDark?: boolean;
}

const TransactionList: React.FC<TransactionListProps> = ({ expenses, onDelete, isDark = true }) => {
  const sortedExpenses = [...expenses].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  ).slice(0, 30);

  /* Corrected case labels to match uppercase ExpenseType definitions ('NEED', 'WANT', 'SAVE') */
  const getTypeColor = (type: string) => {
    switch(type) {
      case 'NEED': return 'text-emerald-500 bg-emerald-500/10';
      case 'WANT': return 'text-blue-500 bg-blue-500/10';
      case 'SAVE': return 'text-amber-500 bg-amber-500/10';
      default: return 'text-zinc-500 bg-zinc-500/10';
    }
  };

  return (
    <div className="space-y-4">
      <h3 className={`text-[10px] font-bold uppercase tracking-[0.2em] px-1 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Transactions</h3>
      <div className="space-y-2 pb-10">
        {sortedExpenses.length > 0 ? (
          sortedExpenses.map((expense) => (
            <div
              key={expense.id}
              className={`rounded-2xl p-4 flex items-center justify-between group transition-all ${isDark ? 'bg-zinc-900/40 border border-zinc-800/40 active:bg-zinc-800' : 'bg-white border border-gray-200 active:bg-gray-50'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-zinc-800 text-zinc-400 border border-zinc-700/50' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                  {CATEGORY_ICONS[expense.category]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{expense.store}</p>
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${getTypeColor(expense.type)}`}>
                      {expense.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-medium ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{expense.date}</span>
                    <span className={`text-[10px] font-medium ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>• {expense.category}</span>
                    <span className={`text-[10px] font-medium ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>• {expense.paymentMethod}</span>
                    {!expense.synced && (
                      <ICONS.CloudOff className="w-3 h-3 text-amber-500" />
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className={`font-bold tracking-tight text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>¥{expense.amount.toLocaleString()}</p>
                <button
                  onClick={() => onDelete(expense.id)}
                  className={`opacity-0 group-hover:opacity-100 p-2 hover:text-rose-500 transition-all active:scale-90 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}
                >
                  <ICONS.AlertCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center">
            <p className={`text-sm font-medium ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>Ready for your first entry.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionList;
