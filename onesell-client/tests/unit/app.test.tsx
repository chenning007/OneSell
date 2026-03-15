import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/renderer/App.js';

describe('App (placeholder)', () => {
  it('renders the product heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /OneSell Scout/i })).toBeTruthy();
  });

  it('renders the placeholder tagline', () => {
    render(<App />);
    expect(screen.getByText(/Finding the right products for you/i)).toBeTruthy();
  });
});
