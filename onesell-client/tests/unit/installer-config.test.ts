/**
 * F-12 (#216) — Installer configuration test.
 *
 * AC:
 *   1. electron-builder.yml exists
 *   2. NSIS target configured for Windows
 *   3. DMG target configured for macOS
 *   4. Product name and appId are set
 *   5. Build output directory correctly configured
 *
 * Principles tested: P8 (config over hardcoding — installer configured via YAML)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const CLIENT_ROOT = resolve(__dirname, '..', '..');
const CONFIG_PATH = resolve(CLIENT_ROOT, 'electron-builder.yml');

// ── Tests — raw string matching (no YAML parser needed) ─────────────

describe('Installer configuration — electron-builder.yml (F-12, #216)', () => {
  let raw: string;

  function loadConfig(): string {
    if (!raw) raw = readFileSync(CONFIG_PATH, 'utf-8');
    return raw;
  }

  // AC-1: File exists
  it('electron-builder.yml exists', () => {
    expect(existsSync(CONFIG_PATH)).toBe(true);
  });

  // AC-1: appId and productName set
  it('has appId set', () => {
    const content = loadConfig();
    expect(content).toContain('appId: com.onesell.scout');
  });

  it('has productName set', () => {
    const content = loadConfig();
    expect(content).toContain('productName: OneSell Scout');
  });

  // AC-2: NSIS target for Windows
  it('has Windows NSIS target', () => {
    const content = loadConfig();
    expect(content).toMatch(/win:/);
    expect(content).toMatch(/target:\s*nsis/);
  });

  // AC-3: DMG target for macOS
  it('has macOS DMG target', () => {
    const content = loadConfig();
    expect(content).toMatch(/mac:/);
    expect(content).toMatch(/target:\s*dmg/);
  });

  // AC-4: macOS supports both x64 and arm64
  it('macOS DMG target includes x64 and arm64 architectures', () => {
    const content = loadConfig();
    // Both architectures appear under mac section
    const macSection = content.slice(content.indexOf('mac:'));
    expect(macSection).toContain('x64');
    expect(macSection).toContain('arm64');
  });

  // AC-5: Build output directory
  it('output directory is configured', () => {
    const content = loadConfig();
    expect(content).toMatch(/directories:/);
    expect(content).toMatch(/output:/);
  });

  // NSIS allows changing installation directory (user-friendly)
  it('NSIS allows changing install directory', () => {
    const content = loadConfig();
    expect(content).toMatch(/allowToChangeInstallationDirectory:\s*true/);
  });

  // Copyright field present
  it('copyright field is set', () => {
    const content = loadConfig();
    expect(content).toMatch(/copyright:/);
  });
});
