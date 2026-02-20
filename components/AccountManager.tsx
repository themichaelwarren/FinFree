
import React, { useState } from 'react';
import { BankAccount } from '../types';
import { Plus, Trash2, Star, Pencil, Building2, Banknote, Check, X } from 'lucide-react';

interface AccountManagerProps {
  accounts: BankAccount[];
  onAddAccount: (account: Omit<BankAccount, 'id' | 'createdAt'>) => void;
  onUpdateAccount: (id: string, updates: Partial<BankAccount>) => void;
  onDeleteAccount: (id: string) => { success: boolean; error?: string };
  onSetDefault: (id: string) => void;
  isDark?: boolean;
}

const AccountManager: React.FC<AccountManagerProps> = ({
  accounts,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
  onSetDefault,
  isDark = true
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState('');
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newAccountName.trim()) return;

    onAddAccount({
      name: newAccountName.trim(),
      isDefault: accounts.length === 0
    });

    setNewAccountName('');
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    const result = onDeleteAccount(id);
    if (!result.success) {
      setError(result.error || 'Cannot delete account');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleStartEdit = (account: BankAccount) => {
    setEditingId(account.id);
    setEditName(account.name);
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      onUpdateAccount(id, { name: editName.trim() });
    }
    setEditingId(null);
    setEditName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  return (
    <div className={`rounded-xl p-4 ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-sm font-medium ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
          Bank Accounts
        </h2>
        <button
          onClick={() => setIsAdding(true)}
          className={`p-2 rounded-lg transition-colors ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-950 border border-rose-900 text-rose-500 text-sm">
          {error}
        </div>
      )}

      {/* Cash account (read-only) */}
      <div className={`p-4 rounded-xl mb-3 ${isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-50 border border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-emerald-900 text-emerald-400 border border-emerald-800' : 'bg-emerald-100 text-emerald-600 border border-emerald-200'}`}>
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Cash</p>
              <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Physical currency</p>
            </div>
          </div>
          <span className={`text-xs px-2 py-1 rounded ${isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-200 text-gray-500'}`}>
            Built-in
          </span>
        </div>
      </div>

      {/* Bank accounts */}
      {accounts.map(account => (
        <div
          key={account.id}
          className={`p-4 rounded-xl mb-3 ${isDark ? 'bg-zinc-800 border border-zinc-700' : 'bg-gray-50 border border-gray-200'}`}
        >
          {editingId === account.id ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit(account.id);
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-zinc-800 text-white border border-zinc-700' : 'bg-white text-gray-900 border border-gray-300'}`}
              />
              <button
                onClick={() => handleSaveEdit(account.id)}
                className={`p-2 rounded-lg ${isDark ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancelEdit}
                className={`p-2 rounded-lg ${isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400' : 'bg-gray-200 hover:bg-gray-300 text-gray-600'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-900 text-blue-400 border border-blue-800' : 'bg-blue-100 text-blue-600 border border-blue-200'}`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <p className={`font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {account.name}
                    {account.isDefault && (
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    )}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                    {account.isDefault ? 'Default for Card payments' : 'Bank account'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!account.isDefault && (
                  <button
                    onClick={() => onSetDefault(account.id)}
                    title="Set as default"
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-500 hover:text-amber-400' : 'hover:bg-gray-200 text-gray-400 hover:text-amber-500'}`}
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleStartEdit(account)}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-500 hover:text-white' : 'hover:bg-gray-200 text-gray-400 hover:text-gray-700'}`}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(account.id)}
                  className={`p-2 rounded-lg transition-colors text-rose-500 ${isDark ? 'hover:bg-rose-500/10' : 'hover:bg-rose-50'}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add new account form */}
      {isAdding && (
        <div className={`p-4 rounded-xl border-2 border-dashed ${isDark ? 'border-zinc-700' : 'border-gray-300'}`}>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="Account name (e.g., UFJ Checking)"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewAccountName('');
                }
              }}
              className={`flex-1 px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-zinc-800 text-white border border-zinc-700 placeholder:text-zinc-600' : 'bg-white text-gray-900 border border-gray-300 placeholder:text-gray-400'}`}
            />
            <button
              onClick={handleAdd}
              disabled={!newAccountName.trim()}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                newAccountName.trim()
                  ? isDark ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-900 text-white hover:bg-gray-800'
                  : isDark ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Add
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewAccountName('');
              }}
              className={`px-4 py-2 rounded-lg text-sm ${isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {accounts.length === 0 && !isAdding && (
        <p className={`text-sm text-center py-4 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
          No bank accounts yet. Add one to get started.
        </p>
      )}
    </div>
  );
};

export default AccountManager;
