/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-19
 * PURPOSE: Data for the team-only ARC-AGI-2 runs record: the run document shape the Mac
 *          Mini's watcher publishes (scripts/arc2_runs/arc2_runs.py), the sign-in calls, the
 *          queries for the list and one run, saving a team note, and the one rule for which
 *          baseline a run is judged against (the team's choice beats the watcher's guess).
 *          Runs live under /api/team (server/routes/teamRuns.ts) and need the team cookie,
 *          which Google sign-in sets (/api/auth, server/routes/teamAuth.ts); a 401 surfaces as
 *          SignInRequired so pages can send people to sign in.
 * SRP/DRY check: Pass - data only; pages in pages/team/. No other client code talks to
 *          /api/team or /api/auth.
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface RunSummary {
  state: 'done' | 'failed' | 'waiting' | string | null;
  markdown?: string | null;
  model?: string | null;
  promptVersion?: string | null;
  at?: string | null;
  /** The baseline the note was written against, so a changed baseline shows the note is stale. */
  baselineKey?: string | null;
  error?: string | null;
}

export interface TeamRunNote {
  baseline: string | null;
  note: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

export interface RunKernel {
  ref: string | null;
  version: number | null;
  versionAssumed: boolean;
  scriptVersionId: string | null;
  url: string | null;
}

export interface RunOutput {
  state: 'kept' | 'replaced' | 'running' | 'none' | 'error' | string;
  files?: string[];
  note?: string | null;
}

/** Fields both the list and the run page have. */
export interface RunRow {
  key: string;
  submittedAt: string;
  submittedBy: string;
  who: string;
  description: string;
  status: string;
  publicScore: number | null;
  kernel: RunKernel | null;
  proposedBaseline: { key: string; reason: string } | null;
  output: RunOutput | null;
  publishedAt: string | null;
  summary: RunSummary | null;
  note: TeamRunNote | null;
}

export interface RunDocument extends Omit<RunRow, 'note'> {
  log: { text: string; truncated: boolean; source?: string } | null;
  codeDiff: { against: string; text: string; truncated: boolean } | null;
}

export class SignInRequired extends Error {}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => null);
  if (res.status === 401 && body?.error === 'team_sign_in_required') throw new SignInRequired();
  if (!res.ok || !body?.success) throw new Error(body?.message ?? `HTTP ${res.status}`);
  return body.data as T;
}

/** Sends a signed-out visitor to /team/login, then back to the page they wanted. */
export function useSignInRedirect(error: unknown) {
  const [, navigate] = useLocation();
  useEffect(() => {
    if (error instanceof SignInRequired) {
      navigate(`/team/login?next=${encodeURIComponent(window.location.pathname)}`, { replace: true });
    }
  }, [error, navigate]);
}

export function useTeamSession() {
  return useQuery({
    queryKey: ['team-session'],
    queryFn: () => call<{ configured: boolean; signedIn: boolean; email: string | null; name: string | null }>('/api/auth/session'),
    staleTime: 60_000,
  });
}

/** Google sign-in is a full-page trip (the server sends the browser to Google and back). */
export function googleSignInUrl(next: string): string {
  return `/api/auth/google?next=${encodeURIComponent(next)}`;
}

export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => call<{ signedIn: boolean }>('/api/auth/session', { method: 'DELETE' }),
    onSuccess: () => client.clear(),
  });
}

/** The list refreshes every few minutes: the Mini publishes every fifteen. */
export function useArc2Runs() {
  return useQuery({
    queryKey: ['team-arc2-runs'],
    queryFn: () => call<{ runs: RunRow[] }>('/api/team/arc2-runs'),
    refetchInterval: 5 * 60_000,
    retry: (count, error) => !(error instanceof SignInRequired) && count < 2,
  });
}

export function useArc2Run(key: string) {
  return useQuery({
    queryKey: ['team-arc2-run', key],
    queryFn: () => call<{ run: RunDocument; note: TeamRunNote | null }>(`/api/team/arc2-runs/${encodeURIComponent(key)}`),
    retry: (count, error) => !(error instanceof SignInRequired) && count < 2,
  });
}

export function useSaveNote(key: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (fields: { baseline: string; note: string }) =>
      call<{ note: TeamRunNote }>(`/api/team/arc2-runs/${encodeURIComponent(key)}/note`,
        { method: 'POST', body: JSON.stringify(fields) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['team-arc2-run', key] });
      client.invalidateQueries({ queryKey: ['team-arc2-runs'] });
    },
  });
}

/** Which run this one is judged against, and why. The team's note beats the watcher's guess. */
export function effectiveBaseline(
  proposed: RunRow['proposedBaseline'],
  note: TeamRunNote | null,
): { key: string | null; why: string } {
  if (note?.baseline === 'none') return { key: null, why: `no baseline, set by ${note.updatedBy ?? 'the team'}` };
  if (note?.baseline) return { key: note.baseline, why: `set by ${note.updatedBy ?? 'the team'}` };
  if (proposed) return { key: proposed.key, why: proposed.reason };
  return { key: null, why: 'no baseline yet' };
}

export const scoreText = (score: number | null | undefined) => (score == null ? '—' : score.toFixed(2));

export function deltaText(score: number | null, baseline: number | null): string | null {
  if (score == null || baseline == null) return null;
  const d = score - baseline;
  return `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d).toFixed(2)}`;
}

/** "Oct 19, 00:06 UTC": team members are in different time zones, so one zone, named. */
export function utcStamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)} UTC`;
}
