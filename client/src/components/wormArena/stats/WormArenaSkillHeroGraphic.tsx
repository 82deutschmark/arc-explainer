/**
 * Author: Claude Sonnet 4
 * Date: 2025-12-17
 * PURPOSE: Single unified "poster" graphic for the Skill Analysis page. Draws the reference
 *          design: skill estimate + uncertainty pills at top, 99.7% CI section in middle,
 *          and overlapping bell curves (rendered near the top so it sits directly under the view tabs).
 *          Updated to keep role-based colors consistent (compare=blue, baseline=red) and to
 *          display both models' skill estimate and uncertainty values.
 *          Chart math uses explicit top/bottom margins so the curve, labels, and x-axis
 *          are fully contained (no overflow bleed) and match the reference layout.
 *          Added win probability section when baseline model is selected.
 * SRP/DRY check: Pass - single responsibility for the hero graphic composition.
 *
 * Touches: WormArenaSkillAnalysis.tsx (parent), WormArenaWinProbability.tsx (child)
 */

import React from 'react';
import { InlineMath } from 'react-katex';
import { gaussianPDF } from '@/utils/confidenceIntervals';
import { getConfidenceInterval } from '@/utils/confidenceIntervals';
import { getWormArenaRoleColors } from '@/utils/wormArenaRoleColors';
import WormArenaWinProbability from '../WormArenaWinProbability';

export interface WormArenaSkillHeroGraphicProps {
  // Selected model
  mu: number;
  sigma: number;
  exposed: number;
  modelLabel: string;
  gamesPlayed?: number;
  wins?: number;
  losses?: number;
  ties?: number;
  totalCost?: number;

  // Reference model (optional)
  referenceMu?: number;
  referenceSigma?: number;
  referenceLabel?: string;
}

/**
 * Draws the exact reference graphic:
 * - Top: "Skill estimate μ" and "Uncertainty σ" with blue pills
 * - Middle: "99.7% Confidence Interval" with red/green pills and explanatory text
 * - Bottom: Overlapping Gaussian bell curves with in-chart labels
 */
