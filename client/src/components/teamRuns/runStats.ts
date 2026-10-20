/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-19
 * PURPOSE: The numbers and filters on the team's ARC-AGI-2 runs list (the Boss, 19-Oct-2026:
 *          "more stats", "more searchable", "more data-dense"). Everything here is counted or
 *          read straight from the submissions Kaggle reports; nothing is estimated:
 *          - the team best and when it was set, and which submissions set a new team best;
 *          - per person: submissions, best score, latest;
 *          - submissions in the last seven days;
 *          - a section of Claude's note (the verdict is the one-line read on the list);
 *          - the filter and search the list applies, kept in the page address so a filtered
 *            view can be shared.
 * SRP/DRY check: Pass - pure functions over RunRow; the page draws them. The baseline rule
 *          stays in teamRunsApi.ts (effectiveBaseline).
 */

import type { RunRow } from './teamRunsApi';

export const scored = (r: Pick<RunRow, 'status' | 'publicScore'>) => r.status === 'complete' && r.publicScore != null;

/** Keys of submissions that beat every earlier scored submission when they landed. */
export function newBestKeys(rows: RunRow[]): Set<string> {
  const keys = new Set<string>();
  let best = -Infinity;
  for (const r of [...rows].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))) {
    if (scored(r) && r.publicScore! > best) {
      best = r.publicScore!;
      keys.add(r.key);
    }
  }
  return keys;
}

export interface PersonStats {
  who: string;
  count: number;
  scoredCount: number;
  best: RunRow | null;
  latest: RunRow;
}

export interface TeamStats {
  total: number;
  scoredCount: number;
  failedCount: number;
  lastWeek: number;
  best: RunRow | null;
  latest: RunRow | null;
  people: PersonStats[];
}

const better = (a: RunRow | null, r: RunRow) => (scored(r) && (!a || r.publicScore! > a.publicScore!) ? r : a);

export function teamStats(rows: RunRow[], now = Date.now()): TeamStats {
  const people = new Map<string, PersonStats>();
  let best: RunRow | null = null;
  let latest: RunRow | null = null;
  for (const r of rows) {
    best = better(best, r);
    if (!latest || r.submittedAt > latest.submittedAt) latest = r;
    const p = people.get(r.who) ?? { who: r.who, count: 0, scoredCount: 0, best: null, latest: r };
    p.count += 1;
    if (scored(r)) p.scoredCount += 1;
    p.best = better(p.best, r);
    if (r.submittedAt > p.latest.submittedAt) p.latest = r;
    people.set(r.who, p);
  }
  return {
    total: rows.length,
    scoredCount: rows.filter(scored).length,
    failedCount: rows.filter((r) => r.status === 'error').length,
    lastWeek: rows.filter((r) => now - Date.parse(r.submittedAt) < 7 * 86_400_000).length,
    best,
    latest,
    people: [...people.values()].sort((a, b) => b.latest.submittedAt.localeCompare(a.latest.submittedAt)),
  };
}

/** One "## Heading" section of Claude's note, as plain text (bullets joined), or null. */
export function noteSection(markdown: string | null | undefined, heading: string): string | null {
  if (!markdown) return null;
  const at = markdown.indexOf(`## ${heading}`);
  if (at === -1) return null;
  const rest = markdown.slice(at + heading.length + 3);
  const end = rest.indexOf('\n## ');
  return (end === -1 ? rest : rest.slice(0, end))
    .split('\n').map((l) => l.replace(/^\s*[-*]\s+/, '').replace(/\*\*/g, '').trim()).filter(Boolean).join(' ') || null;
}

// ── filters ────────────────────────────────────────────────────────────────────────────

export type Since = 'all' | '7d' | '30d';
export type Show = 'all' | 'scored' | 'best' | 'failed' | 'noted';
export type Sort = 'newest' | 'score';

export interface RunFilter {
  q: string;
  who: string;      // '' = everyone
  since: Since;
  show: Show;
  sort: Sort;
}

export const DEFAULT_FILTER: RunFilter = { q: '', who: '', since: 'all', show: 'all', sort: 'newest' };

export function readFilter(search: string): RunFilter {
  const p = new URLSearchParams(search);
  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T =>
    (allowed as readonly string[]).includes(p.get(key) ?? '') ? (p.get(key) as T) : fallback;
  return {
    q: p.get('q') ?? '',
    who: p.get('who') ?? '',
    since: pick('since', ['all', '7d', '30d'] as const, 'all'),
    show: pick('show', ['all', 'scored', 'best', 'failed', 'noted'] as const, 'all'),
    sort: pick('sort', ['newest', 'score'] as const, 'newest'),
  };
}

/** The filter as a query string, leaving out defaults so a plain view has a plain address. */
export function writeFilter(f: RunFilter): string {
  const p = new URLSearchParams();
  for (const key of Object.keys(DEFAULT_FILTER) as (keyof RunFilter)[]) {
    if (f[key] && f[key] !== DEFAULT_FILTER[key]) p.set(key, f[key]);
  }
  const text = p.toString();
  return text ? `?${text}` : '';
}

/** Everything a search can match on: the run's words, the team's note, Claude's note, the notebook. */
function haystack(r: RunRow): string {
  return [r.key, r.who, r.submittedBy, r.description, r.note?.note, r.summary?.markdown, r.kernel?.ref, r.status]
    .filter(Boolean).join(' ').toLowerCase();
}

export function applyFilter(rows: RunRow[], f: RunFilter, bestKeys: Set<string>, now = Date.now()): RunRow[] {
  const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const window = f.since === '7d' ? 7 : f.since === '30d' ? 30 : null;
  const out = rows.filter((r) => {
    if (f.who && r.who !== f.who) return false;
    if (window && now - Date.parse(r.submittedAt) > window * 86_400_000) return false;
    if (f.show === 'scored' && !scored(r)) return false;
    if (f.show === 'best' && !bestKeys.has(r.key)) return false;
    if (f.show === 'failed' && r.status !== 'error') return false;
    if (f.show === 'noted' && r.summary?.state !== 'done') return false;
    if (words.length) {
      const text = haystack(r);
      if (!words.every((w) => text.includes(w))) return false;
    }
    return true;
  });
  return f.sort === 'score'
    ? out.sort((a, b) => (b.publicScore ?? -1) - (a.publicScore ?? -1) || b.submittedAt.localeCompare(a.submittedAt))
    : out.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
