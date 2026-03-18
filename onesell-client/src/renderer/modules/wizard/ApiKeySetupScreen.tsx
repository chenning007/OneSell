/**
 * ApiKeySetupScreen — API key entry screen (F-05, #209).
 *
 * PRD §12.3:
 * - Text input for OpenAI API key with "Get a key →" external link
 * - "Save & Continue" calls window.electronAPI.saveApiKey(key) IPC
 * - Validation: empty key shows error
 * - On success navigates to Market Selection (step 1 via wizardStore)
 * - Screen shown only when hasApiKey() returns false (checked on app mount)
 *
 * P1: The key is sent to the main process via IPC and encrypted there.
 *     It is never logged, displayed in clear, or stored in renderer state
 *     beyond the input field lifetime.
 *
 * Closes #209
 */

import React, { useState, useCallback } from 'react';
import { useWizardStore } from '../../store/wizardStore.js';

const OPENAI_KEY_URL = 'https://platform.openai.com/api-keys';

export const ApiKeySetupScreen: React.FC = () => {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const setStep = useWizardStore((s) => s.setStep);

  const handleSave = useCallback(async () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError('Please enter your OpenAI API key.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await window.electronAPI.saveApiKey(trimmed);
      if (result && 'error' in result && result.error) {
        setError(result.message ?? 'Failed to save API key.');
        return;
      }
      // Success — navigate to Market Selection (step 1)
      setStep(1);
    } catch {
      setError('Failed to save API key. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [key, setStep]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        void handleSave();
      }
    },
    [handleSave],
  );

  return (
    <div className="api-key-setup" role="main" aria-labelledby="api-key-heading">
      <h1 id="api-key-heading">Set Up Your API Key</h1>
      <p>
        OneSell Scout uses OpenAI to analyze products. Enter your API key to get
        started.
      </p>

      <div className="api-key-input-group">
        <label htmlFor="api-key-input">OpenAI API Key</label>
        <input
          id="api-key-input"
          type="password"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="sk-..."
          autoComplete="off"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'api-key-error' : undefined}
          disabled={saving}
        />
        {error && (
          <p id="api-key-error" className="api-key-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <p className="api-key-help">
        Don&apos;t have a key?{' '}
        <a href={OPENAI_KEY_URL} target="_blank" rel="noopener noreferrer">
          Get a key →
        </a>
      </p>

      <button
        type="button"
        className="api-key-save-btn"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving…' : 'Save & Continue'}
      </button>
    </div>
  );
};
