import { useSearchParams } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import type { DateRangeOption } from '../lib/api';

const DATE_RANGE_OPTIONS: Array<{ id: DateRangeOption; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'all_time', label: 'All Time' },
];

interface DateRangeFilterProps {
  className?: string;
}

export function DateRangeFilter({ className }: DateRangeFilterProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentRange = (searchParams.get('range') as DateRangeOption) || 'all_time';

  const handleRangeChange = (range: DateRangeOption) => {
    const newParams = new URLSearchParams(searchParams);
    if (range === 'all_time') {
      newParams.delete('range'); // Default, no need in URL
    } else {
      newParams.set('range', range);
    }
    setSearchParams(newParams);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Date Range</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {DATE_RANGE_OPTIONS.map((option) => {
          const isActive = currentRange === option.id;
          return (
            <button
              key={option.id}
              onClick={() => handleRangeChange(option.id)}
              className={cn(
                "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all border cursor-pointer",
                isActive
                  ? "bg-blue-100 text-blue-700 border-blue-300"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              )}
              aria-label={`Filter by ${option.label}`}
              aria-pressed={isActive}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
