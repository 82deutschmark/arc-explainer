/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Single unified "poster" graphic for the Skill Analysis page. Draws the exact
 *          reference design: skill estimate + uncertainty pills at top, 99.7% CI section
 *          in middle, and the overlapping bell curves at bottom. All rendered as one
 *          seamless composition with no card borders.
 * SRP/DRY check: Pass — single responsibility for the hero graphic composition.
 *
 * Touches: WormArenaSkillAnalysis.tsx (parent)
 */

import React from 'react';
import { InlineMath } from 'react-katex';
import {
  gaussianPDF,
  getMaxPDFInRange,
  generateXSamples,
  dataToPx,
  normalizeToSVGHeight,
} from '@/utils/confidenceIntervals';
import { getConfidenceInterval } from '@/utils/confidenceIntervals';

export interface WormArenaSkillHeroGraphicProps {
  // Selected model
  mu: number;
  sigma: number;
  exposed: number;
  modelLabel: string;

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
  referenceMu,
  referenceSigma,
  referenceLabel = 'Reference',
}: WormArenaSkillHeroGraphicProps) {
  const { lower, upper } = getConfidenceInterval(mu, sigma, 3);
  const pessimistic = Number.isFinite(exposed) ? exposed : lower;
  const optimistic = upper;

  // Color palette matching the TikZ reference
  const BLUE_PILL_BG = '#D9EDF7';
  const BLUE_PILL_TEXT = '#31708F';
  const RED_PILL_BG = '#F2DEDE';
  const RED_PILL_TEXT = '#A94442';
  const GREEN_PILL_BG = '#D8F0DE';
  const GREEN_PILL_TEXT = '#1E5631';
  const LABEL_GRAY = '#666666';
  const HEADER_COLOR = '#333333';

  // Chart dimensions
  const chartWidth = 600;
  const chartHeight = 280;
  const axisMargin = 32;
  const plotHeight = chartHeight - axisMargin;

  // Curve colors
  const CURRENT_STROKE = '#31708F';
  const CURRENT_FILL = '#D9EDF7';
  const REF_STROKE = '#999999';
  const REF_FILL = '#E0E0E0';

  // Calculate chart bounds - accommodate both curves with 3.5σ range
  const sigmaRange = 3.5;
  let minX = mu - sigmaRange * sigma;
  let maxX = mu + sigmaRange * sigma;

  // Expand bounds if reference exists and is outside current range
  if (referenceMu !== undefined && referenceSigma !== undefined) {
    const refMin = referenceMu - sigmaRange * referenceSigma;
    const refMax = referenceMu + sigmaRange * referenceSigma;
    minX = Math.min(minX, refMin);
    maxX = Math.max(maxX, refMax);
  }

  // Generate sample points across the full range
  const numSamples = 200;
  const xSamples: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    xSamples.push(minX + (i / (numSamples - 1)) * (maxX - minX));
  }

  // Get max PDF for normalization
  const mainPeakPdf = gaussianPDF(mu, mu, sigma);
  const refPeakPdf =
    referenceMu !== undefined && referenceSigma !== undefined
      ? gaussianPDF(referenceMu, referenceMu, referenceSigma)
      : 0;
  const maxPdf = Math.max(mainPeakPdf, refPeakPdf) * 1.15; // Add headroom for labels

  // Convert data x to pixel x
  const toPixelX = (x: number) => ((x - minX) / (maxX - minX)) * chartWidth;
  const toPixelY = (pdf: number) => plotHeight - (pdf / maxPdf) * plotHeight;

  // Build reference curve path (filled)
  let refPath = '';
  if (referenceMu !== undefined && referenceSigma !== undefined) {
    const refPoints: string[] = [`M ${toPixelX(xSamples[0])} ${plotHeight}`];
    for (const x of xSamples) {
      const pdf = gaussianPDF(x, referenceMu, referenceSigma);
      refPoints.push(`L ${toPixelX(x).toFixed(2)} ${toPixelY(pdf).toFixed(2)}`);
    }
    refPoints.push(`L ${toPixelX(xSamples[xSamples.length - 1])} ${plotHeight} Z`);
    refPath = refPoints.join(' ');
  }

  // Build main curve path (filled)
  const mainPoints: string[] = [`M ${toPixelX(xSamples[0])} ${plotHeight}`];
  for (const x of xSamples) {
    const pdf = gaussianPDF(x, mu, sigma);
    mainPoints.push(`L ${toPixelX(x).toFixed(2)} ${toPixelY(pdf).toFixed(2)}`);
  }
  mainPoints.push(`L ${toPixelX(xSamples[xSamples.length - 1])} ${plotHeight} Z`);
  const mainPath = mainPoints.join(' ');

  // Generate x-axis ticks
  const tickStep = Math.ceil((maxX - minX) / 10);
  const ticks: number[] = [];
  const startTick = Math.ceil(minX);
  for (let t = startTick; t <= maxX; t += 1) {
    if (t >= minX && t <= maxX) ticks.push(t);
  }

  // Label positions (above peaks)
  const mainLabelX = toPixelX(mu);
  const mainLabelY = toPixelY(mainPeakPdf) - 12;
  const refLabelX = referenceMu !== undefined ? toPixelX(referenceMu) : 0;
  const refLabelY =
    referenceMu !== undefined && referenceSigma !== undefined
      ? toPixelY(refPeakPdf) - 12
      : 0;

  return (
    <div className="flex flex-col items-center w-full" style={{ fontFamily: 'Georgia, serif' }}>
      {/* Top row: Skill estimate and Uncertainty */}
      <div className="flex justify-between w-full max-w-xl mb-8">
        {/* Skill estimate μ */}
        <div className="text-center flex-1">
          <div className="text-xl font-bold mb-3" style={{ color: HEADER_COLOR }}>
            Skill estimate <InlineMath math="\mu" />
          </div>
          <div
            className="inline-block px-10 py-4 text-4xl font-bold rounded-full"
            style={{ background: BLUE_PILL_BG, color: BLUE_PILL_TEXT }}
          >
            {mu.toFixed(2)}
          </div>
          <div className="mt-3 text-sm" style={{ color: LABEL_GRAY }}>
            The center of the
            <br />
            model skill distribution.
          </div>
        </div>

        {/* Uncertainty σ */}
        <div className="text-center flex-1">
          <div className="text-xl font-bold mb-3" style={{ color: HEADER_COLOR }}>
            Uncertainty <InlineMath math="\sigma" />
          </div>
          <div
            className="inline-block px-10 py-4 text-4xl font-bold rounded-full"
            style={{ background: BLUE_PILL_BG, color: BLUE_PILL_TEXT }}
          >
            {sigma.toFixed(2)}
          </div>
          <div className="mt-3 text-sm" style={{ color: LABEL_GRAY }}>
            The variability of
            <br />
            the model's skill.
          </div>
        </div>
      </div>

      {/* Middle: 99.7% Confidence Interval */}
      <div className="text-center mb-8">
        <div className="text-2xl font-bold mb-5" style={{ color: HEADER_COLOR }}>
          99.7% Confidence Interval
        </div>

        <div className="flex items-center justify-center gap-6 mb-3">
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

        <div className="flex justify-center gap-24 mb-4">
          <div className="text-sm font-bold" style={{ color: HEADER_COLOR }}>
            Pessimistic rating
          </div>
          <div className="text-sm font-bold" style={{ color: HEADER_COLOR }}>
            Optimistic rating
          </div>
        </div>

        <div className="text-sm" style={{ color: LABEL_GRAY }}>
          99.7% of the time, the model will demonstrate skill within this interval.
        </div>
        <div className="text-sm mt-1" style={{ color: LABEL_GRAY }}>
          (Calculated as <InlineMath math="\mu \pm 3\sigma" />)
        </div>
      </div>

      {/* Bottom: Bell curve chart */}
      <svg
        width={chartWidth}
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        style={{ overflow: 'visible' }}
      >
        {/* Reference curve (behind) */}
        {refPath && (
          <path d={refPath} fill={REF_FILL} fillOpacity={0.6} stroke={REF_STROKE} strokeWidth="2" />
        )}

        {/* Main curve (in front) */}
        <path d={mainPath} fill={CURRENT_FILL} fillOpacity={0.7} stroke={CURRENT_STROKE} strokeWidth="2.5" />

        {/* X-axis line */}
        <line x1={0} y1={plotHeight} x2={chartWidth} y2={plotHeight} stroke="#999999" strokeWidth="1" />

        {/* X-axis ticks and labels */}
        {ticks.map((tick) => {
          const px = toPixelX(tick);
          return (
            <g key={tick}>
              <line x1={px} y1={plotHeight} x2={px} y2={plotHeight + 6} stroke="#999999" strokeWidth="1" />
              <text x={px} y={plotHeight + 20} textAnchor="middle" fontSize="13" fill="#333333">
                {tick}
              </text>
            </g>
          );
        })}

        {/* X-axis label */}
        <text x={chartWidth / 2} y={chartHeight - 2} textAnchor="middle" fontSize="14" fill="#333333">
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
    </div>
  );
}
