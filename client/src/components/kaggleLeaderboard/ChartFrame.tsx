/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-05
 * PURPOSE: The shared frame for the leaderboard page's hand-drawn SVG charts: a fixed
 *          viewBox that scales to the card width, hairline gridlines at caller-chosen
 *          ticks, axis labels, and a hover layer. On hover a chart returns where the
 *          pointer snaps to, what to say, and which points to ring; the frame draws a
 *          vertical crosshair, ringed dots on each series, and a tooltip that stays inside
 *          the card. Charts supply only their own marks.
 *
 *          Colours come from the site's theme variables via inline styles, so the charts
 *          follow light and dark mode with no redraw logic.
 * SRP/DRY check: Pass - every chart on the page shares this scaffolding; no chart library,
 *          per the port plan.
 */

import { useRef, useState, type ReactNode } from 'react';

export const W = 960;
export const PAD = { L: 52, R: 120, T: 16, B: 34 };

export const AXIS_TEXT = { fill: 'var(--muted-foreground)', fontSize: 11 } as const;
export const LABEL_TEXT = { fill: 'var(--foreground)', fontSize: 12 } as const;
export const GRID = { stroke: 'var(--border)' } as const;

export type Anchor = 'start' | 'middle' | 'end';

export interface HoverResult {
  /** SVG x the crosshair snaps to. */
  x: number;
  body: ReactNode;
  /** Points to ring on the crosshair, e.g. each series' value at that time. */
  dots?: Array<{ y: number; color: string }>;
}

interface ChartFrameProps {
  height: number;
  label: string;
  /** Horizontal gridlines: [svg y, label]. */
  yTicks: Array<[number, string]>;
  /** X-axis labels: [svg x, label, anchor]. */
  xTicks: Array<[number, string, Anchor]>;
  xTitle?: string;
  /** Right padding override, for charts with no end labels. */
  padRight?: number;
  hover?: (svgX: number, svgY: number) => HoverResult | null;
  children: ReactNode;
}

export function ChartFrame({ height, label, yTicks, xTicks, xTitle, padRight = PAD.R, hover, children }: ChartFrameProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [state, setState] = useState<{ px: number; py: number; hit: HoverResult } | null>(null);
  const plotRight = W - padRight;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    if (!hover || !svgRef.current) return;
    const bb = svgRef.current.getBoundingClientRect();
    const k = W / bb.width;
    const hit = hover((e.clientX - bb.left) * k, (e.clientY - bb.top) * k);
    setState(hit ? { px: e.clientX - bb.left, py: e.clientY - bb.top, hit } : null);
  };

  return (
    <div className="relative select-none">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label} className="block h-auto w-full overflow-visible">
        {yTicks.map(([y, text]) => (
          <g key={`${y}-${text}`}>
            <line x1={PAD.L} x2={plotRight} y1={y} y2={y} style={GRID} />
            <text x={PAD.L - 8} y={y + 4} textAnchor="end" style={AXIS_TEXT}>{text}</text>
          </g>
        ))}
        {xTicks.map(([x, text, anchor]) => (
          <text key={`${x}-${text}`} x={x} y={height - PAD.B + 18} textAnchor={anchor} style={AXIS_TEXT}>{text}</text>
        ))}
        {xTitle && (
          <text x={(PAD.L + plotRight) / 2} y={height - 2} textAnchor="middle" style={AXIS_TEXT}>{xTitle}</text>
        )}
        {children}
        {state && (
          <g pointerEvents="none">
            <line x1={state.hit.x} x2={state.hit.x} y1={PAD.T} y2={height - PAD.B} style={{ stroke: 'var(--muted-foreground)' }} strokeOpacity={0.5} />
            {state.hit.dots?.map((d, i) => (
              <circle key={i} cx={state.hit.x} cy={d.y} r={4.5} style={{ fill: d.color, stroke: 'var(--card)' }} strokeWidth={2} />
            ))}
          </g>
        )}
        <rect
          x={PAD.L}
          y={0}
          width={plotRight - PAD.L}
          height={height - PAD.B}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setState(null)}
        />
      </svg>
      {state && (
        <ChartTooltip x={state.px} y={state.py} width={svgRef.current?.clientWidth ?? 0}>
          {state.hit.body}
        </ChartTooltip>
      )}
    </div>
  );
}

function ChartTooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  // Flip to the left of the pointer in the right half so the box never leaves the card.
  const flip = x > width / 2;
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-[160px] max-w-[280px] rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
      style={{
        left: flip ? undefined : x + 14,
        right: flip ? width - x + 14 : undefined,
        top: Math.max(0, y - 16),
      }}
    >
      {children}
    </div>
  );
}

/** One line of a tooltip: colour key, name, value. Text stays in text colours. */
export function TipRow({ color, name, value, strong }: { color?: string; name: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? 'font-semibold' : ''}`}>
      <span className="flex min-w-0 items-center gap-1.5">
        {color && <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
        <span className="truncate">{name}</span>
      </span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

/** Points to an SVG polyline string. */
export const polyPoints = (pts: Array<[number, number]>) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Step path: hold each value until the next point (scores change only on submission). */
export function stepPoints(pts: Array<[number, number]>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const p of pts) {
    if (out.length) out.push([p[0], out[out.length - 1][1]]);
    out.push(p);
  }
  return out;
}

/** Evenly spaced "nice" ticks covering [lo, hi], roughly `count` of them. */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  const raw = (hi - lo) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/**
 * Spread end-of-line labels so none overlap, keeping each as close to its line as it can.
 * Returns the label y for each input y, in the same order.
 */
export function spreadLabels(ys: number[], minGap = 14, top = PAD.T, bottom = Infinity): number[] {
  const order = ys.map((y, i) => [y, i] as const).sort((a, b) => a[0] - b[0]);
  const placed: number[] = [];
  for (const [y] of order) placed.push(Math.max(y, (placed[placed.length - 1] ?? top - minGap) + minGap));
  // If pushed past the bottom, slide the whole stack back up.
  const over = placed.length ? placed[placed.length - 1] - bottom : 0;
  if (over > 0) for (let i = 0; i < placed.length; i++) placed[i] -= over;
  const out = new Array<number>(ys.length);
  order.forEach(([, i], k) => { out[i] = placed[k]; });
  return out;
}

/** Labelled line ends: a short leader from the line's last point to its label. */
export function EndLabels({ items, x, bottom }: { items: Array<{ y: number; text: string; color: string; bold?: boolean }>; x: number; bottom: number }) {
  const ys = spreadLabels(items.map((i) => i.y), 14, PAD.T, bottom);
  return (
    <g>
      {items.map((it, i) => (
        <g key={it.text}>
          <polyline points={polyPoints([[x + 2, it.y], [x + 10, ys[i]], [x + 14, ys[i]]])} fill="none" style={{ stroke: it.color }} strokeWidth={1} />
          <circle cx={x} cy={it.y} r={4} style={{ fill: it.color, stroke: 'var(--card)' }} strokeWidth={2} />
          <text x={x + 17} y={ys[i] + 4} style={{ ...LABEL_TEXT, fontWeight: it.bold ? 700 : 500 }}>{it.text}</text>
        </g>
      ))}
    </g>
  );
}
