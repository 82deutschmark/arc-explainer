/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Display metric badges and confidence interval section for TrueSkill statistics.
 *          Shows skill estimate (μ), uncertainty (σ), and 99.7% confidence interval bounds.
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

  return (
    <div className="space-y-6">
      {/* Row 1: Skill Estimate and Uncertainty Badges */}
      <div className="grid grid-cols-[1.3fr_0.7fr] gap-6">
        {/* Skill Estimate */}
        <div className="flex flex-col items-start gap-2">
          <div className="text-sm font-semibold text-worm-ink">
            Skill estimate <InlineMath math="\\mu" />
          </div>
          <Badge
            variant="outline"
            className="px-3 py-1.5 text-lg font-bold"
            style={{
              background: 'var(--worm-highlight-bg)',
              borderColor: 'var(--worm-green)',
              color: 'var(--worm-green-ink)',
            }}
          >
            {mu.toFixed(2)}
          </Badge>
          <div className="text-xs text-worm-muted">
            Center of the skill distribution
          </div>
        </div>

        {/* Uncertainty */}
        <div className="flex flex-col items-start gap-2">
          <div className="text-sm font-semibold text-worm-ink">
            Uncertainty <InlineMath math="\\sigma" />
          </div>
          <Badge
            variant="outline"
            className="px-3 py-1.5 text-lg font-bold"
            style={{
              background: 'rgba(255, 255, 255, 0.8)',
              borderColor: 'var(--worm-border)',
              color: 'var(--worm-muted)',
            }}
          >
            {sigma.toFixed(2)}
          </Badge>
          <div className="text-xs text-worm-muted">
            Range of variability
          </div>
        </div>
      </div>

      {/* Row 2: Confidence Interval */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-worm-ink">
          {confidencePercentage.toFixed(1)}% Confidence Interval
        </h3>

        {/* Interval Pills */}
        <div className="flex items-center justify-start gap-3">
          <div className="flex flex-col items-center gap-1">
            <Badge
              variant="outline"
              className="px-3 py-1.5 text-lg font-bold"
              style={{
                background: 'rgba(200, 90, 58, 0.12)',
                borderColor: 'rgba(200, 90, 58, 0.35)',
                color: 'rgb(153, 27, 27)',
              }}
            >
              {pessimistic.toFixed(2)}
            </Badge>
            <div className="text-xs font-semibold text-worm-ink">pessimistic rating</div>
          </div>

          {/* Dash */}
          <div className="h-0.5 w-4 bg-worm-border" />

          <div className="flex flex-col items-center gap-1">
            <Badge
              variant="outline"
              className="px-3 py-1.5 text-lg font-bold"
              style={{
                background: 'var(--worm-highlight-bg)',
                borderColor: 'var(--worm-green)',
                color: 'var(--worm-green-ink)',
              }}
            >
              {optimistic.toFixed(2)}
            </Badge>
            <div className="text-xs font-semibold text-worm-ink">optimistic rating</div>
          </div>
        </div>

        {/* Explanatory Text */}
        <div className="text-xs text-worm-muted leading-relaxed bg-worm-track/20 p-2.5 rounded">
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
