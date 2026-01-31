
import React, { useState } from 'react';
import { AppConfig, Category } from '../types';
import { CATEGORIES } from '../constants';

interface SettingsProps {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
  onClose: () => void;
  isDark?: boolean;
}

const Settings: React.FC<SettingsProps> = ({ config, onSave, onClose, isDark = true }) => {
  const [form, setForm] = useState(config);

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto safe-bottom ${isDark ? 'bg-black' : 'bg-white'}`}>
      <div className="p-6 flex flex-col min-h-full">
        <div className="flex items-center justify-between mb-8">
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
          <button onClick={onClose} className={`p-2 ${isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>Close</button>
        </div>

        <div className="space-y-8 flex-1">
          {/* API CONFIG */}
          <section className="space-y-4">
            <h3 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Connection</h3>
            <div className="space-y-4">
              <div>
                <label className={`block text-[10px] font-medium uppercase tracking-wider mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Gemini API Key</label>
                <input
                  type="password"
                  value={form.geminiKey}
                  onChange={(e) => setForm({...form, geminiKey: e.target.value})}
                  placeholder="Enter key for receipt OCR"
                  className={`w-full border-none rounded-xl py-3 px-4 text-sm focus:ring-2 outline-none ${isDark ? 'bg-zinc-900 text-white focus:ring-white/20 placeholder:text-zinc-600' : 'bg-gray-100 text-gray-900 focus:ring-gray-300 placeholder:text-gray-400'}`}
                />
              </div>
              <div>
                <label className={`block text-[10px] font-medium uppercase tracking-wider mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Apps Script URL</label>
                <input
                  type="url"
                  value={form.sheetsUrl}
                  onChange={(e) => setForm({...form, sheetsUrl: e.target.value})}
                  placeholder="https://script.google.com/..."
                  className={`w-full border-none rounded-xl py-3 px-4 text-sm focus:ring-2 outline-none ${isDark ? 'bg-zinc-900 text-white focus:ring-white/20 placeholder:text-zinc-600' : 'bg-gray-100 text-gray-900 focus:ring-gray-300 placeholder:text-gray-400'}`}
                />
              </div>
              <div>
                <label className={`block text-[10px] font-medium uppercase tracking-wider mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Sheets API Secret</label>
                <input
                  type="password"
                  value={form.sheetsSecret}
                  onChange={(e) => setForm({...form, sheetsSecret: e.target.value})}
                  placeholder="Your secret token"
                  className={`w-full border-none rounded-xl py-3 px-4 text-sm focus:ring-2 outline-none ${isDark ? 'bg-zinc-900 text-white focus:ring-white/20 placeholder:text-zinc-600' : 'bg-gray-100 text-gray-900 focus:ring-gray-300 placeholder:text-gray-400'}`}
                />
                <p className={`text-[9px] mt-1 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
                  Must match the API_SECRET in your Apps Script
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>About</h3>
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
