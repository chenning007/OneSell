/**
 * PlatformTabPanel — Tab bar + content area, auto-follow extraction (E-09, #245).
 *
 * PRD §5.5, ADR-005 D2:
 * - Tab bar with one tab per platform from extractionStore tasks
 * - Clicking a tab selects it and shows its content area
 * - Active extraction platform tab auto-selected (follows currently-active extraction)
 * - Manual selection overrides auto-select until user switches back
 * - Tab icon matches platform status (same icons as TaskPipeline)
 * - Content area renders placeholder text for now
 *
 * Closes #245
 */

import React, { useState, useEffect, useRef } from 'react';
import { useExtractionStore } from '../../store/extractionStore.js';
import type { PipelineStatus } from '../../store/extractionStore.js';
import PlatformTabContent from './PlatformTabContent.js';

// ── Status icons (same as TaskPipeline) ─────────────────────────────

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

// ── Spinner keyframes ───────────────────────────────────────────────

const spinnerKeyframes = `
@keyframes tab-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

// ── PlatformTabPanel ────────────────────────────────────────────────

export default function PlatformTabPanel(): React.ReactElement {
  const tasks = useExtractionStore((s) => s.tasks);
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const manualOverride = useRef(false);
  const [collapsed, setCollapsed] = useState(false);

  // Find the currently active extraction platform
  const activePlatformId = tasks.find((t) => t.status === 'active')?.platformId ?? null;

  // Auto-follow active extraction unless user has manually selected a tab
  useEffect(() => {
    if (activePlatformId && !manualOverride.current) {
      setSelectedTab(activePlatformId);
    }
  }, [activePlatformId]);

  // Default to first tab if nothing selected
  const effectiveTab = selectedTab ?? tasks[0]?.platformId ?? null;

  function handleTabClick(platformId: string): void {
    setSelectedTab(platformId);
    // If user clicks the auto-active tab, reset override
    if (platformId === activePlatformId) {
      manualOverride.current = false;
    } else {
      manualOverride.current = true;
    }
  }

  const selectedTask = tasks.find((t) => t.platformId === effectiveTab);

  return (
    <div data-testid="platform-tab-panel">
      <style>{spinnerKeyframes}</style>

      {/* Tab bar */}
      <div
        data-testid="tab-bar"
        style={{
          display: 'flex',
          borderBottom: '2px solid #dfe6e9',
          overflowX: 'auto',
          gap: '2px',
          alignItems: 'center',
        }}
      >
        {tasks.map((task) => {
          const isSelected = task.platformId === effectiveTab;
          const isActive = task.status === 'active';

          return (
            <button
              key={task.platformId}
              data-testid={`tab-${task.platformId}`}
              onClick={() => handleTabClick(task.platformId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                border: 'none',
                borderBottom: isSelected ? '2px solid #3498db' : '2px solid transparent',
                background: isSelected ? '#ebf5fb' : 'transparent',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: isSelected ? 600 : 400,
                color: isSelected ? '#2c3e50' : '#7f8c8d',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span
                style={{
                  color: statusColor(task.status),
                  ...(isActive ? { display: 'inline-block', animation: 'tab-spin 1s linear infinite' } : {}),
                }}
              >
                {STATUS_ICON[task.status]}
              </span>
              {task.platformId}
            </button>
          );
        })}

        {/* Collapse/expand toggle (E-31, #289, PRD §5.10) */}
        <button
          data-testid="collapse-toggle"
          aria-label={collapsed ? 'Expand tab panel' : 'Collapse tab panel'}
          onClick={() => setCollapsed((c) => !c)}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            color: '#7f8c8d',
            padding: '8px 10px',
            flexShrink: 0,
          }}
        >
          {collapsed ? '▲' : '▼'}
        </button>
      </div>

      {/* Content area — hidden when collapsed (E-31, #289) */}
      {!collapsed && (
        <div
          data-testid="tab-content"
          style={{
            minHeight: '200px',
            background: '#fafafa',
            borderRadius: '0 0 8px 8px',
          }}
        >
          {selectedTask ? (
            <PlatformTabContent task={selectedTask} />
          ) : (
            <div style={{ padding: '20px', color: '#95a5a6', textAlign: 'center' }}>
              No platform selected
            </div>
          )}
        </div>
      )}
    </div>
  );
}
