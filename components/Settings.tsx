
import React, { useState } from 'react';
import { AppConfig, Category } from '../types';
import { CATEGORIES } from '../constants';

interface SettingsProps {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
  onClose: () => void;
}

const Settings: React.FC<SettingsProps> = ({ config, onSave, onClose }) => {
  const [form, setForm] = useState(config);

  return (
    <div className="fixed inset-0 bg-black z-50 overflow-y-auto safe-bottom">
      <div className="p-6 flex flex-col min-h-full">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Settings</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-2">Close</button>
        </div>

        <div className="space-y-8 flex-1">
          {/* API CONFIG */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Connection</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2">Gemini API Key</label>
                <input
                  type="password"
                  value={form.geminiKey}
                  onChange={(e) => setForm({...form, geminiKey: e.target.value})}
                  placeholder="Enter key for receipt OCR"
                  className="w-full bg-zinc-900 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-white/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-2">Apps Script URL</label>
                <input
                  type="url"
                  value={form.sheetsUrl}
                  onChange={(e) => setForm({...form, sheetsUrl: e.target.value})}
                  placeholder="https://script.google.com/..."
                  className="w-full bg-zinc-900 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-white/20 outline-none"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">About</h3>
            <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-900/50 p-4 rounded-xl">
              FinFree is a mobile-first financial tracker designed for speed and clarity. 
              Configure your monthly budget in the Budget tab to track spending against your salary.
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-800">
          <button
            onClick={() => {
              onSave(form);
              onClose();
            }}
            className="w-full bg-white text-black font-semibold py-4 rounded-xl hover:bg-zinc-200 active:scale-[0.98] transition-all"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
