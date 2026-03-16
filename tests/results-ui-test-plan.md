# Results UI Test Plan

> Issue: #44 — [Tester] Write Results UI test cases: card rendering, sort/filter, drill-down data accuracy

## Overview

Test coverage for the full results experience: dashboard, product cards, sort/filter, and drill-down views.

## Status: ⏳ BLOCKED

Results UI is not yet implemented. This plan documents the test cases to be written when the following dev issues are merged:
- #38 (Results dashboard implementation)
- #39 (Product detail drill-down)

## Test Cases

### Card Rendering
| Test Case | Input | Expected |
|---|---|---|
| All fields present | Complete ProductRecord | Title, price, margin, score, risk flags all visible |
| Missing optional fields | ProductRecord with nulls | Graceful rendering, no blank spots |
| Risk flag display | Product with risk flags | Flags shown with correct severity colors |
| Score breakdown | Product with ScoreBreakdown | All sub-scores rendered |
| Money formatting | Different currencies | Correct symbol and decimal places |

### Sort/Filter
| Test Case | Input | Expected |
|---|---|---|
| Sort by margin (desc) | 5 products | Highest margin first |
| Sort by margin (asc) | 5 products | Lowest margin first |
| Sort by score (desc) | 5 products | Highest composite score first |
| Sort by risk (asc) | Products with varying risk | Safest products first |
| Filter by category | Mixed categories | Only matching category shown |
| Combined sort + filter | Sort by margin + filter category | Correct subset, correctly ordered |

### Drill-Down Detail View
| Test Case | Input | Expected |
|---|---|---|
| Trend chart renders | 12-month data | Line chart with labeled axes |
| Competition data table | Seller count, review velocity | Formatted table |
| Margin calculator | Cost, price, fees | Interactive recalculation |
| P3 compliance | All numbers | Come from tool calculations, not LLM text |

### Edge Cases
| Test Case | Input | Expected |
|---|---|---|
| 0 results | Empty analysis | "No results" state with helpful message |
| 1 result | Single product | Card renders without layout issues |
| 10 results (max) | Full set | All cards render, pagination if needed |
| Cards with risk flags | High-risk product | Clear visual warning |

### Accessibility
| Test Case | Expected |
|---|---|
| Screen reader announces cards | ARIA labels on card elements |
| Keyboard navigation | Tab through cards, Enter for detail |
| Color contrast | Risk/score colors meet WCAG 2.1 AA |
| Focus visible | Focused card has visible outline |

## Traceability

- PRD Section: §6.0 Results Dashboard, §6.1 Product Detail
- Architecture: P3 (deterministic numbers), P5 (graceful degradation)
- Accessibility: WCAG 2.1 AA compliance
