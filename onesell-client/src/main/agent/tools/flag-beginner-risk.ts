/**
 * flag_beginner_risk — Flag products risky for beginners (P3, P4, P8).
 * Relocated from onesell-backend for v2 client-only architecture.
 */

import type { Tool, FlagBeginnerRiskInput, BeginnerRiskResult, RiskLevel } from './types.js';

const REGULATED_CATEGORIES: Record<string, readonly string[]> = {
  us: ['electronics', 'supplements', 'food', 'cosmetics', 'children', 'baby', 'pharmaceutical', 'tobacco', 'alcohol', 'weapons'],
  cn: ['electronics', 'food', 'cosmetics', 'children', 'baby', 'medical', 'pharmaceutical', 'alcohol', 'telecom', 'agricultural'],
  uk: ['electronics', 'supplements', 'food', 'cosmetics', 'children', 'baby', 'pharmaceutical', 'alcohol'],
  de: ['electronics', 'supplements', 'food', 'cosmetics', 'children', 'baby', 'pharmaceutical', 'alcohol'],
  jp: ['electronics', 'supplements', 'food', 'cosmetics', 'children', 'baby', 'pharmaceutical', 'alcohol', 'medical'],
  sea: ['electronics', 'supplements', 'food', 'cosmetics', 'children', 'baby', 'pharmaceutical'],
  au: ['electronics', 'supplements', 'food', 'cosmetics', 'children', 'baby', 'pharmaceutical', 'alcohol', 'therapeutic'],
};

const REGULATORY_KEYWORDS: Record<string, readonly string[]> = {
  us: ['FDA', 'CPSC', 'FCC', 'EPA', 'USDA', 'DEA'],
  cn: ['CCC', 'CFDA', 'AQSIQ', 'MIIT', 'SAMR'],
  uk: ['CE', 'UKCA', 'MHRA', 'FSA'],
  de: ['CE', 'TÜV', 'BfArM', 'LFGB'],
  jp: ['PSE', 'PSC', 'MHLW', 'JFRL'],
  sea: ['CE', 'SIRIM', 'TISI', 'SNI'],
  au: ['CE', 'TGA', 'ACCC', 'RCM'],
};

const HEAVY_WEIGHT_KG = 30;

function flagBeginnerRiskExecute(input: FlagBeginnerRiskInput): BeginnerRiskResult {
  const { category, weight, regulatoryKeywords, market } = input;
  const reasons: string[] = [];

  const marketId = market.marketId;
  const categoryLower = (category ?? '').toLowerCase();

  const regulatedCats = REGULATED_CATEGORIES[marketId] ?? REGULATED_CATEGORIES['us'];
  for (const cat of regulatedCats) {
    if (categoryLower.includes(cat)) {
      reasons.push(`Regulated category "${cat}" in ${marketId.toUpperCase()} market`);
      break;
    }
  }

  if (weight != null && Number.isFinite(weight) && weight > HEAVY_WEIGHT_KG) {
    reasons.push(`Heavy product (${weight}kg) — high shipping cost risk`);
  }

  if (regulatoryKeywords && regulatoryKeywords.length > 0) {
    const marketKeywords = REGULATORY_KEYWORDS[marketId] ?? REGULATORY_KEYWORDS['us'];
    const matchedKeywords: string[] = [];
    for (const kw of regulatoryKeywords) {
      const kwUpper = (kw ?? '').toUpperCase();
      if (marketKeywords.some(mk => mk.toUpperCase() === kwUpper)) {
        matchedKeywords.push(kw);
      }
    }
    if (matchedKeywords.length > 0) {
      reasons.push(`Regulatory keywords detected: ${matchedKeywords.join(', ')}`);
    }
  }

  let riskLevel: RiskLevel = 'SAFE';

  const hasCategoryFlag = regulatedCats.some(cat => categoryLower.includes(cat));
  const hasKeywordFlag = regulatoryKeywords != null && regulatoryKeywords.length > 0 &&
    (REGULATORY_KEYWORDS[marketId] ?? REGULATORY_KEYWORDS['us']).some(mk =>
      regulatoryKeywords.some(kw => (kw ?? '').toUpperCase() === mk.toUpperCase())
    );

  if (hasCategoryFlag || hasKeywordFlag) {
    riskLevel = 'FLAGGED';
  } else if (weight != null && Number.isFinite(weight) && weight > HEAVY_WEIGHT_KG) {
    riskLevel = 'WARNING';
  }

  return { riskLevel, reasons };
}

export const flagBeginnerRisk: Tool<FlagBeginnerRiskInput, BeginnerRiskResult> = {
  name: 'flag_beginner_risk',
  description: 'Flag products that are risky for beginners based on regulated categories, weight, and regulatory compliance keywords for the target market.',
  execute: flagBeginnerRiskExecute,
};
