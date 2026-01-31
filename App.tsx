
import React, { useState, useEffect, useCallback } from 'react';
import { Expense, AppConfig, AccountBalances, Theme } from './types';
import { storage } from './services/storage';
import { ICONS } from './constants';
import ExpenseForm from './components/ExpenseForm';
import BudgetSummary from './components/BudgetSummary';
import TransactionList from './components/TransactionList';
import Settings from './components/Settings';
import BudgetManager from './components/BudgetManager';

const App: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [config, setConfig] = useState<AppConfig>(storage.getConfig());
  const [activeTab, setActiveTab] = useState<'track' | 'budget' | 'history'>('track');
  const [showSettings, setShowSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    setExpenses(storage.getExpenses());
    
    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  const handleSync = useCallback(async () => {
    if (!isOnline || !config.sheetsUrl || isSyncing) return;
    
    setIsSyncing(true);
    const currentExpenses = storage.getExpenses();
    const unsynced = currentExpenses.filter(e => !e.synced);
    
    if (unsynced.length > 0) {
      const syncedIds = await storage.syncToSheets(currentExpenses, config.sheetsUrl);
      if (syncedIds.length > 0) {
        let updated = currentExpenses;
        syncedIds.forEach(id => {
          updated = storage.updateExpense(id, { synced: true });
        });
        setExpenses(updated);
      }
    }
    setIsSyncing(false);
  }, [config.sheetsUrl, isOnline, isSyncing]);

  useEffect(() => {
    if (isOnline) {
      handleSync();
    }
  }, [isOnline, handleSync]);

  const handleSaveExpense = (newExpenseData: Omit<Expense, 'id' | 'timestamp' | 'synced'>) => {
    const newExpense: Expense = {
      ...newExpenseData,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      synced: false
    };

    const updated = storage.saveExpense(newExpense);
    setExpenses(updated);
    
    if (isOnline) {
      handleSync();
    }
  };

  const handleDeleteExpense = (id: string) => {
    if (confirm('Delete this transaction?')) {
      const updated = storage.deleteExpense(id);
      setExpenses(updated);
    }
  };

  const handleConfigUpdate = (newConfig: AppConfig) => {
    storage.saveConfig(newConfig);
    setConfig(newConfig);
  };

  const handleBalanceUpdate = (balances: AccountBalances) => {
    const newConfig = { ...config, balances };
    storage.saveConfig(newConfig);
    setConfig(newConfig);
  };

  const toggleTheme = () => {
    const newTheme: Theme = config.theme === 'dark' ? 'light' : 'dark';
    const newConfig = { ...config, theme: newTheme };
    storage.saveConfig(newConfig);
    setConfig(newConfig);
  };

  const isDark = config.theme === 'dark';

  const renderContent = () => {
    switch (activeTab) {
      case 'track':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 lg:grid lg:grid-cols-2 lg:gap-8">
            <div>
              <BudgetSummary expenses={expenses} config={config} onUpdateBalances={handleBalanceUpdate} isDark={isDark} />
            </div>
            <div>
              <ExpenseForm onSave={handleSaveExpense} apiKey={config.geminiKey} isDark={isDark} />
              <div className="hidden lg:block mt-6">
                <h3 className={`text-[10px] font-bold uppercase tracking-[0.2em] px-1 mb-4 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Recent</h3>
                <TransactionList expenses={expenses.slice(0, 5)} onDelete={handleDeleteExpense} isDark={isDark} />
              </div>
            </div>
          </div>
        );
      case 'budget':
        return (
          <BudgetManager config={config} onSave={handleConfigUpdate} isDark={isDark} />
        );
      case 'history':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <TransactionList expenses={expenses} onDelete={handleDeleteExpense} isDark={isDark} />
          </div>
        );
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-black' : 'bg-gray-50'}`}>
    <div className={`max-w-md lg:max-w-5xl mx-auto px-4 lg:px-8 pt-8 pb-32 min-h-screen relative ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>FinFree</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-rose-500'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{isOnline ? 'Cloud Active' : 'Offline Mode'}</span>
            {isSyncing && <span className={`text-[10px] animate-pulse ml-2 font-medium ${isDark ? 'text-zinc-400' : 'text-gray-400'}`}>Syncing...</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className={`p-3 rounded-2xl transition-all active:scale-95 shadow-sm ${isDark ? 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white' : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-900'}`}
          >
            {isDark ? <ICONS.Sun className="w-5 h-5" /> : <ICONS.Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className={`p-3 rounded-2xl transition-all active:scale-95 shadow-sm ${isDark ? 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white' : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-900'}`}
          >
            <ICONS.Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main>
        {renderContent()}
      </main>

      {/* Navigation */}
      <nav className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm lg:max-w-md backdrop-blur-2xl rounded-[2.5rem] p-2 flex items-center justify-between shadow-2xl z-40 ${isDark ? 'bg-black/60 border border-zinc-800/50' : 'bg-white/80 border border-gray-200'}`}>
        <button
          onClick={() => setActiveTab('track')}
          className={`flex-1 py-3 px-4 rounded-[2rem] flex flex-col items-center gap-1 transition-all duration-300 ${
            activeTab === 'track' ? (isDark ? 'bg-white text-black' : 'bg-gray-900 text-white') : (isDark ? 'text-zinc-500' : 'text-gray-400')
          }`}
        >
          <ICONS.Plus className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em]">Track</span>
        </button>
        <button
          onClick={() => setActiveTab('budget')}
          className={`flex-1 py-3 px-4 rounded-[2rem] flex flex-col items-center gap-1 transition-all duration-300 ${
            activeTab === 'budget' ? (isDark ? 'bg-white text-black' : 'bg-gray-900 text-white') : (isDark ? 'text-zinc-500' : 'text-gray-400')
          }`}
        >
          <ICONS.Table className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em]">Budget</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 px-4 rounded-[2rem] flex flex-col items-center gap-1 transition-all duration-300 ${
            activeTab === 'history' ? (isDark ? 'bg-white text-black' : 'bg-gray-900 text-white') : (isDark ? 'text-zinc-500' : 'text-gray-400')
          }`}
        >
          <ICONS.History className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em]">History</span>
        </button>
      </nav>

      {showSettings && (
        <Settings
          config={config}
          onSave={handleConfigUpdate}
          onClose={() => setShowSettings(false)}
          isDark={isDark}
        />
      )}

      {/* Initial Onboarding */}
      {!config.geminiKey && !showSettings && (
        <div className={`fixed inset-0 backdrop-blur-md z-[60] flex items-center justify-center p-6 text-center ${isDark ? 'bg-black/90' : 'bg-white/90'}`}>
          <div className={`rounded-[2rem] p-10 max-w-sm shadow-2xl ${isDark ? 'bg-zinc-900/50 border border-zinc-800' : 'bg-white border border-gray-200'}`}>
            <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-100 border border-gray-200'}`}>
              <ICONS.Settings className={`w-8 h-8 ${isDark ? 'text-zinc-300' : 'text-gray-600'}`} />
            </div>
            <h2 className={`text-2xl font-bold mb-3 tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>Setup FinFree</h2>
            <p className={`text-sm mb-10 leading-relaxed ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
              To enable Gemini OCR scanning and Google Sheets sync, please add your credentials in the settings.
            </p>
            <button
              onClick={() => setShowSettings(true)}
              className={`w-full font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-95 ${isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default App;
