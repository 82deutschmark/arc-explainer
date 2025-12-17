/**
 * Author: Claude Sonnet 4
 * Date: 2025-12-17
 * PURPOSE: Reusable component to display win probability comparison between two
 *          TrueSkill-rated models. Shows the probability that the compare model
 *          beats the baseline model, with role-based color coding and LaTeX formula.
 * SRP/DRY check: Pass - single responsibility for win probability display; uses
 *                centralized role colors and existing DataNumber component.
 *
 * Touches: WormArenaSkillHeroGraphic.tsx (parent), wormArenaWinProbability.ts (math)
 */

import React from 'react';
import { InlineMath } from 'react-katex';
import DataNumber from './DataNumber';
import { calculateWinProbability } from '@/utils/wormArenaWinProbability';
import { getWormArenaRoleColors } from '@/utils/wormArenaRoleColors';

export interface WormArenaWinProbabilityProps {
  /** Skill estimate (mu) for the compare model */
  compareMu: number;
  /** Uncertainty (sigma) for the compare model */
  compareSigma: number;
  /** Display label for the compare model */
  compareLabel: string;
  /** Skill estimate (mu) for the baseline model */
  baselineMu: number;
  /** Uncertainty (sigma) for the baseline model */
  baselineSigma: number;
  /** Display label for the baseline model */
  baselineLabel: string;
}

/**
 * Displays the win probability for a compare model vs baseline model.
 *
 * Layout:
 * - Header: "Win Probability"
 * - Large percentage pill (blue tone)
 * - Explanatory text with color-coded model names
 * - LaTeX formula showing the calculation method
 */
export default function WormArenaWinProbability({
  compareMu,
  compareSigma,
  compareLabel,
  baselineMu,
  baselineSigma,
  baselineLabel,
}: WormArenaWinProbabilityProps) {
  // Calculate win probability using the TrueSkill formula
  const winProb = calculateWinProbability(compareMu, compareSigma, baselineMu, baselineSigma);
  const winPct = (winProb * 100).toFixed(1);

  // Get role colors for consistent styling
  const compareColors = getWormArenaRoleColors('compare');
  const baselineColors = getWormArenaRoleColors('baseline');

  // Determine tone based on probability (>50% = favorable for compare model)
  const tone = winProb >= 0.5 ? 'blue' : 'red';

  return (
    <div className="text-center space-y-4">
      {/* Section header */}
      <div className="text-xl font-bold text-worm-ink">
        Win Probability
      </div>

      {/* Large percentage display */}
      <div>
        <DataNumber size="xl" tone={tone}>
          {winPct}%
        </DataNumber>
      </div>

      {/* Explanatory text with role-colored model names */}
      <div className="text-sm text-worm-muted leading-relaxed max-w-md mx-auto">
        <div>
          Probability that{' '}
          <span className="font-semibold" style={{ color: compareColors.accent }}>
            {compareLabel}
          </span>
          {' '}beats{' '}
          <span className="font-semibold" style={{ color: baselineColors.accent }}>
            {baselineLabel}
          </span>
          {' '}in a head-to-head match.
        </div>

        {/* Formula display using LaTeX - prominent styling per user request */}
        <div className="mt-3 text-base font-bold text-worm-ink">
          Calculated using:{' '}
          <InlineMath math="P = \Phi\left(\frac{\mu_1 - \mu_2}{\sqrt{\sigma_1^2 + \sigma_2^2}}\right)" />
        </div>
      </div>
    </div>
  );
}
