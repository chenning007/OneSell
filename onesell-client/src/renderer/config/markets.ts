import type { MarketContext } from '../../shared/types/index.js';

export interface MarketConfig {
  readonly marketId: MarketContext['marketId'];
  readonly language: string;
  readonly currency: string;
  readonly flag: string;
  readonly i18nLang: string;
  readonly platforms: readonly string[];
}

export interface BudgetRange {
  readonly min: number;
  readonly mid: number;
  readonly max: number;
  readonly currency: string;
  readonly symbol: string;
}

export interface CategoryConfig {
  readonly id: string;
  readonly i18nKey: string;
}

export const MARKET_CONFIGS: Record<string, MarketConfig> = {
  us:  { marketId: 'us',  language: 'en-US', currency: 'USD', flag: '🇺🇸', i18nLang: 'en',    platforms: ['amazon-us','ebay-us','etsy','tiktok-shop-us','alibaba','google-trends'] },
  cn:  { marketId: 'cn',  language: 'zh-CN', currency: 'CNY', flag: '🇨🇳', i18nLang: 'zh-CN', platforms: ['taobao','jd','pinduoduo','douyin-shop','1688','baidu-index'] },
  uk:  { marketId: 'uk',  language: 'en-GB', currency: 'GBP', flag: '🇬🇧', i18nLang: 'en',    platforms: ['amazon-uk','ebay-uk','etsy','alibaba','google-trends'] },
  de:  { marketId: 'de',  language: 'de-DE', currency: 'EUR', flag: '🇩🇪', i18nLang: 'de',    platforms: ['amazon-de','ebay-de','otto','etsy','alibaba','google-trends'] },
  jp:  { marketId: 'jp',  language: 'ja-JP', currency: 'JPY', flag: '🇯🇵', i18nLang: 'ja',    platforms: ['amazon-jp','rakuten','mercari-jp','alibaba','google-trends'] },
  sea: { marketId: 'sea', language: 'en-US', currency: 'USD', flag: '🇮🇩', i18nLang: 'en',    platforms: ['shopee','tokopedia','lazada','tiktok-shop-sea','alibaba','google-trends'] },
  au:  { marketId: 'au',  language: 'en-AU', currency: 'AUD', flag: '🇦🇺', i18nLang: 'en',    platforms: ['amazon-au','ebay-au','catch','etsy','alibaba','google-trends'] },
};

export const BUDGET_RANGES: Record<string, BudgetRange> = {
  us:  { min: 50,   mid: 200,   max: 500,   currency: 'USD', symbol: '$' },
  cn:  { min: 500,  mid: 2000,  max: 5000,  currency: 'CNY', symbol: '¥' },
  uk:  { min: 30,   mid: 150,   max: 400,   currency: 'GBP', symbol: '£' },
  de:  { min: 50,   mid: 150,   max: 400,   currency: 'EUR', symbol: '€' },
  jp:  { min: 5000, mid: 20000, max: 50000, currency: 'JPY', symbol: '¥' },
  sea: { min: 50,   mid: 200,   max: 500,   currency: 'USD', symbol: '$' },
  au:  { min: 75,   mid: 300,   max: 700,   currency: 'AUD', symbol: 'A$' },
};

