/**
 * Author: Codex
 * Date: 2025-12-15
 * PURPOSE: Lightweight SVG renderer for Worm Arena that uses Twemoji icons for the mobile bug board.
 * SRP/DRY check: Pass - renders only the grid, apples, and snakes with minimal state logic.
 */

import React, { useMemo } from 'react';
import twemoji from 'twemoji';

export interface WormArenaGameBoardSVGProps {
  frame?: any;
  boardWidth: number;
  boardHeight: number;
}

const CELL_SIZE = 40;
const PADDING = 16;
const GRID_STROKE = '#ccc';
const BODY_OPACITY = 0.75;
const TWEMOJI_VERSION = '14.0.2';

const svgOptions = {
  folder: 'svg',
  ext: '.svg',
} as const;

const extractSrc = (html: string): string => {
  const match = html.match(/src="([^"]+)"/);
  return match ? match[1] : '';
};

const resolveTwemoji = (emoji: string): string => {
  try {
    const html = twemoji.parse(emoji, {
      ...svgOptions,
      base: `https://cdnjs.cloudflare.com/ajax/libs/twemoji/${TWEMOJI_VERSION}/`,
    });
    return extractSrc(html);
  } catch {
    return '';
  }
};

export default function WormArenaGameBoardSVG({
  frame,
  boardWidth,
  boardHeight,
}: WormArenaGameBoardSVGProps) {
  const width = boardWidth * CELL_SIZE + PADDING * 2;
  const height = boardHeight * CELL_SIZE + PADDING * 2;
  const snakes: Record<string, Array<[number, number]>> = frame?.state?.snakes ?? {};
  const apples: Array<[number, number]> = frame?.state?.apples ?? [];

  const bugHeadSrc = useMemo(() => resolveTwemoji('🐛'), []);
  const appleSrc = useMemo(() => resolveTwemoji('🍎'), []);

  const renderApple = ([x, y]: [number, number], idx: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < 0 || y < 0 || x >= boardWidth || y >= boardHeight) return null;
    const cx = PADDING + x * CELL_SIZE;
    const renderY = boardHeight - 1 - y;
    const cy = PADDING + renderY * CELL_SIZE;

    if (appleSrc) {
      return (
        <image
          key={`apple-${idx}`}
          href={appleSrc}
          x={cx + 4}
          y={cy + 4}
          width={CELL_SIZE - 8}
          height={CELL_SIZE - 8}
          preserveAspectRatio="xMidYMid meet"
        />
      );
    }

    return (
      <circle
        key={`apple-${idx}`}
        cx={cx + CELL_SIZE / 2}
        cy={cy + CELL_SIZE / 2}
        r={CELL_SIZE / 4}
        fill="#dc2626"
      />
    );
  };

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="rounded-xl border-8">
      {Array.from({ length: boardWidth + 1 }).map((_, idx) => (
        <line
          key={`v${idx}`}
          x1={PADDING + idx * CELL_SIZE}
          y1={PADDING}
          x2={PADDING + idx * CELL_SIZE}
          y2={PADDING + boardHeight * CELL_SIZE}
          stroke={GRID_STROKE}
        />
      ))}
      {Array.from({ length: boardHeight + 1 }).map((_, idx) => (
        <line
          key={`h${idx}`}
          x1={PADDING}
          y1={PADDING + idx * CELL_SIZE}
          x2={PADDING + boardWidth * CELL_SIZE}
          y2={PADDING + idx * CELL_SIZE}
          stroke={GRID_STROKE}
        />
      ))}

      {apples.map(renderApple)}

      {Object.entries(snakes).reduce<React.ReactNode[]>((acc, [sid, positions]) => {
        const fillColor = sid === '0' ? '#fbbf24' : '#ef4444';

        positions.forEach((pos, idx) => {
          if (!Array.isArray(pos)) return;
          const [x, y] = pos;
          if (!Number.isFinite(x) || !Number.isFinite(y)) return;
          if (x < 0 || y < 0 || x >= boardWidth || y >= boardHeight) return;

          const cellX = PADDING + x * CELL_SIZE;
          const renderY = boardHeight - 1 - y;
          const cellY = PADDING + renderY * CELL_SIZE;

          if (idx === 0 && bugHeadSrc) {
            acc.push(
              <image
                key={`snake-head-${sid}-${idx}`}
                href={bugHeadSrc}
                x={cellX + 4}
                y={cellY + 4}
                width={CELL_SIZE - 8}
                height={CELL_SIZE - 8}
                preserveAspectRatio="xMidYMid meet"
              />,
            );
            return;
          }

          acc.push(
            <rect
              key={`snake-${sid}-${idx}`}
              x={cellX + 4}
              y={cellY + 4}
              width={CELL_SIZE - 8}
              height={CELL_SIZE - 8}
              fill={fillColor}
              opacity={idx === 0 ? 1 : BODY_OPACITY}
              rx={6}
            />,
          );
        });

        return acc;
      }, [])}
    </svg>
  );
}
