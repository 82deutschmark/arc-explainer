/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-05
 * PURPOSE: The shared frame for the leaderboard page's three hand-drawn SVG charts (score
 *          by rank, the race over time, watched teams): fixed viewBox that scales to the
 *          card width, horizontal score gridlines every ten points, axis labels, and a
 *          hover layer that turns the pointer position into chart coordinates and shows a
 *          small tooltip. Each chart supplies only its own marks and its tooltip text.
 *
 *          Colours come from the site's theme variables through inline styles, so the
 *          charts follow light and dark mode without listening for theme changes (the old
 *          arc-3 page read computed colours once and had to redraw on every theme flip).
 * SRP/DRY check: Pass - the three charts were three copies of this scaffolding in the
 *          original page; here it exists once. No chart library, per the port plan.
 */

import { useRef, useState, type ReactNode } from 'react';

export const W = 960;
export const PAD = { L: 48, R: 16, T: 14, B: 32 };

export const AXIS_TEXT = { fill: 'var(--muted-foreground)', fontSize: 11 } as const;

/** Round a top score up to the next ten, never below ten. */
export const niceMax = (v: number) => Math.max(10, Math.ceil(v / 10) * 10);

interface ChartFrameProps {
  height: number;
  label: string;
  /** Top of the score axis; gridlines are drawn every ten points from zero. */
  ymax: number;
  /** Maps a score to an SVG y. */
  y: (score: number) => number;
  /** X-axis tick labels as [svg x, text, anchor]. */
  xTicks: Array<[number, string, 'start' | 'middle' | 'end']>;
  xTitle?: string;
  /** Turns an SVG-space x inside the plot into tooltip content, or null for none. */
  tooltipAt?: (svgX: number) => ReactNode | null;
  children: ReactNode;
}

export function ChartFrame({ height, label, ymax, y, xTicks, xTitle, tooltipAt, children }: ChartFrameProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; body: ReactNode } | null>(null);
  const plotW = W - PAD.L - PAD.R;
  const plotH = height - PAD.T - PAD.B;

  const grid: number[] = [];
  for (let v = 0; v <= ymax; v += 10) grid.push(v);

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (!tooltipAt || !svgRef.current) return;
    const bb = svgRef.current.getBoundingClientRect();
    const body = tooltipAt((e.clientX - bb.left) * (W / bb.width));
    setTip(body ? { x: e.clientX - bb.left, y: e.clientY - bb.top, body } : null);
  };

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label} className="block h-auto w-full">
        {grid.map((v) => (
          <g key={v}>
            <line x1={PAD.L} x2={W - PAD.R} y1={y(v)} y2={y(v)} style={{ stroke: 'var(--border)' }} />
            <text x={PAD.L - 6} y={y(v) + 4} textAnchor="end" style={AXIS_TEXT}>{v}</text>
          </g>
        ))}
        {xTicks.map(([x, text, anchor]) => (
          <text key={`${x}-${text}`} x={x} y={height - PAD.B + 17} textAnchor={anchor} style={AXIS_TEXT}>{text}</text>
        ))}
        {xTitle && (
          <text x={(PAD.L + W - PAD.R) / 2} y={height - 2} textAnchor="middle" style={AXIS_TEXT}>{xTitle}</text>
        )}
        {children}
        <rect
          x={PAD.L}
          y={PAD.T}
          width={plotW}
          height={plotH}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setTip(null)}
        />
      </svg>
      {tip && <ChartTooltip x={tip.x} y={tip.y} width={svgRef.current?.clientWidth ?? 0}>{tip.body}</ChartTooltip>}
    </div>
  );
}

function ChartTooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  // Keep the box inside the chart: flip to the left of the pointer near the right edge.
  const flip = x > width - 270;
  return (
    <div
      className="pointer-events-none absolute z-10 max-w-[260px] rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
      style={{
        left: flip ? undefined : x + 12,
        right: flip ? width - x + 12 : undefined,
        top: Math.max(4, y - 12),
        transform: 'translateY(-100%)',
      }}
    >
      {children}
    </div>
  );
}

/** Points to an SVG polyline string. */
export const polyPoints = (pts: Array<[number, number]>) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** A small coloured line swatch for legends and chips. */
export function Swatch({ color }: { color: string }) {
  return <span className="mr-1.5 inline-block w-4 border-t-[3px] align-middle" style={{ borderColor: color }} />;
}
