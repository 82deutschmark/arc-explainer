/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Core bell curve visualization for TrueSkill distributions. Renders SVG Gaussian curves
 *          with optional reference model overlay, confidence interval band, and hover readouts.
 *          Uses react-katex InlineMath for μ labels and reserves chart margins so axis labels
 *          are visible (not clipped).
 * SRP/DRY check: Pass — single responsibility for bell curve rendering. Reuses confidenceIntervals.ts utilities.
 *
 * Touches: WormArenaSkillAnalysis.tsx (parent), confidenceIntervals.ts (utils)
 */

import React, { useState } from 'react';
import { InlineMath } from 'react-katex';
import {
  gaussianPDF,
  getMaxPDFInRange,
  generateXSamples,
  dataToPx,
  pxToData,
  normalizeToSVGHeight,
} from '@/utils/confidenceIntervals';

export interface WormArenaSkillDistributionChartProps {
  mu: number;
  sigma: number;
  exposed: number; // μ − 3σ

  // Optional: show faded reference curve behind
  referenceMu?: number;
  referenceSigma?: number;
  referenceLabel?: string;

  // Chart sizing
  width?: number; // default 500
  height?: number; // default 300
}

/**
 * Renders a production-quality bell curve visualization.
 *
 * TODO for next developer:
 * 1. Generate 200 sample points along x-axis from μ − 4σ to μ + 4σ
 * 2. Compute Gaussian PDF at each point
 * 3. Render layers in order:
 *    - Reference curve (if provided) — thin stroke, ~0.4 opacity, gray
 *    - Main curve — filled path, solid green
 *    - Confidence band [μ − 3σ, μ + 3σ] — light green shading at bottom
 *    - Vertical line at μ — dashed, subtle
 *    - X-axis with labeled ticks
 * 4. Add hover interactivity showing skill rating + PDF value
 * 5. Use <InlineMath> for any axis labels or legend text
 *
 * Reference implementations:
 * - WormArenaGlobalStatsStrip.tsx for worm-theme component patterns
 * - WormArenaModelSnapshotCard.tsx for InlineMath usage
 */
