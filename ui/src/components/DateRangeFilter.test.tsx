import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DateRangeFilter } from './DateRangeFilter';

function renderWithRouter(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <DateRangeFilter />
    </MemoryRouter>
  );
}

describe('DateRangeFilter', () => {
  it('renders all date range buttons', () => {
    renderWithRouter();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('This Week')).toBeInTheDocument();
    expect(screen.getByText('This Month')).toBeInTheDocument();
    expect(screen.getByText('All Time')).toBeInTheDocument();
  });

  it('defaults to "All Time" as active when no range param', () => {
    renderWithRouter();
    const allTimeButton = screen.getByLabelText('Filter by All Time');
    expect(allTimeButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks the correct button active when range param is set', () => {
    renderWithRouter(['/?range=today']);
    const todayButton = screen.getByLabelText('Filter by Today');
    expect(todayButton).toHaveAttribute('aria-pressed', 'true');

    const allTimeButton = screen.getByLabelText('Filter by All Time');
    expect(allTimeButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('updates URL when a date range button is clicked', () => {
    renderWithRouter();
    // Click "This Week"
    fireEvent.click(screen.getByLabelText('Filter by This Week'));
    // Now "This Week" should be active
    const thisWeekButton = screen.getByLabelText('Filter by This Week');
    expect(thisWeekButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('has aria-label on each button', () => {
    renderWithRouter();
    expect(screen.getByLabelText('Filter by Today')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by This Week')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by This Month')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by All Time')).toBeInTheDocument();
  });
});
