
import React, { useState, useEffect, useCallback } from 'react';
import { Expense, AppConfig, AccountBalances, Theme, SyncMode, Income, StartingBalance, Transfer, BankAccount } from './types';
import { storage } from './services/storage';
import { authService } from './services/auth';
import { sheetsApi } from './services/sheetsApi';
import { ICONS } from './constants';
import BudgetSummary from './components/BudgetSummary';
import TransactionList from './components/TransactionList';
import Settings from './components/Settings';
import BudgetManager from './components/BudgetManager';
import ExpenseFormModal from './components/ExpenseFormModal';
import HelpModal from './components/HelpModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { HelpCircle } from 'lucide-react';

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
  const [income, setIncome] = useState<Income[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [config, setConfig] = useState<AppConfig>(storage.getConfig());
  const [activeTab, setActiveTab] = useState<'track' | 'budget' | 'history'>('track');
  const [showSettings, setShowSettings] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isLoading, setIsLoading] = useState(true);

  // Initial load: load local data and set up event listeners
  useEffect(() => {
    // Run migrations
    storage.migrateToMultiAccount();
    storage.migrateCategories();

    const localConfig = storage.getConfig();
    const localExpenses = storage.getExpenses();
    const localIncome = storage.getIncome();
    const localTransfers = storage.getTransfers();
    const localAccounts = storage.getAccounts();
    setConfig(localConfig);
    setExpenses(localExpenses);
    setIncome(localIncome);
    setTransfers(localTransfers);
    setAccounts(localAccounts);
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
          // Prefer categories from dedicated sheet, fall back to legacy JSON in config
          const categoriesFromCloud = data.categories || data.config?.categories || null;
          const cloudData = {
            config: { ...data.config, categories: categoriesFromCloud } as AppConfig | null,
            expenses: data.expenses,
            budgets: data.budgets,
            income: data.income,
            transfers: data.transfers || [],
            accounts: data.accounts || undefined
          };
          const merged = storage.mergeWithCloud(cloudData);
          storage.saveConfig(merged.config);
          storage.setExpenses(merged.expenses);
          storage.setIncome(merged.income);
          storage.setTransfers(merged.transfers);
          storage.setAccounts(merged.accounts);
          setConfig(merged.config);
          setExpenses(merged.expenses);
          setIncome(merged.income);
          setTransfers(merged.transfers);
          setAccounts(merged.accounts);
        } else if (syncMode === 'appsscript' && localConfig.sheetsUrl && localConfig.sheetsSecret) {
          // Apps Script mode
          const cloudData = await storage.fetchFromCloud(localConfig.sheetsUrl, localConfig.sheetsSecret);
          if (cloudData) {
            const merged = storage.mergeWithCloud(cloudData);
            storage.saveConfig(merged.config);
            storage.setExpenses(merged.expenses);
            storage.setIncome(merged.income);
            storage.setAccounts(merged.accounts);
            setConfig(merged.config);
            setExpenses(merged.expenses);
            setIncome(merged.income);
            setAccounts(merged.accounts);
          }
        }

        // After fetching, also push any unsynced local data to cloud
        const localExpenses = storage.getExpenses();
        const unsyncedExpenses = localExpenses.filter(e => !e.synced);
        const localIncome = storage.getIncome();
        const unsyncedIncome = localIncome.filter(i => !i.synced);

        if (syncMode === 'oauth' && localConfig.spreadsheetId) {
          // Sync unsynced expenses
          if (unsyncedExpenses.length > 0) {
            await sheetsApi.addExpenses(user.accessToken, localConfig.spreadsheetId, unsyncedExpenses);
            let updated = localExpenses;
            unsyncedExpenses.forEach(e => {
              updated = storage.updateExpense(e.id, { synced: true });
            });
            setExpenses(updated);
          }

          // Sync unsynced income
          if (unsyncedIncome.length > 0) {
            await sheetsApi.addIncome(user.accessToken, localConfig.spreadsheetId, unsyncedIncome);
            let updated = localIncome;
            unsyncedIncome.forEach(i => {
              updated = storage.updateIncome(i.id, { synced: true });
            });
            setIncome(updated);
          }
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
    const unsyncedExpenses = currentExpenses.filter(e => !e.synced);
    const currentIncome = storage.getIncome();
    const unsyncedIncome = currentIncome.filter(i => !i.synced);

    try {
      if (syncMode === 'oauth' && user?.accessToken && config.spreadsheetId) {
        // OAuth mode: sync directly via Sheets API
        if (unsyncedExpenses.length > 0) {
          await sheetsApi.addExpenses(user.accessToken, config.spreadsheetId, unsyncedExpenses);
          let updated = currentExpenses;
          unsyncedExpenses.forEach(e => {
            updated = storage.updateExpense(e.id, { synced: true });
          });
          setExpenses(updated);
        }

        if (unsyncedIncome.length > 0) {
          await sheetsApi.addIncome(user.accessToken, config.spreadsheetId, unsyncedIncome);
          let updated = currentIncome;
          unsyncedIncome.forEach(i => {
            updated = storage.updateIncome(i.id, { synced: true });
          });
          setIncome(updated);
        }
      } else if (syncMode === 'appsscript') {
        // Apps Script mode
        if (unsyncedExpenses.length > 0) {
          const syncedIds = await storage.syncToSheets(currentExpenses, config.sheetsUrl, config.sheetsSecret);
          if (syncedIds.length > 0) {
            let updated = currentExpenses;
            syncedIds.forEach(id => {
              updated = storage.updateExpense(id, { synced: true });
            });
            setExpenses(updated);
          }
        }

        if (unsyncedIncome.length > 0) {
          const syncedIds = await storage.syncIncomeToCloud(currentIncome, config.sheetsUrl, config.sheetsSecret);
          if (syncedIds.length > 0) {
            let updated = currentIncome;
            syncedIds.forEach(id => {
              updated = storage.updateIncome(id, { synced: true });
            });
            setIncome(updated);
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

  const handleSaveIncome = (newIncomeData: Omit<Income, 'id' | 'timestamp' | 'synced'>) => {
    const newIncome: Income = {
      ...newIncomeData,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      synced: false
    };

    const updated = storage.saveIncome(newIncome);
    setIncome(updated);

    if (isOnline) {
      handleSync();
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (confirm('Delete this transaction?')) {
      const updated = storage.deleteExpense(id);
      setExpenses(updated);

      // Mark as deleted in Google Sheets
      const syncMode = getSyncMode(config);
      if (isOnline && syncMode === 'oauth' && user?.accessToken && config.spreadsheetId) {
        await sheetsApi.markTransactionAsDeleted(user.accessToken, config.spreadsheetId, id, 'expense');
      }
    }
  };

  const handleDeleteIncome = async (id: string) => {
    if (confirm('Delete this income entry?')) {
      const updated = storage.deleteIncome(id);
      setIncome(updated);

      // Mark as deleted in Google Sheets
      const syncMode = getSyncMode(config);
      if (isOnline && syncMode === 'oauth' && user?.accessToken && config.spreadsheetId) {
        await sheetsApi.markTransactionAsDeleted(user.accessToken, config.spreadsheetId, id, 'income');
      }
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

  const handleUpdateIncome = (id: string, updates: Partial<Income>) => {
    // Mark as unsynced when edited so it re-syncs
    const updated = storage.updateIncome(id, { ...updates, synced: false });
    setIncome(updated);

    // Trigger sync
    if (isOnline) {
      handleSync();
    }
  };

  const handleSaveTransfer = (newTransferData: Omit<Transfer, 'id' | 'timestamp' | 'synced'>, fee?: number) => {
    const newTransfer: Transfer = {
      ...newTransferData,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      synced: false
    };

    const updated = storage.saveTransfer(newTransfer);
    setTransfers(updated);

    // If a fee was specified, create a FEES expense
    if (fee && fee > 0) {
      // Determine payment method based on source account
      const paymentMethod = newTransferData.fromAccountId === 'cash' ? 'Cash' as const : 'Card' as const;

      const feeExpense: Expense = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        date: newTransferData.date,
        amount: fee,
        category: 'FEES',
        type: 'NEED',
        paymentMethod,
        store: newTransferData.description || 'Transfer Fee',
        notes: `Fee for transfer: ${newTransferData.description || 'Transfer'}`,
        source: 'manual',
        synced: false
      };

      const updatedExpenses = storage.saveExpense(feeExpense);
      setExpenses(updatedExpenses);
    }

    if (isOnline) {
      handleSync();
    }
  };

  const handleDeleteTransfer = async (id: string) => {
    if (confirm('Delete this transfer?')) {
      const updated = storage.deleteTransfer(id);
      setTransfers(updated);

      // Mark as deleted in Google Sheets
      const syncMode = getSyncMode(config);
      if (isOnline && syncMode === 'oauth' && user?.accessToken && config.spreadsheetId) {
        await sheetsApi.markTransactionAsDeleted(user.accessToken, config.spreadsheetId, id, 'transfer');
      }
    }
  };

  const handleUpdateTransfer = (id: string, updates: Partial<Transfer>) => {
    // Mark as unsynced when edited so it re-syncs
    const updated = storage.updateTransfer(id, { ...updates, synced: false });
    setTransfers(updated);

    // Trigger sync
    if (isOnline) {
      handleSync();
    }
  };

  // Sync accounts to cloud
  const syncAccountsToCloud = async (accountsToSync: BankAccount[]) => {
    const syncMode = getSyncMode(config);
    if (!isOnline || syncMode === 'local') return;

    try {
      if (syncMode === 'oauth' && user?.accessToken && config.spreadsheetId) {
        await sheetsApi.saveAccounts(user.accessToken, config.spreadsheetId, accountsToSync);
      }
      // Apps Script mode would need backend support for accounts
    } catch (error) {
      console.error('Account sync failed:', error);
    }
  };

  // Bank Account handlers
  const handleAddAccount = (accountData: Omit<BankAccount, 'id' | 'createdAt'>) => {
    const newAccount: BankAccount = {
      ...accountData,
      id: `bank_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    const updated = storage.saveAccount(newAccount);
    setAccounts(updated);
    syncAccountsToCloud(updated);
  };

  const handleUpdateAccount = (id: string, updates: Partial<BankAccount>) => {
    const updated = storage.updateAccount(id, updates);
    setAccounts(updated);
    syncAccountsToCloud(updated);
  };

  const handleDeleteAccount = (id: string): { success: boolean; error?: string } => {
    const result = storage.deleteAccount(id);
    if (result.success) {
      setAccounts(result.accounts);
      syncAccountsToCloud(result.accounts);
    }
    return { success: result.success, error: result.error };
  };

  const handleSetDefaultAccount = (id: string) => {
    const updated = storage.setDefaultAccount(id);
    setAccounts(updated);
    syncAccountsToCloud(updated);
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

          // If categories changed, sync to dedicated Categories sheet
          const categoriesChanged = JSON.stringify(newConfig.categories) !== JSON.stringify(oldConfig.categories);
          if (categoriesChanged && newConfig.categories) {
            await sheetsApi.saveCategories(user.accessToken, newConfig.spreadsheetId, newConfig.categories);
          }

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

  const handleStartingBalanceUpdate = async (startingBalance: StartingBalance) => {
    const newBalances: AccountBalances = {
      ...config.balances,
      startingBalance,
      lastUpdated: new Date().toISOString()
    };
    await handleBalanceUpdate(newBalances);
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
              <BudgetSummary
                expenses={expenses}
                income={income}
                transfers={transfers}
                config={config}
                bankAccounts={accounts}
                onUpdateBalances={handleBalanceUpdate}
                onUpdateStartingBalance={handleStartingBalanceUpdate}
                isDark={isDark}
              />
            </div>
            <div>
              <TransactionList
                expenses={expenses}
                income={income}
                transfers={transfers}
                onDeleteExpense={handleDeleteExpense}
                onDeleteIncome={handleDeleteIncome}
                onDeleteTransfer={handleDeleteTransfer}
                isDark={isDark}
                categories={config.categories}
                limit={8}
              />
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
            <TransactionList
              expenses={expenses}
              income={income}
              transfers={transfers}
              onDeleteExpense={handleDeleteExpense}
              onDeleteIncome={handleDeleteIncome}
              onDeleteTransfer={handleDeleteTransfer}
              onEditExpense={handleUpdateExpense}
              onEditIncome={handleUpdateIncome}
              onEditTransfer={handleUpdateTransfer}
              categories={config.categories}
              bankAccounts={accounts}
              isDark={isDark}
            />
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
            Add Entry
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className={`p-2.5 lg:p-2 rounded-xl transition-all active:scale-95 ${isDark ? 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white' : 'bg-white border border-gray-200 text-gray-500 hover:text-gray-900'}`}
            title="Help"
          >
            <HelpCircle className="w-5 h-5 lg:w-4 lg:h-4" />
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

      {/* Expense/Income/Transfer Form Modal */}
      <ExpenseFormModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onSaveExpense={handleSaveExpense}
        onSaveIncome={handleSaveIncome}
        onSaveTransfer={handleSaveTransfer}
        apiKey={config.geminiKey}
        isDark={isDark}
        categories={config.categories}
        bankAccounts={accounts}
      />

      {showSettings && (
        <Settings
          config={config}
          onSave={handleConfigUpdate}
          onClose={() => setShowSettings(false)}
          isDark={isDark}
          bankAccounts={accounts}
          onAddAccount={handleAddAccount}
          onUpdateAccount={handleUpdateAccount}
          onDeleteAccount={handleDeleteAccount}
          onSetDefaultAccount={handleSetDefaultAccount}
        />
      )}

      {/* Help Modal */}
      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        isDark={isDark}
      />

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
