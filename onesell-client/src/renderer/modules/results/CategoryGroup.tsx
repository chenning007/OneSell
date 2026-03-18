/**
 * CategoryGroup — Collapsible group header + candidate list (R-05, #257).
 *
 * PRD §8.2, ADR-005 D3:
 * - Header: category name + product count (e.g., "📂 Trending Home & Kitchen (5 products)")
 * - Click header collapses/expands the product list
 * - Expanded by default
 * - Renders CandidateRow for each product
 *
 * Closes #257
 */

import React, { useState } from 'react';
import type { CandidateCategory } from '../../../shared/types/index.js';
import CandidateRow from './CandidateRow.js';

export interface CategoryGroupProps {
  category: CandidateCategory;
}

export default function CategoryGroup({ category }: CategoryGroupProps): React.ReactElement {
  const [expanded, setExpanded] = useState(true);
  const count = category.products.length;

  return (
    <div data-testid={`category-group-${category.name}`} style={{ marginBottom: '16px' }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <button
        data-testid={`category-header-${category.name}`}
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          padding: '12px 16px',
          border: 'none',
          borderRadius: '8px',
          background: '#f8f9fa',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '16px',
          fontWeight: 600,
          color: '#2c3e50',
          transition: 'background 0.15s ease',
        }}
      >
        <span style={{ fontSize: '14px', transition: 'transform 0.2s ease', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          ▸
        </span>
        <span>📂</span>
        <span style={{ flex: 1 }}>
          {category.name}
        </span>
        <span style={{ fontSize: '13px', color: '#7f8c8d', fontWeight: 400 }}>
          {count} product{count !== 1 ? 's' : ''}
        </span>
      </button>

      {/* ── Product list ────────────────────────────────────────── */}
      {expanded && (
        <div
          data-testid={`category-products-${category.name}`}
          style={{
            borderLeft: '2px solid #ecf0f1',
            marginLeft: '16px',
            paddingLeft: '12px',
            marginTop: '4px',
          }}
        >
          {category.products.map((product, index) => (
            <CandidateRow
              key={product.cardId ?? `${category.name}-${index}`}
              candidate={product}
              rank={index + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
