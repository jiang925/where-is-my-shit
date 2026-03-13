import { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  className?: string;
  initialValue?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function SearchBar({ onSearch, isLoading, className, initialValue = '', inputRef }: SearchBarProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(value);
    }, 300);

    return () => clearTimeout(timer);
  }, [value, onSearch]);

  return (
    <div className={cn("relative w-full max-w-2xl mx-auto", className)}>
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
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          autoFocus
        />
      </div>
    </div>
  );
}
