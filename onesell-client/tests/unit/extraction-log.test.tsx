/**
 * E-18 (#272) — ExtractionLog component unit tests.
 *
 * AC:
 *   1. ✓/⟳/○ icons per field state
 *   2. Field name + value preview
 *   3. Auto-scroll on new entry
 *   4. Empty state
 *
 * Principles tested: P5 (graceful degradation — empty events list)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';

import ExtractionLog from '../../src/renderer/modules/extraction/ExtractionLog.js';
import type { ExtractionProgressEvent } from '../../src/renderer/store/extractionStore.js';

// ── Fixtures ────────────────────────────────────────────────────────

const completedEvent: ExtractionProgressEvent = {
  timestamp: '2026-03-15T10:00:00.000Z',
  message: 'Extraction complete — 5 products found',
  field: 'listings',
};

const inProgressEvent: ExtractionProgressEvent = {
  timestamp: '2026-03-15T10:00:01.000Z',
  message: 'Scanning page 2 for products',
  field: 'page-scan',
};

const pendingEvent: ExtractionProgressEvent = {
  timestamp: '2026-03-15T10:00:02.000Z',
  message: 'Queued for processing',
  field: 'pricing',
};

const doneEvent: ExtractionProgressEvent = {
  timestamp: '2026-03-15T10:00:03.000Z',
  message: 'Found 12 items',
  field: 'items',
};

// ── Tests ────────────────────────────────────────────────────────────

describe('ExtractionLog', () => {
  // TC-4: Empty state
  it('renders empty state when no events', () => {
    render(<ExtractionLog events={[]} />);

    const empty = screen.getByTestId('extraction-log-empty');
    expect(empty).toBeDefined();
    expect(empty.textContent).toContain('Waiting for extraction events');
  });

  // TC-1: ✓/⟳/○ icons per field state
  it('shows ✓ icon for completed events', () => {
    render(<ExtractionLog events={[completedEvent]} />);

    const lines = screen.getAllByTestId('extraction-log-line');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.textContent).toContain('✓');
  });

  it('shows ⟳ icon for in-progress events (scanning)', () => {
    render(<ExtractionLog events={[inProgressEvent]} />);

    const lines = screen.getAllByTestId('extraction-log-line');
    expect(lines[0]!.textContent).toContain('⟳');
  });

  it('shows ○ icon for pending events', () => {
    render(<ExtractionLog events={[pendingEvent]} />);

    const lines = screen.getAllByTestId('extraction-log-line');
    expect(lines[0]!.textContent).toContain('○');
  });

  // TC-2: Field name + value preview
  it('shows field name in brackets and message text', () => {
    render(<ExtractionLog events={[completedEvent]} />);

    const lines = screen.getAllByTestId('extraction-log-line');
    const text = lines[0]!.textContent!;
    expect(text).toContain('[listings]');
    expect(text).toContain('Extraction complete');
  });

  it('renders multiple events in order', () => {
    render(<ExtractionLog events={[completedEvent, inProgressEvent, pendingEvent]} />);

    const lines = screen.getAllByTestId('extraction-log-line');
    expect(lines).toHaveLength(3);
    expect(lines[0]!.textContent).toContain('✓');
    expect(lines[1]!.textContent).toContain('⟳');
    expect(lines[2]!.textContent).toContain('○');
  });

  // TC-3: Auto-scroll on new entry
  it('auto-scrolls container when new events are added', () => {
    const { rerender } = render(<ExtractionLog events={[completedEvent]} />);

    const container = screen.getByTestId('extraction-log');
    // Mock scrollHeight > scrollTop to simulate overflow
    Object.defineProperty(container, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(container, 'scrollTop', { value: 0, writable: true, configurable: true });

    // Add more events
    rerender(
      <ExtractionLog events={[completedEvent, inProgressEvent, doneEvent]} />,
    );

    // scrollTop should have been set to scrollHeight by the useEffect
    expect(container.scrollTop).toBe(500);
  });

  it('has role="log" for accessibility', () => {
    render(<ExtractionLog events={[completedEvent]} />);

    const log = screen.getByRole('log');
    expect(log).toBeDefined();
    expect(log.getAttribute('aria-label')).toBe('Extraction progress log');
  });
});
