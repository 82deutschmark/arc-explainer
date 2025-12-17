/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Display metric badges and confidence interval section for TrueSkill statistics.
 *          Shows skill estimate (μ), uncertainty (σ), and 99.7% confidence interval bounds.
 *          Styled to match the Skill Analysis hero graphic (TikZ reference): big pills, centered
 *          confidence interval, and compact explanatory copy.
 *          Uses react-katex InlineMath for all μ/σ/± notation and prefers the backend-provided
 *          exposed value (pessimistic rating) to stay consistent with leaderboard ranking.
 * SRP/DRY check: Pass — single responsibility for metrics display. Reuses shadcn/ui Badge.
 *
 * Touches: WormArenaSkillAnalysis.tsx (parent), react-katex for math rendering
 */

import React from 'react';
import { InlineMath } from 'react-katex';
import { Badge } from '@/components/ui/badge';
import { getConfidenceInterval } from '@/utils/confidenceIntervals';

export interface WormArenaSkillMetricsProps {
  mu: number;
  sigma: number;
  exposed: number; // pessimistic (μ − 3σ)
  confidencePercentage?: number; // default 99.7
  modelSlug?: string;
}

/**
 * Renders metric badges and confidence interval display.
 *
 * Layout (top to bottom):
 * 1. Two side-by-side badge pills:
 *    - "Skill estimate" + μ value (green pill)
 *    - "Uncertainty" + σ value (gray pill)
 * 2. Confidence interval section:
 *    - Heading: "99.7% Confidence Interval"
 *    - Metric row: red pill (pessimistic), dash, green pill (optimistic)
 *    - Labels: "pessimistic rating" and "optimistic rating"
 *    - Explanatory footer text
 *
 * TODO for next developer:
 * 1. Style the top row of badges with asymmetrical layout (not centered)
 * 2. Compute optimistic bound: μ + 3σ
 * 3. Use <InlineMath> for all math notation (μ, σ, ±, etc.)
 * 4. Ensure pill colors match worm theme (green, red-ish, gray-muted)
 * 5. Add proper spacing and typography hierarchy
 *
 * Reference implementations:
 * - WormArenaModelSnapshotCard.tsx lines 54–131 for badge/pill styling
 * - See existing use of InlineMath in snapshot card for pattern
 */
export default function WormArenaSkillMetrics({
  mu,
  sigma,
  exposed,
  confidencePercentage = 99.7,
}: WormArenaSkillMetricsProps) {
  const { lower, upper } = getConfidenceInterval(mu, sigma, 3);
  const pessimistic = Number.isFinite(exposed) ? exposed : lower;
  const optimistic = upper;

  // Reference palette (matching provided TikZ mock): blue for μ/σ, red for pessimistic, green for optimistic.
  const BLUE_BG = '#D9EDF7';
  const BLUE_TEXT = '#31708F';
  const RED_BG = '#F2DEDE';
  const RED_TEXT = '#A94442';
  const GREEN_BG = '#D8F0DE';
  const GREEN_TEXT = '#1E5631';

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-10 items-start">
        <div className="text-center">
          <div className="text-lg font-bold text-worm-ink">
            Skill estimate <InlineMath math="\\mu" />
          </div>
          <Badge
            variant="outline"
            className="mt-3 px-8 py-3 text-4xl font-bold rounded-full border-0"
            style={{ background: BLUE_BG, color: BLUE_TEXT }}
          >
            {mu.toFixed(2)}
          </Badge>
          <div className="mt-3 text-sm text-worm-muted max-w-[18rem] mx-auto">
            The center of the model skill distribution.
          </div>
        </div>

        <div className="text-center">
          <div className="text-lg font-bold text-worm-ink">
            Uncertainty <InlineMath math="\\sigma" />
          </div>
          <Badge
            variant="outline"
            className="mt-3 px-8 py-3 text-4xl font-bold rounded-full border-0"
            style={{ background: BLUE_BG, color: BLUE_TEXT }}
          >
            {sigma.toFixed(2)}
          </Badge>
          <div className="mt-3 text-sm text-worm-muted max-w-[18rem] mx-auto">
            The variability of the model's skill.
          </div>
        </div>
      </div>

      <div className="text-center space-y-5">
        <div className="text-3xl font-bold text-worm-ink">
          {confidencePercentage.toFixed(1)}% Confidence Interval
        </div>

        <div className="flex items-start justify-center gap-8">
          <div className="text-center">
            <Badge
              variant="outline"
              className="px-8 py-3 text-4xl font-bold rounded-full border-0"
              style={{ background: RED_BG, color: RED_TEXT }}
            >
              {pessimistic.toFixed(2)}
            </Badge>
            <div className="mt-2 text-sm font-bold text-worm-ink">pessimistic rating</div>
          </div>

          <div className="mt-6 h-1 w-20" style={{ background: 'rgba(51, 51, 51, 0.9)' }} />

          <div className="text-center">
            <Badge
              variant="outline"
              className="px-8 py-3 text-4xl font-bold rounded-full border-0"
              style={{ background: GREEN_BG, color: GREEN_TEXT }}
            >
              {optimistic.toFixed(2)}
            </Badge>
            <div className="mt-2 text-sm font-bold text-worm-ink">optimistic rating</div>
          </div>
        </div>

        <div className="text-sm text-worm-muted leading-relaxed">
          <div>
            {confidencePercentage.toFixed(1)}% of the time, the model will demonstrate skill within this interval.
          </div>
          <div className="mt-1">
            (Calculated as <InlineMath math="\\mu \\pm 3\\sigma" />)
          </div>
        </div>
      </div>
    </div>
  );
}
