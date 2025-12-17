/**
 * Author: Claude Sonnet 4
 * Date: 2025-12-17
 * PURPOSE: Small presentation helper for rendering a numeric value as a Worm Arena "pill".
 *          Historically this rendered using the green metric style. Skill Analysis now needs
 *          role-based color variants (compare=blue, baseline=green) while keeping a safe default
 *          for older pages.
 * SRP/DRY check: Pass - purely presentational.
 */

import React from 'react';

export default function DataNumber({
  children,
  size = 'xl',
  tone = 'green',
}: {
  children: React.ReactNode;
  size?: 'lg' | 'xl';
  tone?: 'green' | 'blue' | 'red' | 'neutral' | 'baseline';
}) {
  const sizeClass = size === 'xl' ? 'text-3xl' : 'text-xl';
  const toneClass =
    tone === 'blue'
      ? 'worm-pill-blue'
      : tone === 'red'
        ? 'worm-pill-red'
        : tone === 'baseline'
          ? 'worm-pill-baseline'
          : tone === 'neutral'
            ? 'worm-pill-neutral'
            : 'worm-pill-green';

  return (
    <span className={`${toneClass} px-2.5 py-0.5 ${sizeClass}`}>
      {children}
    </span>
  );
}