export default function WormArenaSkillDistributionChart({
  mu,
  sigma,
  exposed,
  referenceMu,
  referenceSigma,
  referenceLabel = 'Reference Model',
  width = 500,
  height = 300,
}: WormArenaSkillDistributionChartProps) {
  const [hoveredX, setHoveredX] = useState<number | null>(null);
  const [hoveredPDF, setHoveredPDF] = useState<number | null>(null);

  const svgWidth = width;
  const svgHeight = height;
  const axisMarginBottom = 28;
  const plotHeight = Math.max(60, svgHeight - axisMarginBottom);
  const sigmaRange = 4;

  // Calculate bounds
  const minX = mu - sigmaRange * sigma;
  const maxX = mu + sigmaRange * sigma;

  // Get max PDF for normalization
  const maxPdf = Math.max(
    getMaxPDFInRange(mu, sigma, minX, maxX),
    referenceMu && referenceSigma ? getMaxPDFInRange(referenceMu, referenceSigma, minX, maxX) : 0,
  );

  // Generate sample points
  const xSamples = generateXSamples(mu, sigma, 200, sigmaRange);

  // Build SVG path for main curve
  const mainPathPoints: string[] = ['M 0 ' + plotHeight];
  for (const x of xSamples) {
    const pdf = gaussianPDF(x, mu, sigma);
    const svgX = dataToPx(x, mu, sigma, svgWidth, sigmaRange);
    const svgY = normalizeToSVGHeight(pdf, maxPdf, plotHeight);
    mainPathPoints.push(`L ${svgX.toFixed(2)} ${svgY.toFixed(2)}`);
  }
  mainPathPoints.push('L ' + svgWidth + ' ' + plotHeight + ' Z');
  const mainPath = mainPathPoints.join(' ');

  // Build SVG path for reference curve (if provided)
  let referencePath = '';
  if (referenceMu !== undefined && referenceSigma !== undefined) {
    const refPathPoints: string[] = [];
    for (const x of xSamples) {
      const pdf = gaussianPDF(x, referenceMu, referenceSigma);
      const svgX = dataToPx(x, mu, sigma, svgWidth, sigmaRange);
      const svgY = normalizeToSVGHeight(pdf, maxPdf, plotHeight);
      if (refPathPoints.length === 0) {
        refPathPoints.push(`M ${svgX.toFixed(2)} ${svgY.toFixed(2)}`);
      } else {
        refPathPoints.push(`L ${svgX.toFixed(2)} ${svgY.toFixed(2)}`);
      }
    }
    referencePath = refPathPoints.join(' ');
  }

  // Confidence interval bounds
  const confLower = Number.isFinite(exposed) ? exposed : mu - 3 * sigma;
  const confUpper = mu + 3 * sigma;
  const confLowerPx = dataToPx(confLower, mu, sigma, svgWidth, sigmaRange);
  const confUpperPx = dataToPx(confUpper, mu, sigma, svgWidth, sigmaRange);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const pxX = e.clientX - rect.left;
    const dataX = pxToData(pxX, mu, sigma, svgWidth, sigmaRange);
    const pdfValue = gaussianPDF(dataX, mu, sigma);
    setHoveredX(dataX);
    setHoveredPDF(pdfValue);
  };

  const handleMouseLeave = () => {
    setHoveredX(null);
    setHoveredPDF(null);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="border border-worm-border rounded-lg bg-white"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Confidence interval band (bottom shading between μ-3σ and μ+3σ) */}
        <rect
          x={confLowerPx}
          y={plotHeight * 0.55}
          width={confUpperPx - confLowerPx}
          height={plotHeight - plotHeight * 0.55}
          fill="var(--worm-green)"
          opacity={0.1}
        />

        {/* Reference curve (if provided) */}
        {referencePath && (
          <path d={referencePath} stroke="var(--worm-muted)" strokeWidth="2" fill="none" opacity={0.4} />
        )}

        {/* Main curve */}
        <path d={mainPath} fill="var(--worm-green)" fillOpacity={0.7} stroke="var(--worm-green)" strokeWidth="2" />

        {/* Vertical line at μ */}
        <line
          x1={dataToPx(mu, mu, sigma, svgWidth, sigmaRange)}
          y1={0}
          x2={dataToPx(mu, mu, sigma, svgWidth, sigmaRange)}
          y2={plotHeight}
          stroke="var(--worm-ink)"
          strokeWidth="1"
          strokeDasharray="4,4"
          opacity={0.3}
        />

        {/* X-axis */}
        <line x1={0} y1={plotHeight} x2={svgWidth} y2={plotHeight} stroke="var(--worm-border)" strokeWidth="1" />

        {/* X-axis ticks and labels */}
        {(() => {
          const numTicks = 5;
          const tickLabels = [];
          for (let i = 0; i < numTicks; i++) {
            const t = i / (numTicks - 1);
            const skillValue = minX + t * (maxX - minX);
            const pxX = dataToPx(skillValue, mu, sigma, svgWidth, sigmaRange);
            const isCenter = Math.abs(skillValue - mu) < 0.1;

            tickLabels.push(
              <g key={`tick-${i}`}>
                {/* Tick mark */}
                <line
                  x1={pxX}
                  y1={plotHeight}
                  x2={pxX}
                  y2={plotHeight + 4}
                  stroke="var(--worm-border)"
                  strokeWidth="1"
                />
                {/* Label */}
                <text
                  x={pxX}
                  y={plotHeight + 16}
                  textAnchor="middle"
                  fill="var(--worm-muted)"
                  fontSize="11"
                >
                  {skillValue.toFixed(1)}
                  {isCenter ? '*' : ''}
                </text>
              </g>
            );
          }
          return tickLabels;
        })()}

        {/* X-axis label */}
        <text
          x={svgWidth / 2}
          y={svgHeight - 6}
          textAnchor="middle"
          fill="var(--worm-ink)"
          fontSize="12"
          opacity={0.9}
        >
          Skill Rating
        </text>

        {/* Hover tooltip indicator */}
        {hoveredX !== null && (
          <line
            x1={dataToPx(hoveredX, mu, sigma, svgWidth, sigmaRange)}
            y1={0}
            x2={dataToPx(hoveredX, mu, sigma, svgWidth, sigmaRange)}
            y2={plotHeight}
            stroke="var(--worm-ink)"
            strokeWidth="1"
            opacity={0.5}
          />
        )}
      </svg>

      {/* Tooltip display */}
      {hoveredX !== null && hoveredPDF !== null && (
        <div className="text-xs text-worm-muted text-center">
          <div>Skill Rating: {hoveredX.toFixed(2)}</div>
          <div>Density: {hoveredPDF.toExponential(3)}</div>
        </div>
      )}

      {/* Legend */}
      <div className="text-xs space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: 'var(--worm-green)', opacity: 0.7 }} />
          <span>Current Model</span>
        </div>
        {referenceMu !== undefined && (
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full border-2"
              style={{ borderColor: 'var(--worm-muted)', opacity: 0.4 }}
            />
            <span>{referenceLabel}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5" style={{ background: 'var(--worm-ink)', opacity: 0.3 }} />
          <span>
            Mean <InlineMath math="\\mu" />
          </span>
        </div>
      </div>
    </div>
  );
}