export const MARKET_CATEGORIES: Record<string, readonly CategoryConfig[]> = {
  us:  [
    { id: 'electronics', i18nKey: 'categories.electronics' },
    { id: 'fashion',     i18nKey: 'categories.fashion' },
    { id: 'home',        i18nKey: 'categories.home' },
    { id: 'beauty',      i18nKey: 'categories.beauty' },
    { id: 'toys',        i18nKey: 'categories.toys' },
    { id: 'sports',      i18nKey: 'categories.sports' },
    { id: 'food',        i18nKey: 'categories.food' },
    { id: 'automotive',  i18nKey: 'categories.automotive' },
    { id: 'pets',        i18nKey: 'categories.pets' },
    { id: 'books',       i18nKey: 'categories.books' },
  ],
  cn:  [
    { id: 'electronics', i18nKey: 'categories.electronics' },
    { id: 'fashion',     i18nKey: 'categories.fashion' },
    { id: 'home',        i18nKey: 'categories.home' },
    { id: 'beauty',      i18nKey: 'categories.beauty' },
    { id: 'toys',        i18nKey: 'categories.toys' },
    { id: 'sports',      i18nKey: 'categories.sports' },
    { id: 'food',        i18nKey: 'categories.food' },
    { id: 'automotive',  i18nKey: 'categories.automotive' },
    { id: 'pets',        i18nKey: 'categories.pets' },
    { id: 'books',       i18nKey: 'categories.books' },
  ],
  uk:  [
    { id: 'electronics', i18nKey: 'categories.electronics' },
    { id: 'fashion',     i18nKey: 'categories.fashion' },
    { id: 'home',        i18nKey: 'categories.home' },
    { id: 'beauty',      i18nKey: 'categories.beauty' },
    { id: 'toys',        i18nKey: 'categories.toys' },
    { id: 'sports',      i18nKey: 'categories.sports' },
    { id: 'food',        i18nKey: 'categories.food' },
    { id: 'automotive',  i18nKey: 'categories.automotive' },
    { id: 'pets',        i18nKey: 'categories.pets' },
    { id: 'books',       i18nKey: 'categories.books' },
  ],
  de:  [
    { id: 'electronics', i18nKey: 'categories.electronics' },
    { id: 'fashion',     i18nKey: 'categories.fashion' },
    { id: 'home',        i18nKey: 'categories.home' },
    { id: 'beauty',      i18nKey: 'categories.beauty' },
    { id: 'toys',        i18nKey: 'categories.toys' },
    { id: 'sports',      i18nKey: 'categories.sports' },
    { id: 'food',        i18nKey: 'categories.food' },
    { id: 'automotive',  i18nKey: 'categories.automotive' },
    { id: 'pets',        i18nKey: 'categories.pets' },
    { id: 'books',       i18nKey: 'categories.books' },
  ],
  jp:  [
    { id: 'electronics', i18nKey: 'categories.electronics' },
    { id: 'fashion',     i18nKey: 'categories.fashion' },
    { id: 'home',        i18nKey: 'categories.home' },
    { id: 'beauty',      i18nKey: 'categories.beauty' },
    { id: 'toys',        i18nKey: 'categories.toys' },
    { id: 'sports',      i18nKey: 'categories.sports' },
    { id: 'food',        i18nKey: 'categories.food' },
    { id: 'automotive',  i18nKey: 'categories.automotive' },
    { id: 'pets',        i18nKey: 'categories.pets' },
    { id: 'books',       i18nKey: 'categories.books' },
  ],
  sea: [
    { id: 'electronics', i18nKey: 'categories.electronics' },
    { id: 'fashion',     i18nKey: 'categories.fashion' },
    { id: 'home',        i18nKey: 'categories.home' },
    { id: 'beauty',      i18nKey: 'categories.beauty' },
    { id: 'toys',        i18nKey: 'categories.toys' },
    { id: 'sports',      i18nKey: 'categories.sports' },
    { id: 'food',        i18nKey: 'categories.food' },
    { id: 'automotive',  i18nKey: 'categories.automotive' },
    { id: 'pets',        i18nKey: 'categories.pets' },
    { id: 'books',       i18nKey: 'categories.books' },
  ],
  au:  [
    { id: 'electronics', i18nKey: 'categories.electronics' },
    { id: 'fashion',     i18nKey: 'categories.fashion' },
    { id: 'home',        i18nKey: 'categories.home' },
    { id: 'beauty',      i18nKey: 'categories.beauty' },
    { id: 'toys',        i18nKey: 'categories.toys' },
    { id: 'sports',      i18nKey: 'categories.sports' },
    { id: 'food',        i18nKey: 'categories.food' },
    { id: 'automotive',  i18nKey: 'categories.automotive' },
    { id: 'pets',        i18nKey: 'categories.pets' },
    { id: 'books',       i18nKey: 'categories.books' },
  ],
};
