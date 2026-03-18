/**
 * TaskPipeline — Renders one row per pipeline task with status icons (E-05, #241).
 *
 * PRD §5.4, ADR-005 D2:
 * - One row per PipelineTask from extractionStore
 * - Status icons: ✓ done, ⟳ active (animated), ○ queued, 🔒 needs-login, ── disabled, ✗ error
 * - Text: label for queued/active, doneLabel + productCount for done
 * - Overall progress summary at top: "N of M platforms done · ~X min remaining"
 * - Spinner animation for active platform
 *
 * Closes #241
 */

import React from 'react';
import { useExtractionStore } from '../../store/extractionStore.js';
import type { PipelineStatus, PipelineTask } from '../../store/extractionStore.js';

// ── Constants ───────────────────────────────────────────────────────

const ESTIMATED_MINUTES_PER_PLATFORM = 2;

const STATUS_ICON: Record<PipelineStatus, string> = {
  done: '✓',
  active: '⟳',
  queued: '○',
  'needs-login': '🔒',
  disabled: '──',
  error: '✗',
  skipped: '──',
};

// ── CSS keyframes for spinner ───────────────────────────────────────

const spinnerKeyframes = `
@keyframes pipeline-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

// ── Status colors ───────────────────────────────────────────────────

function statusColor(status: PipelineStatus): string {
  switch (status) {
    case 'done': return '#27ae60';
    case 'active': return '#3498db';
    case 'error': return '#e74c3c';
    case 'needs-login': return '#f39c12';
    case 'disabled':
    case 'skipped': return '#95a5a6';
    case 'queued':
    default: return '#7f8c8d';
  }
}

// ── Row text ────────────────────────────────────────────────────────

function rowText(task: PipelineTask): string {
  if (task.status === 'done') {
    return `${task.doneLabel} · ${task.productCount} product${task.productCount !== 1 ? 's' : ''}`;
  }
  if (task.status === 'error') {
    return `${task.label} — error`;
  }
  if (task.status === 'needs-login') {
    return `${task.label} — login required`;
  }
  return task.label;
}

// ── Progress summary ────────────────────────────────────────────────

function ProgressSummary({ tasks }: { tasks: readonly PipelineTask[] }): React.ReactElement {
  const enabled = tasks.filter((t) => t.enabled);
  const done = enabled.filter((t) => t.status === 'done' || t.status === 'skipped' || t.status === 'error').length;
  const remaining = enabled.length - done;
  const estMinutes = remaining * ESTIMATED_MINUTES_PER_PLATFORM;

  return (
    <div style={{
      padding: '8px 12px',
      marginBottom: '12px',
      borderRadius: '6px',
      background: '#f0f4f8',
      fontSize: '14px',
      color: '#34495e',
      fontWeight: 500,
    }}>
      {done} of {enabled.length} platforms done
      {remaining > 0 && ` · ~${estMinutes} min remaining`}
    </div>
  );
}

// ── TaskPipelineRow ─────────────────────────────────────────────────

function TaskPipelineRow({ task }: { task: PipelineTask }): React.ReactElement {
  const isActive = task.status === 'active';

  return (
    <div
      data-testid={`pipeline-row-${task.platformId}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        borderBottom: '1px solid #ecf0f1',
        opacity: task.enabled ? 1 : 0.5,
      }}
    >
      {/* Status icon */}
      <span
        data-testid={`status-icon-${task.platformId}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          fontSize: '16px',
          color: statusColor(task.status),
          ...(isActive ? { animation: 'pipeline-spin 1s linear infinite' } : {}),
        }}
      >
        {STATUS_ICON[task.status]}
      </span>

      {/* Platform label */}
      <span style={{
        flex: 1,
        fontSize: '14px',
        color: task.status === 'done' ? '#27ae60' : '#2c3e50',
        fontWeight: isActive ? 600 : 400,
      }}>
        {rowText(task)}
      </span>
    </div>
  );
}

// ── TaskPipeline ────────────────────────────────────────────────────

export default function TaskPipeline(): React.ReactElement {
  const tasks = useExtractionStore((s) => s.tasks);

  return (
    <div data-testid="task-pipeline">
      <style>{spinnerKeyframes}</style>
      <ProgressSummary tasks={tasks} />
      <div style={{
        border: '1px solid #dfe6e9',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        {tasks.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: '#95a5a6' }}>
            No extraction tasks configured
          </div>
        ) : (
          tasks.map((task) => (
            <TaskPipelineRow key={task.platformId} task={task} />
          ))
        )}
      </div>
    </div>
  );
}
