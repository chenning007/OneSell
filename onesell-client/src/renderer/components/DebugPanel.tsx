import React, { useEffect, useRef, useState } from 'react';

/**
 * DebugPanel — visible on-screen log panel for debugging.
 * Intercepts console.log/warn/error and displays them in-app.
 * Remove once Connect button issue is diagnosed.
 */

interface LogEntry {
  level: 'log' | 'warn' | 'error';
  message: string;
  time: string;
}

export default function DebugPanel(): React.ReactElement {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [minimized, setMinimized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const addLog = (level: LogEntry['level'], args: unknown[]) => {
      const message = args
        .map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)))
        .join(' ');
      const time = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev.slice(-200), { level, message, time }]);
    };

    const origLog = console.log.bind(console);
    const origWarn = console.warn.bind(console);
    const origError = console.error.bind(console);

    console.log = (...args) => { origLog(...args); addLog('log', args); };
    console.warn = (...args) => { origWarn(...args); addLog('warn', args); };
    console.error = (...args) => { origError(...args); addLog('error', args); };

    // Log initial state on mount
    addLog('log', ['[DebugPanel] Ready. window.electronAPI available:', typeof window.electronAPI !== 'undefined']);
    if (typeof window.electronAPI !== 'undefined') {
      addLog('log', ['[DebugPanel] electronAPI keys:', JSON.stringify(Object.keys(window.electronAPI))]);
    } else {
      addLog('error', ['[DebugPanel] window.electronAPI is UNDEFINED — preload script may not be loaded!']);
    }

    return () => {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [logs]);

  const colors: Record<LogEntry['level'], string> = {
    log: '#e8f5e9',
    warn: '#fff8e1',
    error: '#ffebee',
  };
  const textColors: Record<LogEntry['level'], string> = {
    log: '#1b5e20',
    warn: '#e65100',
    error: '#b71c1c',
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#1e1e1e',
        borderTop: '2px solid #444',
        fontFamily: 'monospace',
        fontSize: '12px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          background: '#2d2d2d',
          color: '#ccc',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setMinimized((m) => !m)}
      >
        <span>🐛 Debug Log ({logs.length} entries) — click to expand/collapse</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setLogs([]); }}
            style={{ background: '#555', color: '#fff', border: 'none', borderRadius: '3px', padding: '1px 8px', cursor: 'pointer', fontSize: '11px' }}
          >
            Clear
          </button>
          <span>{minimized ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Log entries */}
      {!minimized && (
        <div style={{ height: '180px', overflowY: 'auto', padding: '4px 0' }}>
          {logs.length === 0 && (
            <div style={{ color: '#888', padding: '8px 10px' }}>No logs yet. Click Connect to see logs here.</div>
          )}
          {logs.map((entry, i) => (
            <div
              key={i}
              style={{
                padding: '2px 10px',
                background: colors[entry.level],
                color: textColors[entry.level],
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              <span style={{ opacity: 0.6, marginRight: '8px' }}>{entry.time}</span>
              {entry.message}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
