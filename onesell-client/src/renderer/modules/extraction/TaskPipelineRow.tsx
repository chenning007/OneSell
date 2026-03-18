/**
 * TaskPipelineRow — Individual row with status icon and toggle switch (E-07, #243).
 *
 * PRD §5.4, §5.8, ADR-005 D2:
 * - Renders platform name + descriptive text (from PipelineTask.label)
 * - Status icon on left (same icon set as TaskPipeline)
 * - Toggle switch on right edge to enable/disable platform
 * - Toggling off dispatches window.electronAPI.extraction.togglePlatform IPC
 * - Disabled row shows greyed text "Disabled by you"
 *
 * Closes #243
 */

import React, { useState, useEffect, useRef } from 'react';
import type { PipelineStatus, PipelineTask } from '../../store/extractionStore.js';
import { useExtractionStore } from '../../store/extractionStore.js';

// ── Status icons (shared with TaskPipeline) ─────────────────────────

const STATUS_ICON: Record<PipelineStatus, string> = {
  done: '✓',
  active: '⟳',
  queued: '○',
  'needs-login': '🔒',
  disabled: '──',
  error: '✗',
  skipped: '──',
};

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

function rowText(task: PipelineTask): string {
  if (!task.enabled) return 'Disabled by you';
  if (task.status === 'done') {
    return `${task.doneLabel} · ${task.productCount} product${task.productCount !== 1 ? 's' : ''}`;
  }
  if (task.status === 'error') return `${task.label} — error`;
  if (task.status === 'needs-login') return `${task.label} — login required`;
  return task.label;
}

// ── Time estimate helpers (E-29, #287, PRD §5.8) ───────────────────

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatEstimate(seconds: number): string {
  return `~${formatSeconds(seconds)}`;
}

/** Hook: returns elapsed seconds updated every second while active. */
function useElapsedSeconds(startedAt: string | null, isRunning: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!startedAt || !isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    function tick(): void {
      const start = new Date(startedAt!).getTime();
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startedAt, isRunning]);

  return elapsed;
}

function timeDisplay(task: PipelineTask, elapsedSeconds: number): string | null {
  if (!task.enabled) return null;
  switch (task.status) {
    case 'queued':
      return formatEstimate(task.estimatedSeconds);
    case 'active':
      return formatSeconds(elapsedSeconds);
    case 'done': {
      if (task.startedAt && task.completedAt) {
        const actual = Math.max(0, Math.floor(
          (new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()) / 1000,
        ));
        return formatSeconds(actual);
      }
      return null;
    }
    default:
      return null;
  }
}

// ── Toggle Switch ───────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): React.ReactElement {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: '40px',
        height: '22px',
        borderRadius: '11px',
        border: 'none',
        background: checked ? '#3498db' : '#bdc3c7',
        cursor: 'pointer',
        padding: 0,
        transition: 'background 0.2s ease',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: checked ? '20px' : '2px',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

// ── TaskPipelineRow ─────────────────────────────────────────────────

export interface TaskPipelineRowProps {
  task: PipelineTask;
}

export default function TaskPipelineRow({ task }: TaskPipelineRowProps): React.ReactElement {
  const updateTask = useExtractionStore((s) => s.updateTask);
  const isActive = task.status === 'active';
  const effectiveStatus: PipelineStatus = task.enabled ? task.status : 'disabled';
  const elapsedSeconds = useElapsedSeconds(task.startedAt, isActive && task.enabled);
  const time = timeDisplay(task, elapsedSeconds);

  function handleToggle(enabled: boolean): void {
    updateTask(task.platformId, { enabled, status: enabled ? 'queued' : 'disabled' });
    void window.electronAPI.extraction.togglePlatform({
      platformId: task.platformId,
      enabled,
    });
  }

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
          color: statusColor(effectiveStatus),
          ...(isActive && task.enabled ? { animation: 'pipeline-spin 1s linear infinite' } : {}),
        }}
      >
        {STATUS_ICON[effectiveStatus]}
      </span>

      {/* Platform name + label */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '14px',
          fontWeight: isActive && task.enabled ? 600 : 400,
          color: !task.enabled ? '#95a5a6' : task.status === 'done' ? '#27ae60' : '#2c3e50',
        }}>
          {task.platformId}
        </div>
        <div style={{
          fontSize: '12px',
          color: !task.enabled ? '#95a5a6' : '#7f8c8d',
          marginTop: '2px',
        }}>
          {rowText(task)}
        </div>
      </div>

      {/* Time estimate / elapsed / actual (E-29, #287, PRD §5.8) */}
      {time && (
        <span
          data-testid={`time-display-${task.platformId}`}
          style={{
            fontSize: '12px',
            fontWeight: isActive ? 600 : 400,
            color: isActive ? '#3498db' : task.status === 'done' ? '#27ae60' : '#95a5a6',
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
            minWidth: '48px',
            textAlign: 'right',
          }}
        >
          {time}
        </span>
      )}

      {/* Toggle switch */}
      <ToggleSwitch checked={task.enabled} onChange={handleToggle} />
    </div>
  );
}
