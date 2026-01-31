
import React, { useState } from 'react';
import { AppConfig } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface SettingsProps {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
  onClose: () => void;
  isDark?: boolean;
}

const Settings: React.FC<SettingsProps> = ({ config, onSave, onClose, isDark = true }) => {
  const [form, setForm] = useState(config);
  const [oauthClientId, setOauthClientId] = useState('');
  const [spreadsheetInput, setSpreadsheetInput] = useState('');
  const [showLegacy, setShowLegacy] = useState(!!config.sheetsUrl);

  const { user, spreadsheetId, isLoading, error, signIn, signOut, createSpreadsheet, connectSpreadsheet } = useAuth();

  const handleSignIn = async () => {
    if (!oauthClientId.trim()) {
      alert('Please enter your OAuth Client ID first');
      return;
    }
    try {
      await signIn(oauthClientId);
    } catch {
      // Error handled by context
    }
  };

  const handleCreateSpreadsheet = async () => {
    try {
      await createSpreadsheet();
    } catch {
      // Error handled by context
    }
  };

  const handleConnectSpreadsheet = async () => {
    if (!spreadsheetInput.trim()) {
      alert('Please enter a spreadsheet URL or ID');
      return;
    }
    try {
      await connectSpreadsheet(spreadsheetInput);
      setSpreadsheetInput('');
    } catch {
      // Error handled by context
    }
  };

  const inputClass = `w-full border-none rounded-xl py-3 px-4 text-sm focus:ring-2 outline-none ${isDark ? 'bg-zinc-900 text-white focus:ring-white/20 placeholder:text-zinc-600' : 'bg-gray-100 text-gray-900 focus:ring-gray-300 placeholder:text-gray-400'}`;
  const labelClass = `block text-[10px] font-medium uppercase tracking-wider mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`;
  const sectionTitleClass = `text-xs font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-gray-500'}`;
  const buttonClass = `px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${isDark ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-gray-200 text-gray-900 hover:bg-gray-300'}`;
  const primaryButtonClass = `px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-gray-900 text-white hover:bg-gray-800'}`;

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto safe-bottom ${isDark ? 'bg-black' : 'bg-white'}`}>
      <div className="p-6 flex flex-col min-h-full">
        <div className="flex items-center justify-between mb-8">
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
          <button onClick={onClose} className={`p-2 ${isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>Close</button>
        </div>

        <div className="space-y-8 flex-1">
          {/* GOOGLE ACCOUNT */}
          <section className="space-y-4">
            <h3 className={sectionTitleClass}>Google Account</h3>
            {user ? (
              <div className={`flex items-center gap-4 p-4 rounded-xl ${isDark ? 'bg-zinc-900' : 'bg-gray-100'}`}>
                <img src={user.picture} alt="" className="w-10 h-10 rounded-full" />
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{user.name}</p>
                  <p className={`text-xs truncate ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{user.email}</p>
                </div>
                <button onClick={signOut} disabled={isLoading} className={buttonClass}>
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>OAuth Client ID</label>
                  <input
                    type="text"
                    value={oauthClientId}
                    onChange={(e) => setOauthClientId(e.target.value)}
                    placeholder="Your Google Cloud OAuth Client ID"
                    className={inputClass}
                  />
                  <p className={`text-[9px] mt-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                    Create one at console.cloud.google.com
                  </p>
                </div>
                <button onClick={handleSignIn} disabled={isLoading} className={primaryButtonClass}>
                  {isLoading ? 'Signing in...' : 'Sign in with Google'}
                </button>
              </div>
            )}
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </section>

          {/* SPREADSHEET */}
          {user && (
            <section className="space-y-4">
              <h3 className={sectionTitleClass}>Spreadsheet</h3>
              {spreadsheetId ? (
                <div className="space-y-3">
                  <div className={`p-4 rounded-xl ${isDark ? 'bg-zinc-900' : 'bg-gray-100'}`}>
                    <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Connected to:</p>
                    <p className={`text-sm font-mono truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{spreadsheetId}</p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClass}
                    >
                      Open in Sheets
                    </a>
                    <button onClick={() => connectSpreadsheet('')} className={buttonClass}>
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <button onClick={handleCreateSpreadsheet} disabled={isLoading} className={`w-full ${primaryButtonClass}`}>
                    {isLoading ? 'Creating...' : 'Create New Spreadsheet'}
                  </button>
                  <div className={`text-center text-xs ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>or</div>
                  <div>
                    <label className={labelClass}>Connect Existing</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={spreadsheetInput}
                        onChange={(e) => setSpreadsheetInput(e.target.value)}
                        placeholder="Spreadsheet URL or ID"
                        className={inputClass}
                      />
                      <button onClick={handleConnectSpreadsheet} disabled={isLoading} className={buttonClass}>
                        Connect
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* GEMINI API */}
          <section className="space-y-4">
            <h3 className={sectionTitleClass}>Receipt OCR</h3>
            <div>
              <label className={labelClass}>Gemini API Key</label>
              <input
                type="password"
                value={form.geminiKey}
                onChange={(e) => setForm({...form, geminiKey: e.target.value})}
                placeholder="Enter key for receipt scanning"
                className={inputClass}
              />
            </div>
          </section>

          {/* LEGACY APPS SCRIPT */}
          <section className="space-y-4">
            <button
              onClick={() => setShowLegacy(!showLegacy)}
              className={`flex items-center gap-2 ${sectionTitleClass}`}
            >
              <span>{showLegacy ? '▼' : '▶'}</span>
              <span>Apps Script (Legacy)</span>
            </button>
            {showLegacy && (
              <div className="space-y-4">
                <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                  Use this if you prefer the Apps Script sync method instead of direct Google Sheets API.
                </p>
                <div>
                  <label className={labelClass}>Apps Script URL</label>
                  <input
                    type="url"
                    value={form.sheetsUrl}
                    onChange={(e) => setForm({...form, sheetsUrl: e.target.value})}
                    placeholder="https://script.google.com/..."
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Sheets API Secret</label>
                  <input
                    type="password"
                    value={form.sheetsSecret}
                    onChange={(e) => setForm({...form, sheetsSecret: e.target.value})}
                    placeholder="Your secret token"
                    className={inputClass}
                  />
                  <p className={`text-[9px] mt-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                    Must match the API_SECRET in your Apps Script
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h3 className={sectionTitleClass}>About</h3>
            <p className={`text-xs leading-relaxed p-4 rounded-xl ${isDark ? 'text-zinc-400 bg-zinc-900/50' : 'text-gray-600 bg-gray-100'}`}>
              FinFree is a mobile-first financial tracker designed for speed and clarity.
              Configure your monthly budget in the Budget tab to track spending against your salary.
            </p>
          </section>
        </div>

        <div className={`mt-8 pt-6 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <button
            onClick={() => {
              onSave(form);
              onClose();
            }}
            className={`w-full font-semibold py-4 rounded-xl active:scale-[0.98] transition-all ${isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
