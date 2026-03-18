/**
 * PlatformTabContent — Renders different content based on platform status (E-11, #247).
 *
 * PRD §5.5, ADR-005 D2:
 * - needs-login: "Please log in to {platform}" banner + placeholder for webview area
 * - queued: "Waiting in queue..." message
 * - active: "Extracting data..." + mini extraction log area (placeholder)
 * - done: Summary card with product count
 * - skipped: "Skipped" message
 * - error: Error message with retry hint
 * - disabled: "Disabled by you" message
 *
 * Closes #247
 */

import React from 'react';
import type { PipelineTask } from '../../store/extractionStore.js';

export interface PlatformTabContentProps {
  task: PipelineTask;
}

// ── Status-specific content ─────────────────────────────────────────

function NeedsLoginContent({ task }: { task: PipelineTask }): React.ReactElement {
  return (
    <div data-testid="tab-content-needs-login" style={{ textAlign: 'center', padding: '32px 16px' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h3 style={{ margin: '0 0 8px', color: '#f39c12' }}>
        Please log in to {task.platformId}
      </h3>
      <p style={{ color: '#7f8c8d', fontSize: '14px' }}>
        Sign in below to allow data extraction from this platform.
      </p>
      {/* Placeholder for BrowserView webview area */}
      <div style={{
        marginTop: '16px',
        height: '200px',
        border: '2px dashed #dfe6e9',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#bdc3c7',
        fontSize: '14px',
      }}>
        Login webview area
      </div>
    </div>
  );
}

function QueuedContent(): React.ReactElement {
  return (
    <div data-testid="tab-content-queued" style={{ textAlign: 'center', padding: '48px 16px' }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
      <p style={{ color: '#7f8c8d', fontSize: '16px' }}>Waiting in queue...</p>
    </div>
  );
}

function ActiveContent({ task }: { task: PipelineTask }): React.ReactElement {
  return (
    <div data-testid="tab-content-active" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <span style={{ fontSize: '20px' }}>⟳</span>
        <span style={{ fontSize: '16px', fontWeight: 600, color: '#3498db' }}>
          Extracting data...
        </span>
      </div>
      {/* Mini extraction log area */}
      <div style={{
        background: '#1e1e1e',
        borderRadius: '6px',
        padding: '12px',
        maxHeight: '200px',
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#d4d4d4',
      }}>
        {task.progressEvents.length === 0 ? (
          <div style={{ color: '#7f8c8d' }}>Waiting for extraction events...</div>
        ) : (
          task.progressEvents.map((event, i) => (
            <div key={i} style={{ marginBottom: '4px' }}>
              <span style={{ color: '#6a9955' }}>{event.timestamp.slice(11, 19)}</span>
              {' '}
              {event.field && <span style={{ color: '#569cd6' }}>[{event.field}]</span>}
              {' '}
              <span>{event.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DoneContent({ task }: { task: PipelineTask }): React.ReactElement {
  return (
    <div data-testid="tab-content-done" style={{ textAlign: 'center', padding: '32px 16px' }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
      <h3 style={{ margin: '0 0 8px', color: '#27ae60' }}>Extraction Complete</h3>
      <div style={{
        display: 'inline-block',
        padding: '12px 24px',
        background: '#eafaf1',
        borderRadius: '8px',
        fontSize: '18px',
        fontWeight: 600,
        color: '#27ae60',
      }}>
        {task.productCount} product{task.productCount !== 1 ? 's' : ''} found
      </div>
      {task.doneLabel && (
        <p style={{ color: '#7f8c8d', marginTop: '12px', fontSize: '14px' }}>
          {task.doneLabel}
        </p>
      )}
    </div>
  );
}

function SkippedContent(): React.ReactElement {
  return (
    <div data-testid="tab-content-skipped" style={{ textAlign: 'center', padding: '48px 16px' }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>──</div>
      <p style={{ color: '#95a5a6', fontSize: '16px' }}>Skipped</p>
    </div>
  );
}

function ErrorContent({ task }: { task: PipelineTask }): React.ReactElement {
  return (
    <div data-testid="tab-content-error" style={{ textAlign: 'center', padding: '32px 16px' }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>❌</div>
      <h3 style={{ margin: '0 0 8px', color: '#e74c3c' }}>Extraction Failed</h3>
      <p style={{ color: '#7f8c8d', fontSize: '14px' }}>
        Something went wrong extracting data from {task.platformId}.
      </p>
      <p style={{ color: '#95a5a6', fontSize: '13px', marginTop: '8px' }}>
        Tip: Try re-running the extraction or check your internet connection.
      </p>
    </div>
  );
}

function DisabledContent(): React.ReactElement {
  return (
    <div data-testid="tab-content-disabled" style={{ textAlign: 'center', padding: '48px 16px' }}>
      <div style={{ fontSize: '32px', marginBottom: '12px', color: '#95a5a6' }}>──</div>
      <p style={{ color: '#95a5a6', fontSize: '16px' }}>Disabled by you</p>
    </div>
  );
}

// ── PlatformTabContent ──────────────────────────────────────────────

export default function PlatformTabContent({ task }: PlatformTabContentProps): React.ReactElement {
  switch (task.status) {
    case 'needs-login':
      return <NeedsLoginContent task={task} />;
    case 'queued':
      return <QueuedContent />;
    case 'active':
      return <ActiveContent task={task} />;
    case 'done':
      return <DoneContent task={task} />;
    case 'skipped':
      return <SkippedContent />;
    case 'error':
      return <ErrorContent task={task} />;
    case 'disabled':
      return <DisabledContent />;
    default:
      return <QueuedContent />;
  }
}
