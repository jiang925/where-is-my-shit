import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResultCard } from './ResultCard';
import type { SearchResult } from '../lib/api';

function makeResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'test-1',
    score: 0.85,
    content: 'This is the content of the conversation.',
    meta: {
      source: 'chatgpt',
      adapter: 'chatgpt',
      created_at: Date.now() / 1000,
      title: 'Test Conversation',
      url: 'https://chat.openai.com/c/abc',
      conversation_id: 'conv-123',
    },
    ...overrides,
  };
}

describe('ResultCard', () => {
  it('renders title and content', () => {
    render(<ResultCard result={makeResult()} />);
    expect(screen.getByText('Test Conversation')).toBeInTheDocument();
    expect(screen.getByText('This is the content of the conversation.')).toBeInTheDocument();
  });

  it('renders platform badge', () => {
    render(<ResultCard result={makeResult()} />);
    expect(screen.getByText('ChatGPT')).toBeInTheDocument();
  });

  it('shows message count badge when > 1', () => {
    const result = makeResult();
    result.meta.message_count = 5;
    render(<ResultCard result={result} />);
    expect(screen.getByText('5 msgs')).toBeInTheDocument();
  });

  it('does not show message count badge when <= 1', () => {
    const result = makeResult();
    result.meta.message_count = 1;
    render(<ResultCard result={result} />);
    expect(screen.queryByText('1 msgs')).not.toBeInTheDocument();
  });

  it('renders first user message when present', () => {
    const result = makeResult();
    result.meta.first_user_message = 'How do I debug React hooks?';
    render(<ResultCard result={result} />);
    expect(screen.getByText('How do I debug React hooks?')).toBeInTheDocument();
  });

  it('highlights matching query terms in content', () => {
    render(
      <ResultCard
        result={makeResult({ content: 'React hooks are powerful tools for state management' })}
        highlightQuery="React hooks"
      />
    );
    const marks = document.querySelectorAll('mark');
    expect(marks.length).toBe(2);
    expect(marks[0].textContent).toBe('React');
    expect(marks[1].textContent).toBe('hooks');
  });

  it('calls onSelect with conversation_id when clicked', () => {
    const onSelect = vi.fn();
    render(<ResultCard result={makeResult()} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('conv-123', 'test-1');
  });

  it('shows focus ring when isFocused is true', () => {
    const { container } = render(
      <ResultCard result={makeResult()} onSelect={() => {}} isFocused={true} />
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('ring-2');
    expect(card.className).toContain('ring-blue-100');
  });

  it('does not show focus ring when isFocused is false', () => {
    const { container } = render(
      <ResultCard result={makeResult()} onSelect={() => {}} isFocused={false} />
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).not.toContain('ring-blue-100');
  });

  it('hides score when hideScore is true', () => {
    render(<ResultCard result={makeResult()} hideScore={true} />);
    expect(screen.queryByText(/Score:/)).not.toBeInTheDocument();
  });

  it('shows selected state with blue border', () => {
    const { container } = render(
      <ResultCard result={makeResult()} onSelect={() => {}} isSelected={true} />
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('border-blue-400');
    expect(card.className).toContain('ring-blue-200');
  });

  it('renders "Untitled Conversation" when no title or url', () => {
    const result = makeResult();
    result.meta.title = '';
    result.meta.url = '';
    render(<ResultCard result={result} />);
    expect(screen.getByText('Untitled Conversation')).toBeInTheDocument();
  });

  it('renders unknown platform gracefully', () => {
    const result = makeResult();
    result.meta.source = 'some-new-platform';
    render(<ResultCard result={result} />);
    expect(screen.getByText('some-new-platform')).toBeInTheDocument();
  });
});
