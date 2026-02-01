
import React, { useEffect } from 'react';
import { X, HelpCircle, Wallet, TrendingUp, TrendingDown, PiggyBank, Calculator, Calendar } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, isDark = true }) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sections = [
    {
      icon: <Wallet className="w-5 h-5" />,
      title: 'Cash on Hand',
      description: 'Your running balance calculated from a starting balance plus income minus expenses. Tracks Cash and Bank accounts separately so you always know exactly how much money you have.',
      color: 'text-blue-500'
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: 'Income',
      description: 'Track money coming in - salary, freelance work, bonuses, refunds, or gifts. Each income entry adds to your running balance, categorized by whether it went to Cash or Bank.',
      color: 'text-emerald-500'
    },
    {
      icon: <TrendingDown className="w-5 h-5" />,
      title: 'Expenses',
      description: 'Track money going out. Categorize by type (Need, Want, Save) and payment method (Cash, Card, Bank). Card and Bank payments reduce your Bank balance; Cash payments reduce Cash.',
      color: 'text-rose-500'
    },
    {
      icon: <Calculator className="w-5 h-5" />,
      title: 'Daily Budget',
      description: 'Shows how much you can spend per day based on your remaining budget divided by days left in the month. Helps pace your spending to stay within budget.',
      color: 'text-amber-500'
    },
    {
      icon: <PiggyBank className="w-5 h-5" />,
      title: 'Monthly Budget',
      description: 'Set a target salary/income and allocate amounts to each category. The progress bars show how much you\'ve spent vs. budgeted, turning red when over budget.',
      color: 'text-purple-500'
    },
    {
      icon: <Calendar className="w-5 h-5" />,
      title: 'Starting Balance',
      description: 'Set your initial Cash and Bank amounts as of a specific date. All income and expenses after this date are used to calculate your current running balance automatically.',
      color: 'text-cyan-500'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 transition-opacity ${isDark ? 'bg-black/80' : 'bg-black/50'}`}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 ${
          isDark ? 'bg-[#0a0a0a] border border-zinc-800' : 'bg-white border border-gray-200'
        }`}
      >
        {/* Header */}
        <div className={`sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b ${isDark ? 'bg-[#0a0a0a] border-zinc-800' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
              <HelpCircle className={`w-5 h-5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`} />
            </div>
            <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              How FinFree Works
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 -mr-2 rounded-xl transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-500 hover:text-white' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-900'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Intro */}
          <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
            FinFree combines <strong className={isDark ? 'text-white' : 'text-gray-900'}>budget planning</strong> with <strong className={isDark ? 'text-white' : 'text-gray-900'}>cash flow tracking</strong> to give you complete visibility into your finances.
          </p>

          {/* Sections */}
          <div className="space-y-3">
            {sections.map((section, index) => (
              <div
                key={index}
                className={`p-4 rounded-2xl ${isDark ? 'bg-zinc-900/50 border border-zinc-800/50' : 'bg-gray-50 border border-gray-200'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${isDark ? 'bg-zinc-800' : 'bg-white border border-gray-200'}`}>
                    <span className={section.color}>{section.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className={`font-bold text-sm mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {section.title}
                    </h3>
                    <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                      {section.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Tips */}
          <div className={`p-4 rounded-2xl ${isDark ? 'bg-emerald-950/30 border border-emerald-900/30' : 'bg-emerald-50 border border-emerald-200'}`}>
            <h3 className={`font-bold text-sm mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
              Quick Tips
            </h3>
            <ul className={`text-xs space-y-1.5 ${isDark ? 'text-emerald-500/80' : 'text-emerald-600'}`}>
              <li>• Set your <strong>Starting Balance</strong> first to enable running totals</li>
              <li>• Use the <strong>Expense/Income toggle</strong> when adding new entries</li>
              <li>• Check your <strong>Daily Budget</strong> to pace spending through the month</li>
              <li>• Scan receipts with the <strong>camera button</strong> for quick entry</li>
            </ul>
          </div>

          {/* Formula explanation */}
          <div className={`p-4 rounded-2xl ${isDark ? 'bg-zinc-900/50 border border-zinc-800/50' : 'bg-gray-50 border border-gray-200'}`}>
            <h3 className={`font-bold text-xs uppercase tracking-wider mb-3 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
              The Math
            </h3>
            <div className={`space-y-2 font-mono text-xs ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
              <div className="flex items-center gap-2">
                <span className={isDark ? 'text-blue-400' : 'text-blue-600'}>Cash on Hand</span>
                <span>=</span>
                <span>Starting Balance + Income - Expenses</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={isDark ? 'text-amber-400' : 'text-amber-600'}>Daily Budget</span>
                <span>=</span>
                <span>Budget Remaining ÷ Days Left</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>Net Cash Flow</span>
                <span>=</span>
                <span>Monthly Income - Monthly Expenses</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
          <button
            onClick={onClose}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
              isDark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
