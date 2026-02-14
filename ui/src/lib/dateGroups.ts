import { isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import type { BrowseItem, DateRangeOption } from './api';

export type TimelineGroupKey = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'older';

export interface GroupedTimeline {
  today: BrowseItem[];
  yesterday: BrowseItem[];
  this_week: BrowseItem[];
  this_month: BrowseItem[];
  older: BrowseItem[];
}

export const TIMELINE_SECTIONS: Array<{ key: TimelineGroupKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'older', label: 'Older' },
];

/**
 * Group conversations by relative time periods.
 * Uses date-fns functions that compare against current time on each call,
 * so groups auto-update daily without manual refresh.
 */
export function groupByTimeline(items: BrowseItem[]): GroupedTimeline {
  const groups: GroupedTimeline = {
    today: [],
    yesterday: [],
    this_week: [],
    this_month: [],
    older: [],
  };

  for (const item of items) {
    // Convert Unix timestamp to Date
    const date = new Date(item.timestamp * 1000);

    if (isToday(date)) {
      groups.today.push(item);
    } else if (isYesterday(date)) {
      groups.yesterday.push(item);
    } else if (isThisWeek(date, { weekStartsOn: 0 })) {
      // weekStartsOn: 0 = Sunday
      groups.this_week.push(item);
    } else if (isThisMonth(date)) {
      groups.this_month.push(item);
    } else {
      groups.older.push(item);
    }
  }

  return groups;
}

/**
 * Flatten all pages from useInfiniteQuery and group by timeline.
 * Returns empty groups if data is undefined.
 */
export function flattenAndGroup(pages: Array<{ items: BrowseItem[] }> | undefined): GroupedTimeline {
  if (!pages || pages.length === 0) {
    return {
      today: [],
      yesterday: [],
      this_week: [],
      this_month: [],
      older: [],
    };
  }

  const allItems = pages.flatMap(page => page.items);
  return groupByTimeline(allItems);
}

/**
 * Count total items across all timeline groups.
 */
export function totalGroupedItems(groups: GroupedTimeline): number {
  return groups.today.length + groups.yesterday.length +
    groups.this_week.length + groups.this_month.length + groups.older.length;
}

/**
 * Returns which timeline sections are relevant for a given date range filter.
 * Sections outside the filter range are hidden entirely (not shown empty).
 */
export function sectionsForDateRange(range: DateRangeOption | string): TimelineGroupKey[] {
  switch (range) {
    case 'today':
      return ['today'];
    case 'this_week':
      return ['today', 'yesterday', 'this_week'];
    case 'this_month':
      return ['today', 'yesterday', 'this_week', 'this_month'];
    case 'all_time':
    default:
      return ['today', 'yesterday', 'this_week', 'this_month', 'older'];
  }
}
