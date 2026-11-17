/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-21
 * PURPOSE: Data for the team-only ARC-AGI-2 eval runs (Son's ask, 21-Oct-2026): the shapes our
 *          model-evaluation box publishes (one document per run, one trace per output), and the
 *          queries for the runs list, one run and one output's trace. Served by
 *          server/routes/teamEvals.ts under /api/team, behind the same team cookie as the Kaggle
 *          runs record; a 401 surfaces as SignInRequired, which the pages hand to
 *          useSignInRedirect exactly as the runs pages do.
 *          The publisher may add fields at any time; the server stores documents verbatim, so
 *          every field here except the keys is treated as optional by the pages.
 *          2026-10-21 (Claude Opus 5.5), the runs API (version 2): a run names its kind.
 *          accuracy runs are as before; speed / kernel / profile runs carry arms (metrics,
 *          per-family profile ms, config and env) that the run page lays side by side. The
 *          publishers' reference is docs/RUNS_API.md in the team's arc2026 repository.
 * SRP/DRY check: Pass - data only; pages in pages/team/Arc2Evals.tsx and Arc2Eval.tsx, figures
 *          and filters in evalStats.ts. Fetching, sign-in and the 401 rule are teamRunsApi.ts's
 *          own `call`, SignInRequired and helpers, not a second copy.
 */

import { useQuery } from '@tanstack/react-query';
import { SignInRequired, call } from '@/components/teamRuns/teamRunsApi';

export type Grid = number[][];
/** Chips: config values as the publisher sends them (strings or numbers, occasionally more). */
export type ChipRecord = Record<string, unknown>;

export interface EvalPanel {
  name?: string;
  outputs?: number;
  note?: string | null;
  [field: string]: unknown;
}

export interface EvalSummary {
  outputs?: number;
  ran?: number;
  solved?: number;
  parsed?: number;
  stop?: number;
  length?: number;
  nearMiss?: number;
  genTokS?: number | null;
  clientSeconds?: number | null;
  [field: string]: unknown;
}

/** Another system's score on the same panel, for comparison. */
export interface EvalReference {
  label: string;
  solved: number;
  outputs: number;
  [field: string]: unknown;
}

export type Finish = 'stop' | 'length' | string | null;

/** One panel output (one test of one task) in a run. */
export interface EvalRow {
  outputKey: string;
  task: string;
  testIndex: number;
  ran: boolean;
  finish: Finish;
  completionTokens?: number | null;
  promptTokens?: number | null;
  seconds?: number | null;
  parsed: boolean;
  correct: boolean;
  sameShape?: boolean | null;
  cellsWrong?: number | null;
  testShape?: [number, number] | null;
  reasoningChars?: number | null;
  hasTrace: boolean;
  /** How many of the reference's runs solved this output, out of refRuns. */
  refSolved?: number | null;
  refRuns?: number | null;
  error?: string;
}

/** accuracy: a panel scored output by output. The others compare arms side by side. */
export type RunKind = 'accuracy' | 'speed' | 'kernel' | 'profile';
export type ArmStatus = 'ok' | 'failed' | 'skipped';
/** Metrics are numbers (the server refuses anything else) or null when an arm has no value. */
export type ArmMetrics = Record<string, number | null>;

export interface RunLink {
  label?: string;
  url: string;
}

export interface RunBox {
  job?: string;
  service?: string;
  machine?: string;
  costUsd?: number | null;
  hours?: number | null;
  [field: string]: unknown;
}

/** GPU time per decode step, split by kernel family (torch profiler, one rank). */
export interface ArmProfile {
  iterations?: number | null;
  spanMsPerIter?: number | null;
  gpuBusyFrac?: number | null;
  familiesMs?: Record<string, number | null> | null;
  [field: string]: unknown;
}

/** One arm of a speed / kernel / profile run. */
export interface RunArm {
  name: string;
  label?: string | null;
  status?: ArmStatus;
  error?: string | null;
  config?: ChipRecord | null;
  env?: ChipRecord | null;
  metrics?: ArmMetrics | null;
  profile?: ArmProfile | null;
  details?: unknown;
  links?: RunLink[] | null;
}

/** How a metric reads: a label, a unit, and which way is better (no direction: not ranked). */
export interface MetricInfo {
  label?: string;
  unit?: string;
  better?: 'higher' | 'lower';
}

/** What the runs list carries per run. */
export interface EvalRunIndex {
  key: string;
  kind: RunKind | string;
  title: string | null;
  createdAt: string | null;
  author: string | null;
  model: ChipRecord | null;
  panel: EvalPanel | null;
  summary: EvalSummary | null;
  reference: EvalReference[] | null;
  box: RunBox | null;
  verdict: string | null;
  headline: string | null;
  arms: Array<Pick<RunArm, 'name' | 'label' | 'status' | 'metrics'>> | null;
  updatedAt: string;
}

export interface EvalRunDocument {
  apiVersion?: number;
  kind?: RunKind | string;
  key: string;
  title?: string;
  createdAt?: string;
  author?: string | null;
  question?: string | null;
  verdict?: string | null;
  model?: ChipRecord | null;
  env?: ChipRecord | null;
  panel?: EvalPanel | null;
  box?: RunBox | null;
  client?: ChipRecord | null;
  summary?: EvalSummary | null;
  reference?: EvalReference[] | null;
  links?: RunLink[] | null;
  notes?: string | null;
  /** accuracy runs */
  rows?: EvalRow[];
  /** speed / kernel / profile runs */
  arms?: RunArm[];
  baseline?: string | null;
  headline?: string | null;
  metricInfo?: Record<string, MetricInfo> | null;
}

export interface EvalTrace {
  apiVersion?: number;
  key: string;
  outputKey: string;
  task?: string;
  testIndex?: number;
  finish?: Finish;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
  train?: Array<{ input: Grid; output: Grid }>;
  testInput?: Grid | null;
  expected?: Grid | null;
  answer?: Grid | null;
  reasoning?: string | null;
  content?: string | null;
}

const retry = (count: number, error: Error) => !(error instanceof SignInRequired) && count < 2;

/** Runs arrive when the box finishes a panel; a slow refresh is plenty. */
export function useArc2Evals() {
  return useQuery({
    queryKey: ['team-arc2-evals'],
    queryFn: () => call<{ runs: EvalRunIndex[] }>('/api/team/arc2-evals'),
    refetchInterval: 5 * 60_000,
    retry,
  });
}

export function useArc2Eval(key: string) {
  return useQuery({
    queryKey: ['team-arc2-eval', key],
    queryFn: () => call<{ run: EvalRunDocument }>(`/api/team/arc2-evals/${encodeURIComponent(key)}`),
    retry,
  });
}

/** One output's trace. Traces are large and rarely change, so each is fetched once per visit. */
export function useArc2EvalTrace(key: string, output: string | null) {
  return useQuery({
    queryKey: ['team-arc2-eval-trace', key, output],
    queryFn: () =>
      call<{ trace: EvalTrace }>(`/api/team/arc2-evals/${encodeURIComponent(key)}/traces/${encodeURIComponent(output ?? '')}`),
    enabled: Boolean(output),
    staleTime: 30 * 60_000,
    retry,
  });
}
