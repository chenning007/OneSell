import React from 'react';

const GLOBAL_CSS = `
  *:focus-visible {
    outline: 2px solid #0066cc;
    outline-offset: 2px;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
`;

/**
 * Injects global CSS rules for focus-visible outlines and shared keyframes.
 * Render once at the top of the component tree.
 */
export default function GlobalStyles(): React.ReactElement {
  return <style data-testid="global-styles">{GLOBAL_CSS}</style>;
}
