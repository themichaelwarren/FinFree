
import React, { useState, useEffect, useCallback } from 'react';
import { Expense, AppConfig } from './types';
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

  const renderContent = () => {
    switch (activeTab) {
      case 'track':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <BudgetSummary expenses={expenses} config={config} />
            <ExpenseForm onSave={handleSaveExpense} apiKey={config.geminiKey} />
          </div>
        );
      case 'budget':
        return (
          <BudgetManager config={config} onSave={handleConfigUpdate} />
        );
      case 'history':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <TransactionList expenses={expenses} onDelete={handleDeleteExpense} />
          </div>
        );
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32 min-h-screen relative text-zinc-100">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">FinFree</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-rose-500'}`} />
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{isOnline ? 'Cloud Active' : 'Offline Mode'}</span>
            {isSyncing && <span className="text-[10px] text-zinc-400 animate-pulse ml-2 font-medium">Syncing...</span>}
          </div>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-400 hover:text-white transition-all active:scale-95 shadow-sm"
        >
          <ICONS.Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <main>
        {renderContent()}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm bg-black/60 backdrop-blur-2xl border border-zinc-800/50 rounded-[2.5rem] p-2 flex items-center justify-between shadow-2xl z-40">
        <button 
          onClick={() => setActiveTab('track')}
          className={`flex-1 py-3 px-4 rounded-[2rem] flex flex-col items-center gap-1 transition-all duration-300 ${
            activeTab === 'track' ? 'bg-white text-black' : 'text-zinc-500'
          }`}
        >
          <ICONS.Plus className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em]">Track</span>
        </button>
        <button 
          onClick={() => setActiveTab('budget')}
          className={`flex-1 py-3 px-4 rounded-[2rem] flex flex-col items-center gap-1 transition-all duration-300 ${
            activeTab === 'budget' ? 'bg-white text-black' : 'text-zinc-500'
          }`}
        >
          <ICONS.Table className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em]">Budget</span>
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 px-4 rounded-[2rem] flex flex-col items-center gap-1 transition-all duration-300 ${
            activeTab === 'history' ? 'bg-white text-black' : 'text-zinc-500'
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
        />
      )}

      {/* Initial Onboarding */}
      {!config.geminiKey && !showSettings && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-6 text-center">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-10 max-w-sm shadow-2xl">
            <div className="w-16 h-16 bg-white/5 rounded-[1.5rem] flex items-center justify-center mx-auto mb-8 border border-white/10">
              <ICONS.Settings className="w-8 h-8 text-zinc-300" />
            </div>
            <h2 className="text-2xl font-bold mb-3 tracking-tight">Setup FinFree</h2>
            <p className="text-zinc-500 text-sm mb-10 leading-relaxed">
              To enable Gemini OCR scanning and Google Sheets sync, please add your credentials in the settings.
            </p>
            <button 
              onClick={() => setShowSettings(true)}
              className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-zinc-200 transition-all shadow-lg active:scale-95"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
