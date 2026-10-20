/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-19
 * PURPOSE: The look of the team runs pages. The Boss, 19-Oct-2026: "think much more like a
 *          financial terminal." So these pages are a dark, monospaced trading screen whatever
 *          the site theme: amber labels, green up, red down, hairline rules, no rounded cards,
 *          no intro prose. This file holds the palette and the few building blocks (pane, stat,
 *          bracket toggle, person code) both pages use, so they can't drift apart.
 * SRP/DRY check: Pass - presentation primitives only; no data. Used by pages/team/Arc2Runs.tsx,
 *          Arc2Run.tsx and ScoreTimeline.tsx.
 */

import type { ReactNode } from 'react';

export const T = {
  bg: '#0a0c0f',
  panel: '#0f1216',
  rule: '#232931',
  text: '#d4d8de',
  dim: '#7d8590',
  amber: '#e3b341',
  up: '#3fb950',
  down: '#f85149',
  link: '#58a6ff',
  hover: '#161b22',
  mono: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
} as const;

/** Bright mid tones that read on the dark screen, one per person. */
export const PERSON_PALETTE = ['#58a6ff', '#f0883e', '#3fb950', '#d2a8ff', '#e3b341', '#8b949e'];

/** The page shell: full-bleed dark screen, monospace. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: T.bg, color: T.text, fontFamily: T.mono, minHeight: '100vh' }} className="text-[12px] leading-[1.45]">
      <div className="max-w-[1500px] mx-auto px-3 py-3">{children}</div>
    </div>
  );
}

/** A boxed pane with an amber title bar. */
export function Pane({ title, right, children, className = '' }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className} style={{ border: `1px solid ${T.rule}`, background: T.panel }}>
      <header className="flex items-center justify-between gap-3 px-2 py-[3px] uppercase tracking-[1px] text-[11px]"
              style={{ borderBottom: `1px solid ${T.rule}`, color: T.amber }}>
        <span>{title}</span>
        {right && <span style={{ color: T.dim }} className="normal-case tracking-normal">{right}</span>}
      </header>
      <div>{children}</div>
    </section>
  );
}

/** One figure in the top strip: LABEL value sub. */
export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="px-3 py-1.5 min-w-0" style={{ borderRight: `1px solid ${T.rule}` }}>
      <div className="text-[10px] uppercase tracking-[1px]" style={{ color: T.amber }}>{label}</div>
      <div className="text-[18px] font-bold tabular-nums leading-tight" style={{ color: tone ?? T.text }}>{value}</div>
      {sub && <div className="truncate text-[11px]" style={{ color: T.dim }}>{sub}</div>}
    </div>
  );
}

/** [LABEL] toggle, terminal style. */
export function Bracket({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title} className="px-1 uppercase hover:underline"
            style={{ color: on ? T.bg : T.text, background: on ? T.amber : 'transparent' }}>
      [{children}]
    </button>
  );
}

/** "Jack Cole" -> JC, "Son" -> SON: short codes for dense columns. */
export function personCode(who: string): string {
  const words = who.trim().split(/\s+/);
  return (words.length > 1 ? words.map((w) => w[0]).join('') : who.slice(0, 4)).toUpperCase();
}

/** Signed change, coloured: green up, red down. */
export function Delta({ value }: { value: number | null }) {
  if (value == null) return <span style={{ color: T.dim }}>—</span>;
  const tone = value > 0 ? T.up : value < 0 ? T.down : T.dim;
  return <span style={{ color: tone }}>{value > 0 ? '+' : value < 0 ? '−' : '±'}{Math.abs(value).toFixed(2)}</span>;
}

/** "10-19 00:06" in UTC: the date column of a dense table. */
export function stamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  return `${iso.slice(5, 10)} ${iso.slice(11, 16)}`;
}
