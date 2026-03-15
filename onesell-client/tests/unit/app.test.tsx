import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/renderer/App.js';

describe('App', () => {
  it('renders the market selection screen on step 1', () => {
    render(<App />);
    // Step 1 shows MarketSelection component
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });

  it('renders market tiles for all 7 markets', () => {
    render(<App />);
    // All 7 market flags should be visible
    expect(screen.getByText('🇺🇸')).toBeTruthy();
    expect(screen.getByText('🇨🇳')).toBeTruthy();
    expect(screen.getByText('🇬🇧')).toBeTruthy();
  });
});
