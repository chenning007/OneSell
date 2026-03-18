/**
 * F-06 (#210) — ApiKeySetupScreen unit tests.
 *
 * AC:
 *   1. Renders input and "Get a key" link
 *   2. Empty key shows validation error
 *   3. Valid key calls IPC mock (window.electronAPI.saveApiKey)
 *   4. Navigation fires on success (step changes to 1)
 *
 * Principles:
 *   P1 — Key input uses type="password"; never displayed in clear
 *   P9 — Validates empty input before IPC call
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import { ApiKeySetupScreen } from '../../src/renderer/modules/wizard/ApiKeySetupScreen.js';
import { useWizardStore } from '../../src/renderer/store/wizardStore.js';

// ── Mock window.electronAPI ─────────────────────────────────────────

const mockSaveApiKey = vi.fn();

beforeEach(() => {
  // Reset store
  useWizardStore.setState({
    currentStep: 0,
    market: null,
    preferences: {},
    hasProfile: false,
  });

  // Reset mock
  mockSaveApiKey.mockReset();

  // Install electronAPI on window
  (globalThis as Record<string, unknown>).window = globalThis;
  (globalThis as Record<string, unknown>).electronAPI = { saveApiKey: mockSaveApiKey };
  Object.defineProperty(window, 'electronAPI', {
    value: { saveApiKey: mockSaveApiKey },
    writable: true,
    configurable: true,
  });
});

// ── AC-1: Renders input and "Get a key" link ────────────────────────

describe('ApiKeySetupScreen — rendering (AC-1)', () => {
  it('renders the API key input field', () => {
    render(<ApiKeySetupScreen />);
    const input = screen.getByLabelText(/openai api key/i);
    expect(input).toBeDefined();
    expect(input.getAttribute('type')).toBe('password'); // P1: never shown in clear
  });

  it('renders a "Get a key" external link pointing to OpenAI', () => {
    render(<ApiKeySetupScreen />);
    const link = screen.getByRole('link', { name: /get a key/i });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toContain('platform.openai.com');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('renders a "Save & Continue" button', () => {
    render(<ApiKeySetupScreen />);
    const btn = screen.getByRole('button', { name: /save & continue/i });
    expect(btn).toBeDefined();
  });
});

// ── AC-2: Empty key shows validation error ──────────────────────────

describe('ApiKeySetupScreen — empty key validation (AC-2)', () => {
  it('shows validation error when saving with empty input', async () => {
    render(<ApiKeySetupScreen />);
    const btn = screen.getByRole('button', { name: /save & continue/i });

    fireEvent.click(btn);

    await waitFor(() => {
      const error = screen.getByRole('alert');
      expect(error.textContent).toMatch(/enter your openai api key/i);
    });

    // IPC must NOT be called
    expect(mockSaveApiKey).not.toHaveBeenCalled();
  });

  it('shows validation error when input is whitespace only', async () => {
    render(<ApiKeySetupScreen />);
    const input = screen.getByLabelText(/openai api key/i);
    fireEvent.change(input, { target: { value: '   ' } });

    const btn = screen.getByRole('button', { name: /save & continue/i });
    fireEvent.click(btn);

    await waitFor(() => {
      const error = screen.getByRole('alert');
      expect(error.textContent).toMatch(/enter your openai api key/i);
    });

    expect(mockSaveApiKey).not.toHaveBeenCalled();
  });
});

// ── AC-3: Valid key calls IPC mock ──────────────────────────────────

describe('ApiKeySetupScreen — IPC call (AC-3)', () => {
  it('calls window.electronAPI.saveApiKey with trimmed key', async () => {
    mockSaveApiKey.mockResolvedValue({ ok: true });

    render(<ApiKeySetupScreen />);
    const input = screen.getByLabelText(/openai api key/i);
    fireEvent.change(input, { target: { value: '  sk-test-key-123  ' } });

    const btn = screen.getByRole('button', { name: /save & continue/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockSaveApiKey).toHaveBeenCalledWith('sk-test-key-123');
    });
  });

  it('shows error when IPC returns error result', async () => {
    mockSaveApiKey.mockResolvedValue({ error: true, message: 'Encryption failed' });

    render(<ApiKeySetupScreen />);
    const input = screen.getByLabelText(/openai api key/i);
    fireEvent.change(input, { target: { value: 'sk-valid-key' } });

    const btn = screen.getByRole('button', { name: /save & continue/i });
    fireEvent.click(btn);

    await waitFor(() => {
      const error = screen.getByRole('alert');
      expect(error.textContent).toMatch(/encryption failed/i);
    });
  });

  it('shows generic error when IPC throws', async () => {
    mockSaveApiKey.mockRejectedValue(new Error('IPC channel closed'));

    render(<ApiKeySetupScreen />);
    const input = screen.getByLabelText(/openai api key/i);
    fireEvent.change(input, { target: { value: 'sk-valid-key' } });

    const btn = screen.getByRole('button', { name: /save & continue/i });
    fireEvent.click(btn);

    await waitFor(() => {
      const error = screen.getByRole('alert');
      expect(error.textContent).toMatch(/failed to save/i);
    });
  });
});

// ── AC-4: Navigation fires on success (step → 1) ───────────────────

describe('ApiKeySetupScreen — navigation on success (AC-4)', () => {
  it('sets wizard step to 1 after successful save', async () => {
    mockSaveApiKey.mockResolvedValue({ ok: true });

    render(<ApiKeySetupScreen />);
    const input = screen.getByLabelText(/openai api key/i);
    fireEvent.change(input, { target: { value: 'sk-valid-key' } });

    const btn = screen.getByRole('button', { name: /save & continue/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(useWizardStore.getState().currentStep).toBe(1);
    });
  });

  it('does NOT navigate when save fails', async () => {
    mockSaveApiKey.mockResolvedValue({ error: true, message: 'Nope' });
    useWizardStore.setState({ currentStep: 0 });

    render(<ApiKeySetupScreen />);
    const input = screen.getByLabelText(/openai api key/i);
    fireEvent.change(input, { target: { value: 'sk-valid-key' } });

    const btn = screen.getByRole('button', { name: /save & continue/i });
    fireEvent.click(btn);

    await waitFor(() => {
      screen.getByRole('alert'); // error is shown
    });

    expect(useWizardStore.getState().currentStep).toBe(0);
  });
});

// ── P1: Credential field security ───────────────────────────────────

describe('ApiKeySetupScreen — P1 credential security', () => {
  it('input type is password (key never shown in clear)', () => {
    render(<ApiKeySetupScreen />);
    const input = screen.getByLabelText(/openai api key/i);
    expect(input.getAttribute('type')).toBe('password');
  });

  it('autocomplete is off to prevent browser caching', () => {
    render(<ApiKeySetupScreen />);
    const input = screen.getByLabelText(/openai api key/i);
    expect(input.getAttribute('autoComplete')).toBe('off');
  });
});
