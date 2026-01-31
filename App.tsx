
import React, { useState, useEffect, useCallback } from 'react';
import { Expense, AppConfig, AccountBalances, Theme, SyncMode } from './types';
import { storage } from './services/storage';
import { authService } from './services/auth';
import { sheetsApi } from './services/sheetsApi';
import { ICONS } from './constants';
import ExpenseForm from './components/ExpenseForm';
import BudgetSummary from './components/BudgetSummary';
import TransactionList from './components/TransactionList';
import Settings from './components/Settings';
import BudgetManager from './components/BudgetManager';
import Onboarding from './components/Onboarding';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Get current sync mode
const getSyncMode = (config: AppConfig): SyncMode => {
  const user = authService.getUser();
  if (user && config.spreadsheetId) return 'oauth';
  if (config.sheetsUrl && config.sheetsSecret) return 'appsscript';
  return 'local';
};

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [config, setConfig] = useState<AppConfig>(storage.getConfig());
  const [activeTab, setActiveTab] = useState<'track' | 'budget' | 'history'>('track');
  const [showSettings, setShowSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoading, setIsLoading] = useState(true);

  // Initial load: fetch from cloud and merge with local
  useEffect(() => {
    const initializeData = async () => {
      const localConfig = storage.getConfig();
      const localExpenses = storage.getExpenses();

      setConfig(localConfig);
      setExpenses(localExpenses);

      const syncMode = getSyncMode(localConfig);

      if (navigator.onLine && syncMode !== 'local') {
        setIsSyncing(true);

        try {
          if (syncMode === 'oauth' && user?.accessToken && localConfig.spreadsheetId) {
            // OAuth mode: fetch directly from Sheets API
            const data = await sheetsApi.fetchAll(user.accessToken, localConfig.spreadsheetId);
            const cloudData = {
              config: data.config as AppConfig | null,
              expenses: data.expenses,
              budgets: data.budgets
            };
            const merged = storage.mergeWithCloud(cloudData);
            storage.saveConfig(merged.config);
            storage.setExpenses(merged.expenses);
            setConfig(merged.config);
            setExpenses(merged.expenses);
          } else if (syncMode === 'appsscript' && localConfig.sheetsUrl && localConfig.sheetsSecret) {
            // Apps Script mode
            const cloudData = await storage.fetchFromCloud(localConfig.sheetsUrl, localConfig.sheetsSecret);
            if (cloudData) {
              const merged = storage.mergeWithCloud(cloudData);
              storage.saveConfig(merged.config);
              storage.setExpenses(merged.expenses);
              setConfig(merged.config);
              setExpenses(merged.expenses);
            }
          }
        } catch (error) {
          console.error('Cloud sync failed:', error);
        }

        setIsSyncing(false);
      }

      setIsLoading(false);
    };

    initializeData();

    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  const handleSync = useCallback(async () => {
    const syncMode = getSyncMode(config);
    if (!isOnline || syncMode === 'local' || isSyncing) return;

    setIsSyncing(true);
    const currentExpenses = storage.getExpenses();
    const unsynced = currentExpenses.filter(e => !e.synced);

    try {
      if (unsynced.length > 0) {
        if (syncMode === 'oauth' && user?.accessToken && config.spreadsheetId) {
          // OAuth mode: sync directly via Sheets API
          await sheetsApi.addExpenses(user.accessToken, config.spreadsheetId, unsynced);
          let updated = currentExpenses;
          unsynced.forEach(e => {
            updated = storage.updateExpense(e.id, { synced: true });
          });
          setExpenses(updated);
        } else if (syncMode === 'appsscript') {
          // Apps Script mode
          const syncedIds = await storage.syncToSheets(currentExpenses, config.sheetsUrl, config.sheetsSecret);
          if (syncedIds.length > 0) {
            let updated = currentExpenses;
            syncedIds.forEach(id => {
              updated = storage.updateExpense(id, { synced: true });
            });
            setExpenses(updated);
          }
        }
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }

    setIsSyncing(false);
  }, [config, user, isOnline, isSyncing]);

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

  const handleConfigUpdate = async (newConfig: AppConfig) => {
    const oldConfig = config;
    storage.saveConfig(newConfig);
    setConfig(newConfig);

    const syncMode = getSyncMode(newConfig);

    // Sync config to cloud
    if (isOnline && syncMode !== 'local') {
      try {
        if (syncMode === 'oauth' && user?.accessToken && newConfig.spreadsheetId) {
          // OAuth mode: sync directly via Sheets API
          await sheetsApi.saveConfig(user.accessToken, newConfig.spreadsheetId, {
            theme: newConfig.theme,
            balances: newConfig.balances
          });

          // If budgets changed, sync to dedicated Budgets sheet
          const budgetsChanged = JSON.stringify(newConfig.budgets) !== JSON.stringify(oldConfig.budgets);
          if (budgetsChanged) {
            await sheetsApi.saveBudgets(user.accessToken, newConfig.spreadsheetId, newConfig.budgets);
          }
        } else if (syncMode === 'appsscript') {
          // Apps Script mode
          storage.syncConfigToCloud(newConfig, newConfig.sheetsUrl, newConfig.sheetsSecret);

          // If budgets changed, sync to dedicated Budgets sheet
          if (JSON.stringify(newConfig.budgets) !== JSON.stringify(oldConfig.budgets)) {
            storage.syncBudgetsToCloud(newConfig.budgets, newConfig.sheetsUrl, newConfig.sheetsSecret);
          }
        }
      } catch (error) {
        console.error('Config sync failed:', error);
      }
    }
  };

  const handleBalanceUpdate = async (balances: AccountBalances) => {
    const newConfig = { ...config, balances };
    storage.saveConfig(newConfig);
    setConfig(newConfig);

    const syncMode = getSyncMode(newConfig);

    // Sync config to cloud
    if (isOnline && syncMode !== 'local') {
      try {
        if (syncMode === 'oauth' && user?.accessToken && newConfig.spreadsheetId) {
          await sheetsApi.saveConfig(user.accessToken, newConfig.spreadsheetId, { balances });
        } else if (syncMode === 'appsscript') {
          storage.syncConfigToCloud(newConfig, newConfig.sheetsUrl, newConfig.sheetsSecret);
        }
      } catch (error) {
        console.error('Balance sync failed:', error);
      }
    }
  };

  const toggleTheme = async () => {
    const newTheme: Theme = config.theme === 'dark' ? 'light' : 'dark';
    const newConfig = { ...config, theme: newTheme };
    storage.saveConfig(newConfig);
    setConfig(newConfig);

    const syncMode = getSyncMode(newConfig);

    // Sync theme preference to cloud
    if (isOnline && syncMode !== 'local') {
      try {
        if (syncMode === 'oauth' && user?.accessToken && newConfig.spreadsheetId) {
          await sheetsApi.saveConfig(user.accessToken, newConfig.spreadsheetId, { theme: newTheme });
        } else if (syncMode === 'appsscript') {
          storage.syncConfigToCloud(newConfig, newConfig.sheetsUrl, newConfig.sheetsSecret);
        }
      } catch (error) {
        console.error('Theme sync failed:', error);
      }
    }
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

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-black' : 'bg-gray-50'}`}>
        <div className="text-center">
          <div className={`w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-4 ${isDark ? 'border-zinc-700 border-t-white' : 'border-gray-200 border-t-gray-600'}`} />
          <p className={`text-sm font-medium ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Loading...</p>
        </div>
      </div>
    );
  }

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

    </div>
    </div>
  );
};

// Main App wrapper with AuthProvider
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
