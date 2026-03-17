import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { xiaohongshuScript } from '../../../src/main/extraction/scripts/xiaohongshu/index.js';
import type { MarketContext } from '../../../src/shared/types/MarketContext.js';

const cnMarket: MarketContext = {
  marketId: 'cn',
  language: 'zh-CN',
  currency: 'CNY',
  platforms: ['xiaohongshu'],
};

const searchFixture = `<!DOCTYPE html><html><body>
  <section class="note-item">
    <span class="note-title">小红书爆款推荐 好物分享</span>
    <span class="note-like-count">2.3万</span>
    <span class="note-author">测试用户</span>
    <span class="note-hashtag">#好物推荐</span>
    <span class="note-hashtag">#购物</span>
  </section>
  <section class="note-item">
    <span class="note-title">平价手机壳合集</span>
    <span class="note-like-count">5,678</span>
    <span class="note-author">种草达人</span>
  </section>
</body></html>`;

const emptyFixture = `<!DOCTYPE html><html><body></body></html>`;

describe('Xiaohongshu ExtractionScript', () => {
  it('extracts note listings with like counts', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = xiaohongshuScript.extractFromPage(doc, 'https://www.xiaohongshu.com/search_result?keyword=test&type=51');

    expect(result).not.toBeNull();
    expect(result!.platformId).toBe('xiaohongshu');
    expect(result!.data.pageType).toBe('search');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings).toHaveLength(2);
    expect(listings[0].title).toBe('小红书爆款推荐 好物分享');
    expect(listings[0].likeCount).toBe(23000);
    expect(listings[0].author).toBe('测试用户');
  });

  it('parses comma-separated like counts', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = xiaohongshuScript.extractFromPage(doc, 'https://www.xiaohongshu.com/search_result?keyword=test&type=51');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    expect(listings[1].likeCount).toBe(5678);
  });

  it('extracts hashtags as tags', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const result = xiaohongshuScript.extractFromPage(doc, 'https://www.xiaohongshu.com/search_result?keyword=test&type=51');
    const listings = result!.data.listings as Array<Record<string, unknown>>;
    const tags = listings[0].tags as string[];
    expect(tags.length).toBeGreaterThan(0);
  });

  it('returns null on unrecognized URL', () => {
    const doc = new JSDOM(emptyFixture).window.document;
    const result = xiaohongshuScript.extractFromPage(doc, 'https://www.google.com');
    expect(result).toBeNull();
  });

  it('returns null when no items found', () => {
    const doc = new JSDOM(emptyFixture).window.document;
    const result = xiaohongshuScript.extractFromPage(doc, 'https://www.xiaohongshu.com/search_result?keyword=test&type=51');
    expect(result).toBeNull();
  });

  it('getNavigationTargets returns xiaohongshu search URL', () => {
    const targets = xiaohongshuScript.getNavigationTargets('手机壳', cnMarket);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0]).toContain('xiaohongshu.com/search_result');
  });

  it('normalizeData uses price=0 (trend source, not price source)', () => {
    const doc = new JSDOM(searchFixture).window.document;
    const raw = xiaohongshuScript.extractFromPage(doc, 'https://www.xiaohongshu.com/search_result?keyword=test&type=51');
    const normalized = xiaohongshuScript.normalizeData([raw!]);
    expect(normalized.platformId).toBe('xiaohongshu');
    expect(normalized.marketId).toBe('cn');
    expect(normalized.listings.length).toBeGreaterThan(0);
    expect(normalized.listings[0].currency).toBe('CNY');
    expect(normalized.listings[0].price).toBe(0);
  });

  it('has correct static properties', () => {
    expect(xiaohongshuScript.platformId).toBe('xiaohongshu');
    expect(xiaohongshuScript.marketId).toBe('cn');
    expect(xiaohongshuScript.version).toBe('1.0.0');
    expect(xiaohongshuScript.homeUrl).toContain('xiaohongshu.com');
  });
});
