
import React, { useState, useEffect, useCallback } from 'react';
import { Expense, AppConfig, AccountBalances, Theme, SyncMode } from './types';
import { storage } from './services/storage';
import { authService } from './services/auth';
import { sheetsApi } from './services/sheetsApi';
import { ICONS } from './constants';
import BudgetSummary from './components/BudgetSummary';
import TransactionList from './components/TransactionList';
import Settings from './components/Settings';
import BudgetManager from './components/BudgetManager';
import ExpenseFormModal from './components/ExpenseFormModal';
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
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoading, setIsLoading] = useState(true);

  // Initial load: load local data and set up event listeners
  useEffect(() => {
    const localConfig = storage.getConfig();
    const localExpenses = storage.getExpenses();
    setConfig(localConfig);
    setExpenses(localExpenses);
    setIsLoading(false);

    const handleStatusChange = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // Fetch from cloud when user becomes available or on reload
  useEffect(() => {
    const fetchFromCloud = async () => {
      const localConfig = storage.getConfig();
      const syncMode = getSyncMode(localConfig);

      // Don't check isSyncing here - fetching (pull) should not be blocked by syncing (push)
      if (!navigator.onLine || syncMode === 'local') return;
      if (!user?.accessToken) return;  // Wait for user to be available

      setIsSyncing(true);

      try {
        if (syncMode === 'oauth' && localConfig.spreadsheetId) {
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

        // After fetching, also push any unsynced local expenses to cloud
        const localExpenses = storage.getExpenses();
        const unsynced = localExpenses.filter(e => !e.synced);
        if (unsynced.length > 0 && syncMode === 'oauth' && localConfig.spreadsheetId) {
          await sheetsApi.addExpenses(user.accessToken, localConfig.spreadsheetId, unsynced);
          let updated = localExpenses;
          unsynced.forEach(e => {
            updated = storage.updateExpense(e.id, { synced: true });
          });
          setExpenses(updated);
        }
      } catch (error) {
        console.error('Cloud sync failed:', error);
      }

      setIsSyncing(false);
    };

    fetchFromCloud();
  }, [user?.accessToken]);

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

  const handleUpdateExpense = (id: string, updates: Partial<Expense>) => {
    // Mark as unsynced when edited so it re-syncs
    const updated = storage.updateExpense(id, { ...updates, synced: false });
    setExpenses(updated);

    // Trigger sync
    if (isOnline) {
      handleSync();
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
              <TransactionList expenses={expenses} onDelete={handleDeleteExpense} isDark={isDark} categories={config.categories} limit={8} />
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
            <TransactionList expenses={expenses} onDelete={handleDeleteExpense} onEdit={handleUpdateExpense} categories={config.categories} isDark={isDark} />
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
    <div className={`max-w-md lg:max-w-5xl mx-auto px-4 lg:px-8 pt-6 lg:pt-8 pb-24 lg:pb-12 min-h-screen relative ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6 lg:mb-8">
        <div className="flex items-center gap-6 lg:gap-10">
          <div>
            <h1 className={`text-xl lg:text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>FinFree</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {(() => {
                const syncMode = getSyncMode(config);
                if (!isOnline) {
                  return (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Offline</span>
                    </>
                  );
                }
                if (syncMode === 'local') {
                  return (
                    <>
                      <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-zinc-500' : 'bg-gray-400'}`} />
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Local</span>
                    </>
                  );
                }
                return (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Synced</span>
                  </>
                );
              })()}
              {isSyncing && <span className={`text-[9px] animate-pulse ml-1 font-medium ${isDark ? 'text-zinc-400' : 'text-gray-400'}`}>...</span>}
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className={`hidden lg:flex items-center p-1 rounded-xl ${isDark ? 'bg-zinc-900/50' : 'bg-gray-100'}`}>
            {([
              { id: 'track', label: 'Overview', icon: ICONS.LayoutGrid },
              { id: 'budget', label: 'Budget', icon: ICONS.Table },
              { id: 'history', label: 'History', icon: ICONS.History }
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-semibold transition-all ${
                  activeTab === id
                    ? isDark ? 'bg-zinc-800 text-white' : 'bg-white text-gray-900 shadow-sm'
                    : isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Desktop Add Button */}
          <button
            onClick={() => setShowExpenseModal(true)}
            className={`hidden lg:flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 ${isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
          >
            <ICONS.Plus className="w-4 h-4" />
            Add Expense
          </button>
          <button
            onClick={toggleTheme}
            className={`p-2.5 lg:p-2 rounded-xl transition-all active:scale-95 ${isDark ? 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white' : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-900'}`}
          >
            {isDark ? <ICONS.Sun className="w-5 h-5 lg:w-4 lg:h-4" /> : <ICONS.Moon className="w-5 h-5 lg:w-4 lg:h-4" />}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className={`p-2.5 lg:p-2 rounded-xl transition-all active:scale-95 ${isDark ? 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white' : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-900'}`}
          >
            <ICONS.Settings className="w-5 h-5 lg:w-4 lg:h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main>
        {renderContent()}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className={`lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 backdrop-blur-2xl rounded-2xl p-1.5 flex items-center gap-1 shadow-2xl z-40 ${isDark ? 'bg-black/70 border border-zinc-800/50' : 'bg-white/90 border border-gray-200'}`}>
        {([
          { id: 'track', icon: ICONS.LayoutGrid },
          { id: 'budget', icon: ICONS.Table },
          { id: 'history', icon: ICONS.History }
        ] as const).map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`p-3 rounded-xl transition-all duration-200 ${
              activeTab === id
                ? isDark ? 'bg-white text-black' : 'bg-gray-900 text-white'
                : isDark ? 'text-zinc-500' : 'text-gray-400'
            }`}
          >
            <Icon className="w-5 h-5" />
          </button>
        ))}
      </nav>

      {/* Mobile FAB */}
      <button
        onClick={() => setShowExpenseModal(true)}
        className={`lg:hidden fixed bottom-20 right-4 w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl z-40 transition-all active:scale-95 ${isDark ? 'bg-white text-black' : 'bg-gray-900 text-white'}`}
      >
        <ICONS.Plus className="w-6 h-6" />
      </button>

      {/* Expense Form Modal */}
      <ExpenseFormModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onSave={handleSaveExpense}
        apiKey={config.geminiKey}
        isDark={isDark}
        categories={config.categories}
      />

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
