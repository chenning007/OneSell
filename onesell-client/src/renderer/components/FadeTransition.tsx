import React from 'react';

export interface FadeTransitionProps {
  readonly children: React.ReactNode;
}

/**
 * Wraps children with a CSS fade-in animation (opacity 0→1, 0.2s ease-in).
 * Relies on the `fadeIn` keyframe injected by GlobalStyles.
 * Use a `key` prop to re-trigger the animation on content changes.
 */
export default function FadeTransition({ children }: FadeTransitionProps): React.ReactElement {
  return (
    <div
      data-testid="fade-transition"
      style={{ animation: 'fadeIn 0.2s ease-in' }}
    >
      {children}
    </div>
  );
}
