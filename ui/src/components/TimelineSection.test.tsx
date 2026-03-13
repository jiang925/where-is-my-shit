import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TimelineSection } from './TimelineSection';
import type { BrowseItem } from '../lib/api';

function makeBrowseItem(overrides: Partial<BrowseItem> = {}): BrowseItem {
  return {
    id: 'item-1',
    conversation_id: 'conv-1',
    timestamp: Date.now() / 1000,
    platform: 'chatgpt',
    title: 'Test Conversation',
    content: 'Some content here',
    url: 'https://chat.openai.com/c/abc',
    message_count: 3,
    ...overrides,
  };
}

describe('TimelineSection', () => {
  it('renders the section title with item count', () => {
    const items = [makeBrowseItem(), makeBrowseItem({ id: 'item-2', conversation_id: 'conv-2' })];
    render(<TimelineSection title="Today" items={items} isEmpty={false} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('renders items as ResultCards', () => {
    const items = [
      makeBrowseItem({ title: 'First Conversation' }),
      makeBrowseItem({ id: 'item-2', conversation_id: 'conv-2', title: 'Second Conversation' }),
    ];
    render(<TimelineSection title="Today" items={items} isEmpty={false} />);
    expect(screen.getByText('First Conversation')).toBeInTheDocument();
    expect(screen.getByText('Second Conversation')).toBeInTheDocument();
  });

  it('shows empty state message when isEmpty is true', () => {
    render(<TimelineSection title="Today" items={[]} isEmpty={true} />);
    expect(screen.getByText('No conversations')).toBeInTheDocument();
  });

  it('does not show empty state message when isEmpty is false', () => {
    const items = [makeBrowseItem()];
    render(<TimelineSection title="Today" items={items} isEmpty={false} />);
    expect(screen.queryByText('No conversations')).not.toBeInTheDocument();
  });
});
