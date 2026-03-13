import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Clock, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  className?: string;
  initialValue?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  searchHistory?: string[];
  onSelectHistory?: (query: string) => void;
  onRemoveHistory?: (query: string) => void;
  onClearHistory?: () => void;
}

export function SearchBar({ onSearch, isLoading, className, initialValue = '', inputRef, searchHistory, onSelectHistory, onRemoveHistory, onClearHistory }: SearchBarProps) {
  const [value, setValue] = useState(initialValue);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(value);
    }, 300);

    return () => clearTimeout(timer);
  }, [value, onSearch]);

  // Track mount to avoid showing dropdown on autoFocus
  useEffect(() => {
    const timer = setTimeout(() => { mountedRef.current = true; }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleFocus = () => {
    if (mountedRef.current && !value && searchHistory && searchHistory.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    if (!e.target.value && searchHistory && searchHistory.length > 0) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };

  const handleSelect = (query: string) => {
    setValue(query);
    setShowDropdown(false);
    onSelectHistory?.(query);
  };

  const hasHistory = searchHistory && searchHistory.length > 0;
  const shouldShowDropdown = showDropdown && hasHistory && !value;

  return (
    <div ref={dropdownRef} className={cn("relative w-full max-w-2xl mx-auto", className)}>
      <div className="relative flex items-center w-full h-12 rounded-lg focus-within:shadow-lg bg-white dark:bg-gray-800 overflow-hidden border border-gray-200 dark:border-gray-600 transition-shadow">
        <div className="grid place-items-center h-full w-12 text-gray-300 dark:text-gray-500">
          {isLoading ? (
            <Loader2 className="animate-spin h-5 w-5" />
          ) : (
            <Search className="h-5 w-5" />
          )}
        </div>

        <input
          ref={inputRef}
          className="peer h-full w-full outline-none text-gray-700 dark:text-gray-200 pr-2 placeholder-gray-400 dark:placeholder-gray-500 bg-transparent"
          type="text"
          id="search"
          placeholder="Search your history..."
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          autoComplete="off"
          autoFocus
        />
      </div>

      {/* Search History Dropdown */}
      {shouldShowDropdown && (
        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Recent searches</span>
            {onClearHistory && (
              <button
                onClick={(e) => { e.stopPropagation(); onClearHistory(); setShowDropdown(false); }}
                className="text-xs text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                aria-label="Remove search history"
              >
                Remove all
              </button>
            )}
          </div>
          <ul role="listbox" aria-label="Recent searches">
            {searchHistory!.map((query) => (
              <li
                key={query}
                role="option"
                aria-selected={false}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer group"
                onClick={() => handleSelect(query)}
              >
                <Clock className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{query}</span>
                {onRemoveHistory && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveHistory(query); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 transition-all cursor-pointer"
                    aria-label={`Remove "${query}" from history`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
