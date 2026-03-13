import { describe, it, expect } from 'vitest';
import { groupByTimeline, flattenAndGroup, totalGroupedItems, sectionsForDateRange } from './dateGroups';
import type { BrowseItem } from './api';

function makeItem(timestamp: number, overrides: Partial<BrowseItem> = {}): BrowseItem {
  return {
    id: `item-${timestamp}`,
    conversation_id: `conv-${timestamp}`,
    timestamp,
    platform: 'chatgpt',
    title: 'Test',
    content: 'Content',
    url: '',
    ...overrides,
  };
}

describe('groupByTimeline', () => {
  it('puts items with today timestamp into the today group', () => {
    const now = Date.now() / 1000;
    const groups = groupByTimeline([makeItem(now)]);
    expect(groups.today).toHaveLength(1);
    expect(groups.yesterday).toHaveLength(0);
    expect(groups.older).toHaveLength(0);
  });

  it('puts old items into the older group', () => {
    // 1 year ago
    const oldTimestamp = (Date.now() / 1000) - (365 * 24 * 60 * 60);
    const groups = groupByTimeline([makeItem(oldTimestamp)]);
    expect(groups.older).toHaveLength(1);
    expect(groups.today).toHaveLength(0);
  });

  it('returns empty groups for empty input', () => {
    const groups = groupByTimeline([]);
    expect(groups.today).toHaveLength(0);
    expect(groups.yesterday).toHaveLength(0);
    expect(groups.this_week).toHaveLength(0);
    expect(groups.this_month).toHaveLength(0);
    expect(groups.older).toHaveLength(0);
  });
});

describe('flattenAndGroup', () => {
  it('returns empty groups for undefined pages', () => {
    const groups = flattenAndGroup(undefined);
    expect(totalGroupedItems(groups)).toBe(0);
  });

  it('flattens multiple pages and groups by timeline', () => {
    const now = Date.now() / 1000;
    const pages = [
      { items: [makeItem(now, { id: 'a', conversation_id: 'ca' })] },
      { items: [makeItem(now, { id: 'b', conversation_id: 'cb' })] },
    ];
    const groups = flattenAndGroup(pages);
    expect(totalGroupedItems(groups)).toBe(2);
    expect(groups.today).toHaveLength(2);
  });
});

describe('sectionsForDateRange', () => {
  it('returns only today for "today" range', () => {
    expect(sectionsForDateRange('today')).toEqual(['today']);
  });

  it('returns today, yesterday, this_week for "this_week" range', () => {
    expect(sectionsForDateRange('this_week')).toEqual(['today', 'yesterday', 'this_week']);
  });

  it('returns all sections for "all_time" range', () => {
    expect(sectionsForDateRange('all_time')).toEqual([
      'today', 'yesterday', 'this_week', 'this_month', 'older',
    ]);
  });

  it('returns all sections for unknown range (default case)', () => {
    expect(sectionsForDateRange('unknown_value')).toEqual([
      'today', 'yesterday', 'this_week', 'this_month', 'older',
    ]);
  });
});