export default function WormArenaSkillHeroGraphic({
  mu,
  sigma,
  exposed,
  modelLabel,
  gamesPlayed,
  wins,
  losses,
  ties,
  totalCost,
  referenceMu,
  referenceSigma,
  referenceLabel = 'Reference',
}: WormArenaSkillHeroGraphicProps) {
  const { lower, upper } = getConfidenceInterval(mu, sigma, 3);
  const pessimistic = Number.isFinite(exposed) ? exposed : lower;
  const optimistic = upper;

  // Role colors: compare is always blue, baseline is always red.
  const compareColors = getWormArenaRoleColors('compare');
  const baselineColors = getWormArenaRoleColors('baseline');

  // Pills for the mu/sigma blocks under the bell curve.
  const COMPARE_PILL_BG = compareColors.tintBgStrong;
  const COMPARE_PILL_TEXT = compareColors.accent;
  const BASELINE_PILL_BG = baselineColors.tintBgStrong;
  const BASELINE_PILL_TEXT = baselineColors.accent;

  const RED_PILL_BG = '#F2DEDE';
  const RED_PILL_TEXT = '#A94442';
  const GREEN_PILL_BG = '#D8F0DE';
  const GREEN_PILL_TEXT = '#1E5631';
  const LABEL_GRAY = '#666666';
  const HEADER_COLOR = '#333333';

  // Chart dimensions (extra room so labels and axis never bleed outside the SVG)
  const chartWidth = 600;
  const chartHeight = 340;
  const topMargin = 26;
  const bottomMargin = 52;
  const plotBottomY = chartHeight - bottomMargin;

  // Curve colors
  const CURRENT_STROKE = compareColors.accent;
  const CURRENT_FILL = compareColors.tintBgStrong;
  const REF_STROKE = baselineColors.accent;
  const REF_FILL = baselineColors.tintBg;

  // Calculate chart bounds.
  // The reference image reads tighter than ±4σ; we keep this closer to the 99.7% CI (±3σ).
  const sigmaRange = 3;
  let minX = mu - sigmaRange * sigma;
  let maxX = mu + sigmaRange * sigma;

  // Expand bounds if reference exists and is outside current range
  if (referenceMu !== undefined && referenceSigma !== undefined) {
    const refMin = referenceMu - sigmaRange * referenceSigma;
    const refMax = referenceMu + sigmaRange * referenceSigma;
    minX = Math.min(minX, refMin);
    maxX = Math.max(maxX, refMax);
  }

  // Make the axis bounds stable and tick-friendly.
  // This improves visual consistency with the reference image (integer ticks, nice padding).
  minX = Math.floor(minX);
  maxX = Math.ceil(maxX);

  // Generate sample points across the full range
  const numSamples = 200;
  const xSamples: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    xSamples.push(minX + (i / (numSamples - 1)) * (maxX - minX));
  }

  // Peak PDF values at apex: 1 / (sigma * sqrt(2*pi))
  const mainApexPdf = 1 / (sigma * Math.sqrt(2 * Math.PI));
  const refApexPdf =
    referenceMu !== undefined && referenceSigma !== undefined
      ? 1 / (referenceSigma * Math.sqrt(2 * Math.PI))
      : 0;
  // Add headroom for labels above curves.
  const maxPdf = Math.max(mainApexPdf, refApexPdf) * 1.18;

  // Convert data space to SVG pixels.
  // Note: SVG y=0 is top. We reserve top/bottom margins so labels/ticks fit.
  const toPixelX = (x: number) => ((x - minX) / (maxX - minX)) * chartWidth;
  const toPixelY = (pdf: number) => {
    const usableHeight = plotBottomY - topMargin;
    return plotBottomY - (pdf / maxPdf) * usableHeight;
  };

  // Build reference curve path (filled)
  let refPath = '';
  if (referenceMu !== undefined && referenceSigma !== undefined) {
    const refPoints: string[] = [`M ${toPixelX(xSamples[0])} ${plotBottomY}`];
    for (const x of xSamples) {
      const pdf = gaussianPDF(x, referenceMu, referenceSigma);
      refPoints.push(`L ${toPixelX(x).toFixed(2)} ${toPixelY(pdf).toFixed(2)}`);
    }
    refPoints.push(`L ${toPixelX(xSamples[xSamples.length - 1])} ${plotBottomY} Z`);
    refPath = refPoints.join(' ');
  }

  // Build main curve path (filled)
  const mainPoints: string[] = [`M ${toPixelX(xSamples[0])} ${plotBottomY}`];
  for (const x of xSamples) {
    const pdf = gaussianPDF(x, mu, sigma);
    mainPoints.push(`L ${toPixelX(x).toFixed(2)} ${toPixelY(pdf).toFixed(2)}`);
  }
  mainPoints.push(`L ${toPixelX(xSamples[xSamples.length - 1])} ${plotBottomY} Z`);
  const mainPath = mainPoints.join(' ');

  // Generate x-axis ticks (prefer integer ticks similar to the reference image).
  const range = Math.max(1, maxX - minX);
  const approxTickCount = 12;
  const tickStep = Math.max(1, Math.round(range / approxTickCount));
  const ticks: number[] = [];
  const firstTick = Math.ceil(minX / tickStep) * tickStep;
  for (let t = firstTick; t <= maxX; t += tickStep) {
    ticks.push(t);
  }

  // Label positions: place at apex (mu, 1/(sigma*sqrt(2*pi))) with small offset above
  const mainLabelX = toPixelX(mu);
  const mainLabelYBase = toPixelY(mainApexPdf) - 10;
  const refLabelX = referenceMu !== undefined ? toPixelX(referenceMu) : 0;
  const refLabelYBase =
    referenceMu !== undefined && referenceSigma !== undefined
      ? toPixelY(refApexPdf) - 10
      : 0;

  // If the two labels would overlap horizontally, offset them vertically.
  const labelCollisionPx = 90;
  const labelsCollide =
    referenceMu !== undefined && Math.abs(mainLabelX - refLabelX) < labelCollisionPx;
  const mainLabelY = labelsCollide ? mainLabelYBase - 10 : mainLabelYBase;
  const refLabelY = labelsCollide ? refLabelYBase + 14 : refLabelYBase;

  const statBoxes = [
    { label: 'Games', value: typeof gamesPlayed === 'number' ? String(gamesPlayed) : '—' },
    { label: 'Wins', value: typeof wins === 'number' ? String(wins) : '—' },
    { label: 'Losses', value: typeof losses === 'number' ? String(losses) : '—' },
    { label: 'Ties', value: typeof ties === 'number' ? String(ties) : '—' },
    { label: 'Cost', value: typeof totalCost === 'number' ? `$${totalCost.toFixed(4)}` : '—' },
  ];

  return (
    <div className="flex flex-col items-center w-full font-worm" style={{ color: HEADER_COLOR }}>
      {/* Requested page-level heading so the user always knows which model they're viewing. */}
      <div className="w-full max-w-xl mb-6">
        <div className="text-lg font-bold text-worm-ink">
          Model Snapshot <span className="font-mono text-sm worm-muted">{modelLabel}</span>
        </div>
      </div>

      {/* Bottom: Bell curve chart */}
      <svg
        width={chartWidth}
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      >
        {/* Reference curve (behind) */}
        {refPath && (
          <path d={refPath} fill={REF_FILL} fillOpacity={0.6} stroke={REF_STROKE} strokeWidth="2" />
        )}

        {/* Main curve (in front) */}
        <path d={mainPath} fill={CURRENT_FILL} fillOpacity={0.7} stroke={CURRENT_STROKE} strokeWidth="2.5" />

        {/* Dashed reference line at current model's μ (matches the reference image) */}
        <line
          x1={mainLabelX}
          y1={topMargin}
          x2={mainLabelX}
          y2={plotBottomY}
          stroke="#B0B0B0"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* X-axis line */}
        <line x1={0} y1={plotBottomY} x2={chartWidth} y2={plotBottomY} stroke="#999999" strokeWidth="1" />

        {/* X-axis ticks and labels */}
        {ticks.map((tick) => {
          const px = toPixelX(tick);
          return (
            <g key={tick}>
              <line x1={px} y1={plotBottomY} x2={px} y2={plotBottomY + 7} stroke="#999999" strokeWidth="1" />
              <text x={px} y={plotBottomY + 24} textAnchor="middle" fontSize="13" fill="#333333">
                {tick}
              </text>
            </g>
          );
        })}

        {/* X-axis label */}
        <text x={chartWidth / 2} y={chartHeight - 8} textAnchor="middle" fontSize="14" fill="#333333">
          Skill Rating
        </text>

        {/* Reference model label */}
        {referenceMu !== undefined && referenceSigma !== undefined && (
          <text
            x={refLabelX}
            y={refLabelY}
            textAnchor="middle"
            fontSize="13"
            fontWeight="400"
            fontStyle="italic"
            fill={REF_STROKE}
          >
            {referenceLabel}
          </text>
        )}

        {/* Current model label */}
        <text
          x={mainLabelX}
          y={mainLabelY}
          textAnchor="middle"
          fontSize="13"
          fontWeight="600"
          fill={CURRENT_STROKE}
        >
          {modelLabel}
        </text>
      </svg>

      {/* Win Probability section - positioned right after bell curve per user request */}
      {referenceMu !== undefined && referenceSigma !== undefined && referenceLabel && (
        <div className="mt-6 mb-8">
          <WormArenaWinProbability
            compareMu={mu}
            compareSigma={sigma}
            compareLabel={modelLabel}
            baselineMu={referenceMu}
            baselineSigma={referenceSigma}
            baselineLabel={referenceLabel}
          />
        </div>
      )}

      {/* Skill estimate and Uncertainty (both models, role-colored) */}
      <div className="w-full max-w-xl mb-8 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold mb-3" style={{ color: HEADER_COLOR }}>
              Skill estimate <InlineMath math="\mu" />
            </div>
            <div
              className="inline-block px-8 py-3 text-3xl font-bold rounded-full"
              style={{ background: COMPARE_PILL_BG, color: COMPARE_PILL_TEXT }}
            >
              {mu.toFixed(2)}
            </div>
            <div className="mt-2 text-xs font-semibold" style={{ color: compareColors.accent }}>
              Compare
            </div>
          </div>

          <div className="text-center">
            <div className="text-lg font-bold mb-3" style={{ color: HEADER_COLOR }}>
              Uncertainty <InlineMath math="\sigma" />
            </div>
            <div
              className="inline-block px-8 py-3 text-3xl font-bold rounded-full"
              style={{ background: COMPARE_PILL_BG, color: COMPARE_PILL_TEXT }}
            >
              {sigma.toFixed(2)}
            </div>
            <div className="mt-2 text-xs font-semibold" style={{ color: compareColors.accent }}>
              Compare
            </div>
          </div>
        </div>

        {referenceMu !== undefined && referenceSigma !== undefined && (
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-sm font-bold mb-2" style={{ color: HEADER_COLOR }}>
                Baseline <InlineMath math="\mu" />
              </div>
              <div
                className="inline-block px-6 py-2 text-2xl font-bold rounded-full"
                style={{ background: BASELINE_PILL_BG, color: BASELINE_PILL_TEXT }}
              >
                {referenceMu.toFixed(2)}
              </div>
              <div className="mt-2 text-xs font-semibold" style={{ color: baselineColors.accent }}>
                Baseline
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm font-bold mb-2" style={{ color: HEADER_COLOR }}>
                Baseline <InlineMath math="\sigma" />
              </div>
              <div
                className="inline-block px-6 py-2 text-2xl font-bold rounded-full"
                style={{ background: BASELINE_PILL_BG, color: BASELINE_PILL_TEXT }}
              >
                {referenceSigma.toFixed(2)}
              </div>
              <div className="mt-2 text-xs font-semibold" style={{ color: baselineColors.accent }}>
                Baseline
              </div>
            </div>
          </div>
        )}

        <div className="text-sm text-center" style={{ color: LABEL_GRAY }}>
          Compare is blue. Baseline is green.
        </div>
      </div>

      {/* Middle: 99.7% Confidence Interval (for Compare model) */}
      <div className="text-center mb-8">
        <div className="text-xl font-bold mb-2" style={{ color: HEADER_COLOR }}>
          99.7% Confidence Interval
        </div>
        <div className="text-xs font-semibold mb-4" style={{ color: compareColors.accent }}>
          (Compare Model)
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 mb-3">
          {/* Pessimistic pill */}
          <div className="text-center">
            <div
              className="inline-block px-8 py-3 text-3xl font-bold rounded-full"
              style={{ background: RED_PILL_BG, color: RED_PILL_TEXT }}
            >
              {pessimistic.toFixed(2)}
            </div>
          </div>

          {/* Dash */}
          <div className="w-12 h-1" style={{ background: '#333333' }} />

          {/* Optimistic pill */}
          <div className="text-center">
            <div
              className="inline-block px-8 py-3 text-3xl font-bold rounded-full"
              style={{ background: GREEN_PILL_BG, color: GREEN_PILL_TEXT }}
            >
              {optimistic.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 mb-4">
          <div className="text-sm font-bold" style={{ color: HEADER_COLOR }}>
            Pessimistic rating
          </div>
          <div />
          <div className="text-sm font-bold" style={{ color: HEADER_COLOR }}>
            Optimistic rating
          </div>
        </div>

        <div className="text-sm" style={{ color: LABEL_GRAY }}>
          99.7% of the time, we expect the model to demonstrate skill within this interval.
        </div>
        <div className="text-sm mt-1" style={{ color: LABEL_GRAY }}>
          (Calculated as <InlineMath math="\mu \pm 3\sigma" />)
        </div>
      </div>

      {/* Stats boxes: Compare model statistics only */}
      <div className="w-full max-w-xl">
        <div className="text-sm font-semibold text-center mb-2" style={{ color: compareColors.accent }}>
          Compare Model Stats
        </div>
        <div className="grid grid-cols-5 gap-3 mb-3">
        {statBoxes.map((box) => (
          <div
            key={box.label}
            className="worm-card-soft px-3 py-2 text-center"
          >
            <div className="text-[11px] font-semibold worm-muted">{box.label}</div>
            <div className="text-sm font-bold font-mono">{box.value}</div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}
