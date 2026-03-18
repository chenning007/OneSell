/**
 * Tests for v2.0 P2 Enhancement tasks:
 * - E-25 (#283): US market auto-discovery URLs (amazon-us, google-trends)
 * - E-27 (#285): CN market auto-discovery URLs (taobao, jd, 1688)
 */
import { describe, it, expect } from 'vitest';

// ── E-25: US market auto-discovery URLs ─────────────────────────────

describe('E-25: US market auto-discovery URLs', () => {
  it('AC-1: amazon-us returns 3 auto-discovery URLs', async () => {
    const { amazonUsScript } = await import(
      '../../src/main/extraction/scripts/amazon-us/index.js'
    );
    const urls = amazonUsScript.getAutoDiscoveryUrls!();
    expect(urls).toHaveLength(3);
  });

  it('AC-2: amazon-us URLs are valid and labels are descriptive', async () => {
    const { amazonUsScript } = await import(
      '../../src/main/extraction/scripts/amazon-us/index.js'
    );
    const urls = amazonUsScript.getAutoDiscoveryUrls!();

    expect(urls).toContainEqual({
      url: 'https://www.amazon.com/Best-Sellers/zgbs',
      label: 'Amazon Best Sellers',
    });
    expect(urls).toContainEqual({
      url: 'https://www.amazon.com/movers-and-shakers/zgbs',
      label: 'Amazon Movers & Shakers',
    });
    expect(urls).toContainEqual({
      url: 'https://www.amazon.com/new-releases/zgbs',
      label: 'Amazon New Releases',
    });

    for (const entry of urls) {
      expect(() => new URL(entry.url)).not.toThrow();
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('AC-3: google-trends returns 1 auto-discovery URL', async () => {
    const { googleTrendsScript } = await import(
      '../../src/main/extraction/scripts/google-trends/index.js'
    );
    const urls = googleTrendsScript.getAutoDiscoveryUrls!();
    expect(urls).toHaveLength(1);
  });

  it('AC-4: google-trends URL is valid and label is descriptive', async () => {
    const { googleTrendsScript } = await import(
      '../../src/main/extraction/scripts/google-trends/index.js'
    );
    const urls = googleTrendsScript.getAutoDiscoveryUrls!();

    expect(urls).toContainEqual({
      url: 'https://trends.google.com/trending?geo=US',
      label: 'Google Trending US',
    });

    for (const entry of urls) {
      expect(() => new URL(entry.url)).not.toThrow();
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('AC-5: all US URLs use HTTPS and labels are English', async () => {
    const { amazonUsScript } = await import(
      '../../src/main/extraction/scripts/amazon-us/index.js'
    );
    const { googleTrendsScript } = await import(
      '../../src/main/extraction/scripts/google-trends/index.js'
    );
    const allUrls = [
      ...amazonUsScript.getAutoDiscoveryUrls!(),
      ...googleTrendsScript.getAutoDiscoveryUrls!(),
    ];

    for (const entry of allUrls) {
      const parsed = new URL(entry.url);
      expect(parsed.protocol).toBe('https:');
      // Labels should be ASCII-printable English (no CJK, no control chars)
      expect(entry.label).toMatch(/^[\x20-\x7E]+$/);
    }
  });
});

// ── E-27: CN market auto-discovery URLs ─────────────────────────────

describe('E-27: CN market auto-discovery URLs', () => {
  it('AC-1: taobao returns 2 auto-discovery URLs', async () => {
    const { taobaoScript } = await import(
      '../../src/main/extraction/scripts/taobao/index.js'
    );
    const urls = taobaoScript.getAutoDiscoveryUrls!();
    expect(urls).toHaveLength(2);
  });

  it('AC-2: taobao URLs are valid with Chinese labels', async () => {
    const { taobaoScript } = await import(
      '../../src/main/extraction/scripts/taobao/index.js'
    );
    const urls = taobaoScript.getAutoDiscoveryUrls!();

    expect(urls).toContainEqual({
      url: 'https://www.taobao.com/markets/hot',
      label: '淘宝热销',
    });
    expect(urls).toContainEqual({
      url: 'https://www.taobao.com/markets/niche',
      label: '淘宝小众好物',
    });

    for (const entry of urls) {
      expect(() => new URL(entry.url)).not.toThrow();
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('AC-3: jd returns 2 auto-discovery URLs', async () => {
    const { jdScript } = await import(
      '../../src/main/extraction/scripts/jd/index.js'
    );
    const urls = jdScript.getAutoDiscoveryUrls!();
    expect(urls).toHaveLength(2);
  });

  it('AC-4: jd URLs are valid with Chinese labels', async () => {
    const { jdScript } = await import(
      '../../src/main/extraction/scripts/jd/index.js'
    );
    const urls = jdScript.getAutoDiscoveryUrls!();

    expect(urls).toContainEqual({
      url: 'https://www.jd.com/rankings',
      label: '京东排行榜',
    });
    expect(urls).toContainEqual({
      url: 'https://www.jd.com/xinfan',
      label: '京东新品',
    });

    for (const entry of urls) {
      expect(() => new URL(entry.url)).not.toThrow();
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('AC-5: 1688 returns 2 auto-discovery URLs', async () => {
    const { alibabaChScript } = await import(
      '../../src/main/extraction/scripts/1688/index.js'
    );
    const urls = alibabaChScript.getAutoDiscoveryUrls!();
    expect(urls).toHaveLength(2);
  });

  it('AC-6: 1688 URLs are valid with Chinese labels', async () => {
    const { alibabaChScript } = await import(
      '../../src/main/extraction/scripts/1688/index.js'
    );
    const urls = alibabaChScript.getAutoDiscoveryUrls!();

    expect(urls).toContainEqual({
      url: 'https://www.1688.com/huo/',
      label: '1688找货',
    });
    expect(urls).toContainEqual({
      url: 'https://re.1688.com/',
      label: '1688热销',
    });

    for (const entry of urls) {
      expect(() => new URL(entry.url)).not.toThrow();
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('AC-7: all CN URLs use HTTPS and labels contain Chinese characters', async () => {
    const { taobaoScript } = await import(
      '../../src/main/extraction/scripts/taobao/index.js'
    );
    const { jdScript } = await import(
      '../../src/main/extraction/scripts/jd/index.js'
    );
    const { alibabaChScript } = await import(
      '../../src/main/extraction/scripts/1688/index.js'
    );
    const allUrls = [
      ...taobaoScript.getAutoDiscoveryUrls!(),
      ...jdScript.getAutoDiscoveryUrls!(),
      ...alibabaChScript.getAutoDiscoveryUrls!(),
    ];

    for (const entry of allUrls) {
      const parsed = new URL(entry.url);
      expect(parsed.protocol).toBe('https:');
      // Labels must contain at least one CJK Unified Ideograph
      expect(entry.label).toMatch(/[\u4e00-\u9fff]/);
    }
  });
});
