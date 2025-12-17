/**
 * Author: GPT-5.2-Medium-Reasoning
 * Date: 2025-12-17
 * PURPOSE: Stacked bell-curve overlay for Worm Arena skill comparison. Mirrors the
 *          scatter-plot selection order so users can compare mu/sigma distributions with
 *          consistent color semantics and hover states.
 * SRP/DRY check: Pass — responsible solely for rendering Gaussian curves; relies on
 *                shared math utilities and accepts data via props.
 */

import React, { useMemo } from 'react';
import type { SnakeBenchTrueSkillLeaderboardEntry } from '@shared/types';
import {
  gaussianPDF,
  getConfidenceInterval,
} from '@/utils/confidenceIntervals';

const CURVE_WIDTH = 600;
const CURVE_HEIGHT = 110;
const SAMPLE_POINTS = 180;
const SIGMA_RANGE = 3.5;
const AXIS_TICK_COUNT = 4;

export interface WormArenaMultiCurveOverlayProps {
  models: SnakeBenchTrueSkillLeaderboardEntry[];
  hoveredModel: string | null;
  onCurveHover: (modelSlug: string | null) => void;
  colorPalette: readonly string[];
}

/**
 * Build evenly spaced tick marks so every curve can share the same x-axis labels.
 */
function getSharedTicks(min: number, max: number): number[] {
  if (min === max) {
    return [min];
  }
  const tickCount = AXIS_TICK_COUNT;
  const span = max - min;
  return Array.from({ length: tickCount }, (_, index) => min + (span / (tickCount - 1)) * index);
}

const formatNumber = (value: number): string => value.toFixed(2);

export default function WormArenaMultiCurveOverlay({
  models,
  hoveredModel,
  onCurveHover,
  colorPalette,
}: WormArenaMultiCurveOverlayProps) {
  const hasModels = models.length > 0;

  const globalBounds = useMemo(() => {
    if (!hasModels) {
      return { min: 0, max: 1 };
    }

    const lowerBounds = models.map((model) => model.mu - SIGMA_RANGE * model.sigma);
    const upperBounds = models.map((model) => model.mu + SIGMA_RANGE * model.sigma);

    return {
      min: Math.min(...lowerBounds),
      max: Math.max(...upperBounds),
    };
  }, [hasModels, models]);

  const axisTicks = useMemo(
    () => getSharedTicks(globalBounds.min, globalBounds.max),
    [globalBounds.max, globalBounds.min],
  );

  const buildPath = (model: SnakeBenchTrueSkillLeaderboardEntry) => {
    const { min, max } = globalBounds;
    const span = max - min || 1;
    const points: Array<[number, number]> = [];
    const maxPdf = gaussianPDF(model.mu, model.mu, model.sigma);

    for (let index = 0; index < SAMPLE_POINTS; index += 1) {
      const ratio = index / (SAMPLE_POINTS - 1);
      const xValue = min + ratio * span;
      const pdf = gaussianPDF(xValue, model.mu, model.sigma);
      const x = ratio * CURVE_WIDTH;
      const normalizedHeight = (pdf / maxPdf) * (CURVE_HEIGHT * 0.8);
      const y = CURVE_HEIGHT - normalizedHeight;
      points.push([x, Number.isFinite(y) ? y : CURVE_HEIGHT]);
    }

    const commands = [`M 0 ${CURVE_HEIGHT}`];
    points.forEach(([x, y]) => {
      commands.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
    });
    commands.push(`L ${CURVE_WIDTH} ${CURVE_HEIGHT}`);
    commands.push('Z');
    return commands.join(' ');
  };

  if (!hasModels) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-worm-border bg-white p-4">
      {models.map((model, index) => {
        const color = colorPalette[index] ?? colorPalette[colorPalette.length - 1];
        const isDimmed = hoveredModel !== null && hoveredModel !== model.modelSlug;
        const confidence = getConfidenceInterval(model.mu, model.sigma, 3);

        return (
          <div
            key={model.modelSlug}
            role="button"
            tabIndex={0}
            aria-pressed={hoveredModel === model.modelSlug}
            onMouseEnter={() => onCurveHover(model.modelSlug)}
            onMouseLeave={() => onCurveHover(null)}
            onFocus={() => onCurveHover(model.modelSlug)}
            onBlur={() => onCurveHover(null)}
            className="rounded-md p-2 transition-opacity duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white"
            style={{
              opacity: isDimmed ? 0.35 : 1,
              border: `1px solid ${color}30`,
            }}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold" style={{ color }}>
                {index + 1}. {model.modelSlug}
              </span>
              <div className="text-xs text-worm-muted">
                mu {formatNumber(model.mu)} · sigma {formatNumber(model.sigma)} ·{' '}
                {model.wins}W/{model.losses}L/{model.ties}T · games {model.gamesPlayed}
              </div>
            </div>
            <svg width={CURVE_WIDTH} height={CURVE_HEIGHT} role="img" aria-label={`Bell curve for ${model.modelSlug}`}>
              <path
                d={buildPath(model)}
                fill={color}
                fillOpacity={0.18}
                stroke={color}
                strokeWidth={2}
              />
              {/* Shared x-axis ticks */}
              <g transform={`translate(0, ${CURVE_HEIGHT})`}>
                <line x1={0} x2={CURVE_WIDTH} y1={0} y2={0} stroke="#8B6A47" strokeWidth={1} />
                {axisTicks.map((tick) => {
                  const ratio = (tick - globalBounds.min) / ((globalBounds.max - globalBounds.min) || 1);
                  const x = ratio * CURVE_WIDTH;
                  return (
                    <g key={`${model.modelSlug}-tick-${tick.toFixed(3)}`} transform={`translate(${x}, 0)`}>
                      <line y2={8} stroke="#8B6A47" strokeWidth={1} />
                      <text
                        y={20}
                        textAnchor="middle"
                        className="text-[10px] fill-worm-muted"
                      >
                        {formatNumber(tick)}
                      </text>
                    </g>
                  );
                })}
              </g>
              {/* Confidence interval marker */}
              <line
                x1={((confidence.lower - globalBounds.min) / ((globalBounds.max - globalBounds.min) || 1)) * CURVE_WIDTH}
                x2={((confidence.upper - globalBounds.min) / ((globalBounds.max - globalBounds.min) || 1)) * CURVE_WIDTH}
                y1={CURVE_HEIGHT * 0.85}
                y2={CURVE_HEIGHT * 0.85}
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
