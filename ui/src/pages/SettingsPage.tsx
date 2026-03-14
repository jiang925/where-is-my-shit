import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon, Monitor, Trash2, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';

interface SettingsPageProps {
  onLogout: () => void;
}

export function SettingsPage({ onLogout }: SettingsPageProps) {
  const { theme, setTheme } = useTheme();
  const [defaultView, setDefaultView] = useState(() =>
    localStorage.getItem('wims_view_mode') || 'card'
  );
  const [cleared, setCleared] = useState(false);

  const handleClearLocalData = () => {
    localStorage.removeItem('wims_bookmarks');
    localStorage.removeItem('wims_notes');
    localStorage.removeItem('wims_search_history');
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center font-sans text-gray-900 dark:text-gray-100">
      <div className="w-full max-w-2xl px-4 py-8">
        <h1 className="text-xl font-semibold mb-6">Settings</h1>

        {/* Appearance */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Appearance</h2>
          <div className="flex items-center gap-2">
            {([
              { value: 'system', label: 'System', icon: Monitor },
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer border",
                  theme === value
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600"
                    : "bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-300"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Default View */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Default Search View</h2>
          <div className="flex items-center gap-2">
            {[
              { value: 'card', label: 'Card View' },
              { value: 'compact', label: 'Compact View' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => {
                  setDefaultView(value);
                  localStorage.setItem('wims_view_mode', value);
                }}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer border",
                  defaultView === value
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600"
                    : "bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-300"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Data Management */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Data</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Clear local data</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Remove bookmarks, notes, and search history from this browser</p>
              </div>
              <button
                onClick={handleClearLocalData}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                {cleared ? 'Cleared!' : 'Clear'}
              </button>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
              <div>
                <p className="text-sm font-medium">Disconnect</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Remove API key and return to login</p>
              </div>
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Disconnect
              </button>
            </div>
          </div>
        </section>

        {/* Search Operators Help */}
        <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Search Operators</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-3">
              <code className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono whitespace-nowrap">from:chatgpt</code>
              <span className="text-gray-600 dark:text-gray-400">Filter by platform</span>
            </div>
            <div className="flex items-start gap-3">
              <code className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono whitespace-nowrap">before:2026-03-01</code>
              <span className="text-gray-600 dark:text-gray-400">Messages before a date</span>
            </div>
            <div className="flex items-start gap-3">
              <code className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono whitespace-nowrap">after:2026-01-01</code>
              <span className="text-gray-600 dark:text-gray-400">Messages after a date</span>
            </div>
            <div className="flex items-start gap-3">
              <code className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono whitespace-nowrap">has:code</code>
              <span className="text-gray-600 dark:text-gray-400">Messages containing code blocks</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
