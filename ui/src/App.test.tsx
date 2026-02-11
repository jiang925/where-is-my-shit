import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('renders API key prompt when not authenticated', () => {
    render(<App />);
    // App shows ApiKeyPrompt first when no API key in localStorage
    const apiKeyInput = screen.getByLabelText('API Key');
    expect(apiKeyInput).toBeInTheDocument();
    expect(apiKeyInput).toHaveAttribute('type', 'password');
    expect(apiKeyInput).toHaveAttribute('placeholder', 'sk-wims-...');
  });
});
