/**
 * Tests for W-17 (#291): ProfileMenu component
 * PRD §3.6
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProfileMenu from '../../src/renderer/modules/wizard/ProfileMenu.js';
import { useWizardStore } from '../../src/renderer/store/wizardStore.js';

// ── Mock window.electronAPI ─────────────────────────────────────────

beforeEach(() => {
  (globalThis as Record<string, unknown>).window = globalThis;
  (globalThis.window as Record<string, unknown>).electronAPI = {
    store: {
      clearProfile: vi.fn().mockResolvedValue({ ok: true }),
    },
  };
  useWizardStore.setState({
    currentStep: 0,
    market: { marketId: 'us', language: 'en', currency: 'USD' },
    preferences: {},
    hasProfile: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('W-17: ProfileMenu', () => {
  const mockOnEditPreferences = vi.fn();

  it('AC-1: menu renders with trigger button', () => {
    render(<ProfileMenu onEditPreferences={mockOnEditPreferences} />);

    const trigger = screen.getByTestId('profile-menu-trigger');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-label', 'Profile menu');
  });

  it('AC-1: clicking trigger opens dropdown', () => {
    render(<ProfileMenu onEditPreferences={mockOnEditPreferences} />);

    expect(screen.queryByTestId('profile-menu-dropdown')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('profile-menu-trigger'));

    expect(screen.getByTestId('profile-menu-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('menu-clear-profile')).toBeInTheDocument();
    expect(screen.getByTestId('menu-edit-preferences')).toBeInTheDocument();
    expect(screen.getByTestId('menu-view-history')).toBeInTheDocument();
  });

  it('AC-2: Clear Profile calls IPC and resets', async () => {
    render(<ProfileMenu onEditPreferences={mockOnEditPreferences} />);

    fireEvent.click(screen.getByTestId('profile-menu-trigger'));
    fireEvent.click(screen.getByTestId('menu-clear-profile'));

    await waitFor(() => {
      expect(window.electronAPI.store.clearProfile).toHaveBeenCalled();
    });

    const state = useWizardStore.getState();
    expect(state.hasProfile).toBe(false);
    expect(state.currentStep).toBe(1);
  });

  it('AC-3: Edit Preferences opens drawer', () => {
    render(<ProfileMenu onEditPreferences={mockOnEditPreferences} />);

    fireEvent.click(screen.getByTestId('profile-menu-trigger'));
    fireEvent.click(screen.getByTestId('menu-edit-preferences'));

    expect(mockOnEditPreferences).toHaveBeenCalledOnce();
  });

  it('AC-4: View History navigates to step 4', () => {
    render(<ProfileMenu onEditPreferences={mockOnEditPreferences} />);

    fireEvent.click(screen.getByTestId('profile-menu-trigger'));
    fireEvent.click(screen.getByTestId('menu-view-history'));

    expect(useWizardStore.getState().currentStep).toBe(4);
  });

  it('clicking trigger again closes dropdown', () => {
    render(<ProfileMenu onEditPreferences={mockOnEditPreferences} />);

    fireEvent.click(screen.getByTestId('profile-menu-trigger'));
    expect(screen.getByTestId('profile-menu-dropdown')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('profile-menu-trigger'));
    expect(screen.queryByTestId('profile-menu-dropdown')).not.toBeInTheDocument();
  });

  it('menu items close the dropdown after click', () => {
    render(<ProfileMenu onEditPreferences={mockOnEditPreferences} />);

    fireEvent.click(screen.getByTestId('profile-menu-trigger'));
    fireEvent.click(screen.getByTestId('menu-edit-preferences'));

    expect(screen.queryByTestId('profile-menu-dropdown')).not.toBeInTheDocument();
  });
});
