// Shared types barrel — import from here in both main and renderer
export type { MarketContext } from './MarketContext.js';
export type { ExtractionScript, RawPlatformData, NormalizedPlatformData } from './ExtractionScript.js';
export type { AnalysisPayload, UserPreferences } from './AnalysisPayload.js';
export type { ProductRecord, ProductCard, MoneyAmount, RiskFlag, ScoreBreakdown, ReasoningStep } from './ProductRecord.js';
export type { ProductCandidate, CandidateCategory, AnalysisResult } from './CandidateTypes.js';
export {
  productCandidateExtensionSchema,
  productCandidateSchema,
  candidateCategorySchema,
  analysisResultSchema,
} from './CandidateTypes.js';
