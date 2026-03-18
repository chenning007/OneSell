/**
 * ProfileMenu — Dropdown menu for profile management (W-17, #291).
 *
 * PRD §3.6, ADR-005 D1:
 * - Dropdown triggered by user icon button in header area
 * - "Clear Profile" — calls IPC store:clear-profile, sets hasProfile=false, navigates to step 1
 * - "Edit Preferences" — opens AdvancedPreferencesDrawer via callback
 * - "View History" — navigates to a history view (placeholder: step 4)
 * - Click outside closes the menu
 *
 * Closes #291
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useWizardStore } from '../../store/wizardStore.js';

// ── Props ───────────────────────────────────────────────────────────

export interface ProfileMenuProps {
  /** Callback to open the AdvancedPreferencesDrawer. */
  onEditPreferences: () => void;
}

// ── ProfileMenu ─────────────────────────────────────────────────────

export default function ProfileMenu({ onEditPreferences }: ProfileMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const setStep = useWizardStore((s) => s.setStep);
  const setHasProfile = useWizardStore((s) => s.setHasProfile);

  // Close on click-outside
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, handleClickOutside]);

  async function handleClearProfile(): Promise<void> {
    setOpen(false);
    await window.electronAPI.store.clearProfile();
    setHasProfile(false);
    setStep(1);
  }

  function handleEditPreferences(): void {
    setOpen(false);
    onEditPreferences();
  }

  function handleViewHistory(): void {
    setOpen(false);
    setStep(4); // placeholder — navigates to results/history view
  }

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger button */}
      <button
        data-testid="profile-menu-trigger"
        aria-label="Profile menu"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        style={{
          background: 'none',
          border: '1px solid #dfe6e9',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          fontSize: '18px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#2c3e50',
        }}
      >
        👤
      </button>

      {/* Dropdown */}
      {open && (
        <div
          data-testid="profile-menu-dropdown"
          role="menu"
          style={{
            position: 'absolute',
            top: '42px',
            right: 0,
            minWidth: '200px',
            background: '#fff',
            border: '1px solid #dfe6e9',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          <button
            data-testid="menu-edit-preferences"
            role="menuitem"
            onClick={handleEditPreferences}
            style={menuItemStyle}
          >
            ⚙ Edit Preferences
          </button>
          <button
            data-testid="menu-view-history"
            role="menuitem"
            onClick={handleViewHistory}
            style={menuItemStyle}
          >
            📋 View History
          </button>
          <div style={{ borderTop: '1px solid #ecf0f1' }} />
          <button
            data-testid="menu-clear-profile"
            role="menuitem"
            onClick={() => void handleClearProfile()}
            style={{ ...menuItemStyle, color: '#e74c3c' }}
          >
            🗑️ Clear Profile
          </button>
        </div>
      )}
    </div>
  );
}

// ── Shared style ────────────────────────────────────────────────────

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '10px 16px',
  border: 'none',
  background: 'none',
  textAlign: 'left',
  fontSize: '14px',
  color: '#2c3e50',
  cursor: 'pointer',
};
