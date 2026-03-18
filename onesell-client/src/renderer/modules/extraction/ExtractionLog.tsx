/**
 * ExtractionLog — Per-platform mini-log of field extraction progress (E-17, #271).
 *
 * PRD §5.7, ADR-005 D2:
 * - Shows per-platform mini-log of field extraction progress
 * - Each log line: icon (✓ done, ⟳ in-progress, ○ pending) + field name + value preview
 * - Renders inside PlatformTabContent when status is 'active'
 * - Uses extractionStore.tasks[platformId].progressEvents for data
 * - Auto-scrolls to newest entry
 *
 * Closes #271
 */

import React, { useRef, useEffect } from 'react';
import type { ExtractionProgressEvent } from '../../store/extractionStore.js';

export interface ExtractionLogProps {
  events: readonly ExtractionProgressEvent[];
}

// ── Icon mapping based on field suffix / keywords ───────────────────

function getStatusIcon(event: ExtractionProgressEvent): string {
  const msg = event.message.toLowerCase();
  if (msg.includes('complete') || msg.includes('done') || msg.includes('found')) return '✓';
  if (msg.includes('scanning') || msg.includes('extracting') || msg.includes('loading')) return '⟳';
  return '○';
}

function getIconColor(icon: string): string {
  switch (icon) {
    case '✓': return '#27ae60';
    case '⟳': return '#f39c12';
    default: return '#95a5a6';
  }
}

// ── Component ───────────────────────────────────────────────────────

export default function ExtractionLog({ events }: ExtractionLogProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest entry
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div
        data-testid="extraction-log-empty"
        style={{
          padding: '12px',
          color: '#95a5a6',
          fontSize: '13px',
          fontFamily: 'monospace',
        }}
      >
        Waiting for extraction events…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="extraction-log"
      role="log"
      aria-label="Extraction progress log"
      style={{
        background: '#1a1a2e',
        borderRadius: '8px',
        padding: '12px',
        maxHeight: '220px',
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: '12px',
        lineHeight: 1.7,
      }}
    >
      {events.map((event, i) => {
        const icon = getStatusIcon(event);
        const iconColor = getIconColor(icon);
        return (
          <div
            key={i}
            data-testid="extraction-log-line"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: '2px',
            }}
          >
            <span style={{ color: iconColor, flexShrink: 0, width: '14px', textAlign: 'center' }}>
              {icon}
            </span>
            {event.field && (
              <span style={{ color: '#569cd6', flexShrink: 0 }}>
                [{event.field}]
              </span>
            )}
            <span style={{ color: '#d4d4d4' }}>
              {event.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}
