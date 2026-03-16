# Agent Service Test Plan

> Issue: #36 — [Tester] Write Agent Service test plan: tool accuracy, LLM output validation, edge cases

## Overview

Test coverage for the full agent pipeline: Planner → Executor → Synthesizer, all 7 tool functions.

## Status: ⏳ BLOCKED

Backend agent service is not yet implemented. This plan documents the test cases to be written when the following dev issues are merged:
- #28 (Prompt architecture)
- #31 (Tool functions)
- #32 (Agent pipeline)
- #33 (LLM provider abstraction)

## Tool Function Tests (100% branch coverage target)

### calc_margin
| Test Case | Input | Expected |
|---|---|---|
| Normal margin | cost=10, price=25, fees=3 | margin=48% |
| Zero margin | cost=25, price=25, fees=0 | margin=0% |
| Negative margin | cost=30, price=25, fees=3 | negative margin flagged |
| All 7 markets | Market-specific fee structures | Correct per-market calculation |
| Edge: zero price | price=0 | Error or 0%, not crash |

### rank_competition
| Test Case | Input | Expected |
|---|---|---|
| Low competition | Few sellers, low reviews | Score near 1.0 (easy) |
| High competition | Many sellers, many reviews | Score near 0.0 (hard) |
| Missing data | Partial competition data | Graceful default score |

### score_trend
| Test Case | Input | Expected |
|---|---|---|
| Rising trend | 12-month ascending | High score, "rising" label |
| Declining trend | 12-month descending | Low score, "declining" label |
| Flat trend | Stable values | Mid score, "stable" label |
| Missing months | Gaps in data | Interpolates or reports partial |

### flag_beginner_risk
| Test Case | Input | Expected |
|---|---|---|
| High capital requirement | Budget < product cost | Risk flag raised |
| Complex supply chain | Multiple supplier hops | Risk flag raised |
| Safe product | Simple, low-cost, FBA | No risk flag |

### compare_products
| Test Case | Input | Expected |
|---|---|---|
| 2 products | Different margins | Ranked by composite score |
| 10 products (max) | Mixed metrics | Stable ranking |
| Identical scores | Same metrics | Deterministic tiebreak |

### estimate_cogs
| Test Case | Input | Expected |
|---|---|---|
| USD product | Alibaba price + shipping | COGS in USD |
| Cross-currency | CNY source → USD market | Correct conversion |
| Missing shipping | No shipping data | Estimate or flag |

### get_platform_fees
| Test Case | Input | Expected |
|---|---|---|
| Amazon US | Referral + FBA fees | Correct fee structure |
| All 7 markets | Each platform | Correct per-platform fees |
| Unknown platform | Invalid platform ID | Error or zero fees |

## Agent Pipeline Tests

### PlannerAgent
| Test Case | Expected |
|---|---|
| Valid AnalysisPayload → TaskPlan | Structured task plan with tool calls |
| Partial data (3/6 platforms) | Adapted plan using available data only |
| Unknown market | Graceful error, not crash |

### ExecutorAgent
| Test Case | Expected |
|---|---|
| Route tool calls correctly | Each tool receives correct arguments |
| Unknown tool name from LLM | Logged and skipped, not crash |
| Tool returns error | Executor catches and continues |
| P3: no LLM-generated numbers | All numbers come from tool outputs |

### SynthesizerAgent
| Test Case | Expected |
|---|---|
| Output language matches market | US→en, CN→zh, DE→de, JP→ja |
| Output schema validates | Matches ProductRecord Zod schema |
| No LLM-generated numbers in output | P3 compliance |
| Max 10 product cards | Truncated if more |

### End-to-End Pipeline
| Test Case | Expected |
|---|---|
| Full US market analysis (mock LLM) | Valid ProductRecord[] output |
| LLM timeout | Graceful error response |
| Invalid LLM response | Zod rejection, retry or error |

## Traceability

- PRD Section: §5.0 Agent Analysis Pipeline
- Architecture: P3 (deterministic numbers), P7 (extensible pipeline), P9 (security by default)
- Security: S3 (prompt injection defense), S4 (output validation)
