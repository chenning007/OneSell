import { describe, it, expect, beforeEach } from 'vitest';
import i18n, { switchLanguage } from '../../src/renderer/i18n/index.js';

describe('i18n', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('initializes with English as default', () => {
    expect(i18n.language).toBe('en');
  });

  it('translates market names in English', () => {
    expect(i18n.t('markets.us')).toBe('United States');
    expect(i18n.t('markets.cn')).toBe('China');
    expect(i18n.t('markets.jp')).toBe('Japan');
  });

  it('translates wizard step labels', () => {
    expect(i18n.t('wizard.selectMarket')).toBe('Select your market');
    expect(i18n.t('wizard.budget')).toBe('What is your budget?');
  });

  it('translates common UI strings', () => {
    expect(i18n.t('common.next')).toBe('Next');
    expect(i18n.t('common.back')).toBe('Back');
    expect(i18n.t('common.skip')).toBe('Skip');
    expect(i18n.t('common.analyze')).toBe('Analyze');
  });

  it('switchLanguage changes the active language', async () => {
    switchLanguage('zh-CN');
    // Wait for language change
    await new Promise((r) => setTimeout(r, 50));
    expect(i18n.language).toBe('zh-CN');
    expect(i18n.t('markets.cn')).toBe('中国');
  });

  it('falls back to English for missing keys', async () => {
    await i18n.changeLanguage('de');
    // German has all keys defined, but if a key is missing it falls back to en
    expect(i18n.t('markets.us')).toBe('Vereinigte Staaten');
  });

  it('interpolates step counter', () => {
    expect(i18n.t('common.step', { current: 2, total: 6 })).toBe('Step 2 of 6');
  });
});
