import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders search input', () => {
    render(<App />);
    // Adjust this query based on actual SearchBar implementation
    // For now assuming there is a textbox or placeholder
    const searchInput = screen.getByRole('textbox');
    expect(searchInput).toBeInTheDocument();
  });
});
