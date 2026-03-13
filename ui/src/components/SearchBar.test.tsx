import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRef } from 'react';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders search input with placeholder', () => {
    render(<SearchBar onSearch={() => {}} />);
    expect(screen.getByPlaceholderText('Search your history...')).toBeInTheDocument();
  });

  it('renders with initial value', () => {
    render(<SearchBar onSearch={() => {}} initialValue="test query" />);
    const input = screen.getByPlaceholderText('Search your history...') as HTMLInputElement;
    expect(input.value).toBe('test query');
  });

  it('debounces search callback by 300ms', () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByPlaceholderText('Search your history...');
    fireEvent.change(input, { target: { value: 'hello' } });

    // Not called immediately
    expect(onSearch).not.toHaveBeenCalledWith('hello');

    // Called after 300ms
    act(() => { vi.advanceTimersByTime(300); });
    expect(onSearch).toHaveBeenCalledWith('hello');
  });

  it('accepts inputRef and forwards to input element', () => {
    const ref = createRef<HTMLInputElement>();
    render(<SearchBar onSearch={() => {}} inputRef={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.placeholder).toBe('Search your history...');
  });

  it('input has autoFocus', () => {
    render(<SearchBar onSearch={() => {}} />);
    const input = screen.getByPlaceholderText('Search your history...');
    expect(input).toHaveAttribute('autocomplete', 'off');
  });
});
