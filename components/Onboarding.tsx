import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ICONS } from '../constants';

interface OnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
  isDark?: boolean;
}

type Step = 'welcome' | 'client-id' | 'sign-in' | 'spreadsheet' | 'complete';

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onSkip, isDark = true }) => {
  const [step, setStep] = useState<Step>('welcome');
  const [clientId, setClientId] = useState('');
  const [spreadsheetInput, setSpreadsheetInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const { user, spreadsheetId, isLoading, error, signIn, createSpreadsheet, connectSpreadsheet } = useAuth();

  const handleSignIn = async () => {
    if (!clientId.trim()) {
      setLocalError('Please enter your OAuth Client ID');
      return;
    }
    setLocalError(null);
    try {
      await signIn(clientId);
      setStep('spreadsheet');
    } catch {
      // Error handled by context
    }
  };

  const handleCreateSpreadsheet = async () => {
    try {
      await createSpreadsheet();
      setStep('complete');
    } catch {
      // Error handled by context
    }
  };

  const handleConnectSpreadsheet = async () => {
    if (!spreadsheetInput.trim()) {
      setLocalError('Please enter a spreadsheet URL or ID');
      return;
    }
    setLocalError(null);
    try {
      await connectSpreadsheet(spreadsheetInput);
      setStep('complete');
    } catch {
      // Error handled by context
    }
  };

  const inputClass = `w-full border-none rounded-xl py-3 px-4 text-sm focus:ring-2 outline-none ${isDark ? 'bg-zinc-800 text-white focus:ring-white/20 placeholder:text-zinc-500' : 'bg-gray-100 text-gray-900 focus:ring-gray-300 placeholder:text-gray-400'}`;
  const buttonClass = `w-full font-semibold py-4 rounded-xl transition-colors ${isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-gray-900 text-white hover:bg-gray-800'}`;
  const secondaryButtonClass = `w-full font-medium py-3 rounded-xl transition-colors ${isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`;

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <>
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6 ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-gray-100 border border-gray-200'}`}>
              <span className="text-3xl">💰</span>
            </div>
            <h1 className={`text-3xl font-bold mb-4 tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Welcome to FinFree
            </h1>
            <p className={`text-sm mb-10 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
              Track your expenses, manage budgets, and sync across devices with Google Sheets.
            </p>
            <button onClick={() => setStep('client-id')} className={buttonClass}>
              Get Started
            </button>
            <button onClick={onSkip} className={secondaryButtonClass}>
              Use Offline Only
            </button>
          </>
        );

      case 'client-id':
        return (
          <>
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6 ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-gray-100 border border-gray-200'}`}>
              <ICONS.Settings className={`w-8 h-8 ${isDark ? 'text-zinc-300' : 'text-gray-600'}`} />
            </div>
            <h2 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Setup Google OAuth
            </h2>
            <p className={`text-sm mb-6 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
              To sync with Google Sheets, you'll need an OAuth Client ID from Google Cloud Console.
            </p>
            <div className={`text-left p-4 rounded-xl mb-6 ${isDark ? 'bg-zinc-900' : 'bg-gray-100'}`}>
              <p className={`text-xs font-medium mb-2 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>Quick Setup:</p>
              <ol className={`text-xs space-y-1 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                <li>1. Go to console.cloud.google.com</li>
                <li>2. Create a project and enable Sheets API</li>
                <li>3. Configure OAuth consent screen</li>
                <li>4. Create OAuth 2.0 Client ID (Web)</li>
                <li>5. Add your domain to authorized origins</li>
              </ol>
            </div>
            <div className="mb-4">
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Paste your OAuth Client ID"
                className={inputClass}
              />
            </div>
            {(localError || error) && (
              <p className="text-xs text-red-500 mb-4">{localError || error}</p>
            )}
            <button onClick={handleSignIn} disabled={isLoading} className={buttonClass}>
              {isLoading ? 'Connecting...' : 'Continue with Google'}
            </button>
            <button onClick={() => setStep('welcome')} className={secondaryButtonClass}>
              Back
            </button>
          </>
        );

      case 'spreadsheet':
        return (
          <>
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6 ${isDark ? 'bg-zinc-900 border border-zinc-800' : 'bg-gray-100 border border-gray-200'}`}>
              <ICONS.Table className={`w-8 h-8 ${isDark ? 'text-zinc-300' : 'text-gray-600'}`} />
            </div>
            <h2 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Connect Spreadsheet
            </h2>
            <p className={`text-sm mb-8 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
              Your data will be stored in a Google Sheet that only you can access.
            </p>
            <button onClick={handleCreateSpreadsheet} disabled={isLoading} className={buttonClass}>
              {isLoading ? 'Creating...' : 'Create New Spreadsheet'}
            </button>
            <div className={`my-6 text-center text-xs ${isDark ? 'text-zinc-600' : 'text-gray-400'}`}>
              — or connect existing —
            </div>
            <div className="mb-4">
              <input
                type="text"
                value={spreadsheetInput}
                onChange={(e) => setSpreadsheetInput(e.target.value)}
                placeholder="Paste spreadsheet URL or ID"
                className={inputClass}
              />
            </div>
            {(localError || error) && (
              <p className="text-xs text-red-500 mb-4">{localError || error}</p>
            )}
            <button onClick={handleConnectSpreadsheet} disabled={isLoading} className={`mb-2 ${buttonClass.replace('bg-white', 'bg-zinc-800').replace('text-black', 'text-white').replace('bg-gray-900', 'bg-gray-200').replace('text-white', 'text-gray-900')}`}>
              Connect Existing
            </button>
          </>
        );

      case 'complete':
        return (
          <>
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6 ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
              <ICONS.CheckCircle2 className={`w-10 h-10 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            </div>
            <h2 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              You're All Set!
            </h2>
            <p className={`text-sm mb-8 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
              Your expenses will sync automatically to your Google Sheet.
            </p>
            {spreadsheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`block text-center mb-4 text-sm ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'}`}
              >
                Open Spreadsheet →
              </a>
            )}
            <button onClick={onComplete} className={buttonClass}>
              Start Tracking
            </button>
          </>
        );
    }
  };

  return (
    <div className={`fixed inset-0 z-[70] flex items-center justify-center p-6 ${isDark ? 'bg-zinc-950' : 'bg-white'}`}>
      <div className="max-w-sm w-full text-center">
        {renderStep()}
      </div>
    </div>
  );
};

export default Onboarding;
