/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-21
 * PURPOSE: Figures for the speed / kernel / profile runs of the runs API (Son's ask, 21-Oct-2026):
 *          how a metric reads (label, unit, which way is better), the rows of the side-by-side
 *          tables (every metric any arm reports; the profile's span, GPU busy and per-family
 *          ms), the best arm per row, the ratio to the baseline arm, number text, and the
 *          metric the runs list shows per arm. The metric names are the ones docs/RUNS_API.md
 *          (the team's arc2026 repository) documents; a run's own metricInfo overrides them, and
 *          an unknown name is ranked by its unit part (…Ms… / …Us… / …Seconds lower, …TokS… higher)
 *          or not at all.
 * SRP/DRY check: Pass - pure functions, no React; the accuracy runs' figures stay in
 *          evalStats.ts. Shown by ArmsView.tsx and pages/team/Arc2Evals.tsx.
 */

import type { MetricInfo, RunArm } from './teamEvalsApi';

/** The documented metric names (docs/RUNS_API.md), as the pages show them. */
export const METRICS: Readonly<Record<string, MetricInfo>> = {
  genTokS: { label: 'decode tok/s', unit: 'tok/s', better: 'higher' },
  perLaneTokS: { label: 'tok/s per lane', unit: 'tok/s', better: 'higher' },
  promptTokS: { label: 'prefill tok/s', unit: 'tok/s', better: 'higher' },
  stepMs: { label: 'decode step', unit: 'ms', better: 'lower' },
  lanes: { label: 'lanes' },
  runningMean: { label: 'running (mean)' },
  windowSeconds: { label: 'measured window', unit: 's' },
  kvTokens: { label: 'KV pool', unit: 'tokens', better: 'higher' },
  kvGiB: { label: 'KV memory', unit: 'GiB', better: 'higher' },
  kvUsageMax: { label: 'KV usage (max)' },
  preemptions: { label: 'preemptions', better: 'lower' },
  weightsGiB: { label: 'weights', unit: 'GiB', better: 'lower' },
  serverReadySeconds: { label: 'server ready', unit: 's', better: 'lower' },
  solved: { label: 'solved', better: 'higher' },
  parsed: { label: 'answered (parsed)', better: 'higher' },
  capOuts: { label: 'cap-outs', better: 'lower' },
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
/** An arm that ran: failed and skipped arms are shown but never ranked or used as the baseline. */
export const armRan = (arm: RunArm) => arm.status === undefined || arm.status === 'ok';

/**
 * The run's own metricInfo first, then the documented names, then a guess from the name: its unit part ranks
 * it, and a kernel timing "<what>.m<rows><Us|Ms>" (gdn_in_qkvz.m17Us, denseMsPerStep.m17) reads
 * "<what> · m=<rows>" in µs or ms.
 */
export function metricInfo(name: string, own?: Record<string, MetricInfo> | null): MetricInfo {
  const guess: MetricInfo = /(Ms|Us|Seconds)([A-Z.]|$)/.test(name) ? { better: 'lower' } : /TokS([A-Z.]|$)/.test(name) ? { better: 'higher' } : {};
  const rows = /^(.+)\.m(\d+)(Us|Ms)?$/.exec(name);
  if (rows) {
    const unit = rows[3] === 'Us' ? 'µs' : rows[3] === 'Ms' || /Ms([A-Z]|$)/.test(rows[1]) ? 'ms' : undefined;
    Object.assign(guess, { label: `${rows[1]} · m=${rows[2]}`, unit });
  }
  return { label: name, ...guess, ...METRICS[name], ...own?.[name] };
}

export interface SideRow {
  key: string;
  info: MetricInfo;
  /** One value per arm, in the run's arm order. */
  values: Array<number | null>;
  /** The column of the best value, when the row is ranked and two or more arms that ran have one. */
  best: number | null;
}

export function bestIndex(values: Array<number | null>, arms: RunArm[], better: MetricInfo['better']): number | null {
  if (!better) return null;
  const ranked = values.map((value, i) => [value, i] as const).filter(([value, i]) => finite(value) && armRan(arms[i]));
  if (ranked.length < 2) return null;
  const pick = ranked.reduce((a, b) => ((better === 'higher' ? b[0]! > a[0]! : b[0]! < a[0]!) ? b : a));
  // A tie for best marks nothing: no arm won the row.
  return ranked.filter(([value]) => value === pick[0]).length > 1 ? null : pick[1];
}

const row = (key: string, info: MetricInfo, values: Array<number | null>, arms: RunArm[]): SideRow =>
  ({ key, info, values, best: bestIndex(values, arms, info.better) });

/** Every metric any arm reports, in the order the arms first report them. */
export function metricRows(arms: RunArm[], own?: Record<string, MetricInfo> | null): SideRow[] {
  const names: string[] = [];
  for (const arm of arms) for (const name of Object.keys(arm.metrics ?? {})) if (!names.includes(name)) names.push(name);
  return names.map((name) => row(name, metricInfo(name, own), arms.map((arm) => (finite(arm.metrics?.[name]) ? arm.metrics![name] : null)), arms));
}

/** The arm the others are compared to: the run's named baseline, else the first arm that ran (or -1). */
export function baselineIndex(arms: RunArm[], baseline?: string | null): number {
  const named = baseline ? arms.findIndex((arm) => arm.name === baseline) : -1;
  return named >= 0 ? named : arms.findIndex(armRan);
}

/** Span and GPU busy per decode step, then every kernel family by the baseline arm's time, largest first. */
export function profileRows(arms: RunArm[], base: number): SideRow[] {
  if (!arms.some((arm) => arm.profile)) return [];
  const families: string[] = [];
  for (const arm of arms) for (const name of Object.keys(arm.profile?.familiesMs ?? {})) if (!families.includes(name)) families.push(name);
  const ms = (arm: RunArm, family: string) => {
    const value = arm.profile?.familiesMs?.[family];
    return finite(value) ? value : null;
  };
  const order = arms[base] ?? arms[0];
  families.sort((a, b) => (ms(order, b) ?? -1) - (ms(order, a) ?? -1));
  const busy = arms.map((arm) => (finite(arm.profile?.gpuBusyFrac) ? Math.round(arm.profile!.gpuBusyFrac! * 1000) / 10 : null));
  return [
    row('spanMsPerIter', { label: 'step span', unit: 'ms', better: 'lower' }, arms.map((arm) => (finite(arm.profile?.spanMsPerIter) ? arm.profile!.spanMsPerIter! : null)), arms),
    row('gpuBusyPct', { label: 'GPU busy', unit: '%' }, busy, arms),
    ...families.map((family) => row(`family:${family}`, { label: family, unit: 'ms', better: 'lower' }, arms.map((arm) => ms(arm, family)), arms)),
  ].filter((r) => r.values.some((value) => value !== null));
}

/** value / baseline, for "×1.05" beside a value; null when either is missing or the baseline is zero. */
export function ratio(value: number | null, base: number | null): number | null {
  return finite(value) && finite(base) && base !== 0 ? value / base : null;
}

const digitsFor = (size: number) => (size >= 1000 ? 0 : size >= 100 ? 1 : size >= 1 ? 2 : 3);

/** One digit count for a whole table row, so its numbers line up: none when all are whole, else by the largest. */
export function rowDigits(values: Array<number | null>): number {
  const nums = values.filter(finite);
  if (!nums.length || nums.every(Number.isInteger)) return 0;
  return digitsFor(Math.max(...nums.map(Math.abs)));
}

/** Digits by size (1,123,853 · 448.4 · 75.84 · 0.852), or the row's own count. */
export function metricText(value: number | null | undefined, digits?: number): string {
  if (!finite(value)) return '—';
  const shown = digits ?? (Number.isInteger(value) ? 0 : digitsFor(Math.abs(value)));
  return value.toLocaleString('en-US', { minimumFractionDigits: shown, maximumFractionDigits: shown });
}

/** The metric the runs list shows per arm: the run's headline, else decode tok/s, else the first one reported. */
export function headlineMetric(arms: Array<Pick<RunArm, 'metrics'>>, headline?: string | null): string | null {
  const has = (name: string) => arms.some((arm) => finite(arm.metrics?.[name]));
  if (headline && has(headline)) return headline;
  if (has('genTokS')) return 'genTokS';
  for (const arm of arms) for (const [name, value] of Object.entries(arm.metrics ?? {})) if (finite(value)) return name;
  return null;
}
