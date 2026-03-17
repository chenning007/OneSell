import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import Toast from '../../src/renderer/components/Toast.js';
import ErrorBanner from '../../src/renderer/components/ErrorBanner.js';
import ConfirmDialog from '../../src/renderer/components/ConfirmDialog.js';
import FadeTransition from '../../src/renderer/components/FadeTransition.js';
import GlobalStyles from '../../src/renderer/components/GlobalStyles.js';
import {
  BREAKPOINT_COLLAPSE,
  PADDING_COMPACT,
  PADDING_DEFAULT,
} from '../../src/renderer/config/responsive.js';

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-dismisses after 3 s by default', () => {
    const onDismiss = vi.fn();
    render(<Toast message="hello" variant="success" onDismiss={onDismiss} />);
    expect(screen.getByTestId('toast-success')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(3000); });

    expect(screen.queryByTestId('toast-success')).toBeNull();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it.each(['success', 'error', 'info'] as const)(
    'renders %s variant with role="status" and aria-live',
    (variant) => {
      render(<Toast message={`msg-${variant}`} variant={variant} />);
      const el = screen.getByTestId(`toast-${variant}`);
      expect(el.getAttribute('role')).toBe('status');
      expect(el.getAttribute('aria-live')).toBe('polite');
      expect(el.textContent).toBe(`msg-${variant}`);
    },
  );

  it('respects custom duration', () => {
    render(<Toast message="fast" variant="info" duration={500} />);
    act(() => { vi.advanceTimersByTime(499); });
    expect(screen.getByTestId('toast-info')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByTestId('toast-info')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ErrorBanner
// ---------------------------------------------------------------------------
describe('ErrorBanner', () => {
  it('renders message with dismiss and retry buttons', () => {
    const onRetry = vi.fn();
    render(<ErrorBanner message="Something broke" onRetry={onRetry} />);

    expect(screen.getByTestId('error-banner')).toBeTruthy();
    expect(screen.getByText('Something broke')).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
    expect(screen.getByLabelText('Dismiss error')).toBeTruthy();
  });

  it('dismiss button hides the banner', () => {
    render(<ErrorBanner message="fail" />);
    expect(screen.getByTestId('error-banner')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Dismiss error'));
    expect(screen.queryByTestId('error-banner')).toBeNull();
  });

  it('calls onDismiss callback when dismissed', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner message="fail" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText('Dismiss error'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('omits retry button when onRetry is not provided', () => {
    render(<ErrorBanner message="fail" />);
    expect(screen.queryByText('Retry')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ConfirmDialog
// ---------------------------------------------------------------------------
describe('ConfirmDialog', () => {
  const defaultProps = {
    heading: 'Delete item?',
    message: 'This cannot be undone.',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    defaultProps.onConfirm = vi.fn();
    defaultProps.onCancel = vi.fn();
  });

  it('renders as a modal with correct ARIA attributes', () => {
    render(<ConfirmDialog {...defaultProps} />);
    const dialog = screen.getByTestId('confirm-dialog');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('confirm-dialog-heading');
    expect(screen.getByText('Delete item?').id).toBe('confirm-dialog-heading');
  });

  it('Escape key calls onCancel', () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.keyDown(screen.getByTestId('confirm-dialog'), { key: 'Escape' });
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('confirm button calls onConfirm', () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Confirm'));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cancel button calls onCancel', () => {
    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('traps focus within the dialog on Tab', () => {
    render(<ConfirmDialog {...defaultProps} />);
    const dialog = screen.getByTestId('confirm-dialog');
    const buttons = dialog.querySelectorAll('button');
    const lastButton = buttons[buttons.length - 1];

    // Focus the last button, then press Tab — should cycle to first
    (lastButton as HTMLElement).focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    // After trap, first focusable button should receive focus
    expect(document.activeElement).toBe(buttons[0]);
  });
});

// ---------------------------------------------------------------------------
// FadeTransition
// ---------------------------------------------------------------------------
describe('FadeTransition', () => {
  it('renders children inside a fade wrapper', () => {
    render(<FadeTransition><span data-testid="child">Hello</span></FadeTransition>);
    const wrapper = screen.getByTestId('fade-transition');
    expect(wrapper).toBeTruthy();
    expect(wrapper.style.animation).toContain('fadeIn');
    expect(screen.getByTestId('child').textContent).toBe('Hello');
  });
});

// ---------------------------------------------------------------------------
// GlobalStyles
// ---------------------------------------------------------------------------
describe('GlobalStyles', () => {
  it('injects a style tag with focus-visible rules', () => {
    render(<GlobalStyles />);
    const style = screen.getByTestId('global-styles');
    expect(style.tagName).toBe('STYLE');
    expect(style.textContent).toContain(':focus-visible');
    expect(style.textContent).toContain('#0066cc');
  });

  it('injects fadeIn keyframe', () => {
    render(<GlobalStyles />);
    const style = screen.getByTestId('global-styles');
    expect(style.textContent).toContain('@keyframes fadeIn');
  });
});

// ---------------------------------------------------------------------------
// AC #1 supplement — Toast bottom-right positioning
// ---------------------------------------------------------------------------
describe('Toast — position', () => {
  it('renders at bottom-right of viewport (position: fixed)', () => {
    render(<Toast message="pos" variant="success" />);
    const el = screen.getByTestId('toast-success');
    expect(el.style.position).toBe('fixed');
    expect(el.style.bottom).toBe('24px');
    expect(el.style.right).toBe('24px');
  });
});

// ---------------------------------------------------------------------------
// AC #6 — Responsive layout config & AC #10 — P8 compliance
// ---------------------------------------------------------------------------
describe('Responsive config (P8 compliance)', () => {
  it('BREAKPOINT_COLLAPSE is a number equal to 800', () => {
    expect(typeof BREAKPOINT_COLLAPSE).toBe('number');
    expect(BREAKPOINT_COLLAPSE).toBe(800);
  });

  it('PADDING_COMPACT < PADDING_DEFAULT', () => {
    expect(typeof PADDING_COMPACT).toBe('number');
    expect(typeof PADDING_DEFAULT).toBe('number');
    expect(PADDING_COMPACT).toBeLessThan(PADDING_DEFAULT);
  });

  it('P8: component source files do not hardcode responsive breakpoints', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const componentsDir = join(__dirname, '../../src/renderer/components');
    const files = readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));

    // Detect hardcoded breakpoints in media-query or innerWidth comparisons
    const breakpointRe =
      /(?:max-width|min-width|innerWidth)\s*[:=<>!]+\s*['"]?800/;

    for (const file of files) {
      const content = readFileSync(join(componentsDir, file), 'utf-8');
      expect(
        content,
        `${file} contains a hardcoded 800px breakpoint — use BREAKPOINT_COLLAPSE from config`,
      ).not.toMatch(breakpointRe);
    }
  });
});

// ---------------------------------------------------------------------------
// AC #7 — WCAG AA contrast ratio ≥ 4.5 : 1 on body text
// ---------------------------------------------------------------------------
describe('A11y — contrast ratios (WCAG AA ≥ 4.5:1)', () => {
  /** sRGB relative luminance per WCAG 2.x */
  function luminance(hex: string): number {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lin = (c: number) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function contrastRatio(a: string, b: string): number {
    const l1 = Math.max(luminance(a), luminance(b));
    const l2 = Math.min(luminance(a), luminance(b));
    return (l1 + 0.05) / (l2 + 0.05);
  }

  it.each([
    ['Toast success (white on #1b7a3d)', '#ffffff', '#1b7a3d'],
    ['Toast error (white on #c0392b)', '#ffffff', '#c0392b'],
    ['Toast info (white on #2563eb)', '#ffffff', '#2563eb'],
    ['ErrorBanner (white on #c0392b)', '#ffffff', '#c0392b'],
    ['ConfirmDialog heading (#1a1a1a on white)', '#1a1a1a', '#ffffff'],
    ['ConfirmDialog body (#333333 on white)', '#333333', '#ffffff'],
    ['ConfirmDialog confirm btn (white on #2563eb)', '#ffffff', '#2563eb'],
  ])('%s meets 4.5:1', (_label, fg, bg) => {
    const ratio = contrastRatio(fg, bg);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

// ---------------------------------------------------------------------------
// AC #8 — All icon-only buttons have aria-label
// ---------------------------------------------------------------------------
describe('A11y — icon-only buttons have aria-label', () => {
  it('ErrorBanner dismiss (×) button has aria-label', () => {
    render(<ErrorBanner message="err" />);
    const btn = screen.getByLabelText('Dismiss error');
    expect(btn.tagName).toBe('BUTTON');
    // Content is a symbol only — aria-label is mandatory
    expect(btn.textContent?.trim()).toBe('×');
  });

  it('ConfirmDialog text buttons do NOT need aria-label (visible text suffices)', () => {
    render(
      <ConfirmDialog
        heading="h"
        message="m"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const dialog = screen.getByTestId('confirm-dialog');
    const buttons = Array.from(dialog.querySelectorAll('button'));
    for (const btn of buttons) {
      // Each button has visible text, so aria-label is optional
      expect(btn.textContent?.trim().length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// AC #9 supplement — Shift+Tab focus trap
// ---------------------------------------------------------------------------
describe('ConfirmDialog — Shift+Tab focus trap', () => {
  it('Shift+Tab from first button wraps to last', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog heading="x" message="y" onConfirm={onConfirm} onCancel={onCancel} />,
    );
    const dialog = screen.getByTestId('confirm-dialog');
    const buttons = dialog.querySelectorAll('button');
    const first = buttons[0] as HTMLElement;
    const last = buttons[buttons.length - 1] as HTMLElement;

    first.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
