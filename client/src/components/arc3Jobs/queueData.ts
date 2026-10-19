/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-19
 * PURPOSE: Data for /arc3/jobs, the ARC-3 team's GPU job queue. The queue lives in the arc3-jobs API
 *          (sonpham-org/arc-3, gcp/arc3-jobs): Keith's LoRA evaluations on 1-card RTX boxes and Jack Cole's
 *          own runs on 4x L4 boxes, each a Google Cloud Spot VM made for the job. Its dispatcher writes two
 *          documents every 2 minutes and this page reads them straight from that API (Cloud Run; CORS allows
 *          arc.markbarney.net and localhost dev ports):
 *            - GET /v1/public/queue       the overview anyone may see: who has which job, its state and
 *                                          progress, and how many boxes of each type are busy
 *            - GET /v1/public/queue/full  with the X-Queue-Password header: also spend against each person's
 *                                          daily cap, job costs, box names and zones, run output and the
 *                                          dispatcher log (Son, 19-Oct: "password gate on internal stuffs")
 *          The password is kept only in this tab's sessionStorage and is sent only to that API.
 * SRP/DRY check: Pass — fetching, types and display wording only; Arc3JobQueue.tsx composes the page.
 *          Nothing else on the site reads this API.
 */
import { useQuery } from '@tanstack/react-query';

// VITE_ARC3_JOBS_API points a dev server at another copy of the API (e.g. one run locally); production uses this one.
export const ARC3_JOBS_API: string =
  (import.meta.env?.VITE_ARC3_JOBS_API as string | undefined) || 'https://arc3-jobs-api-293261284498.us-central1.run.app';
export const PASSWORD_KEY = 'arc3-jobs-queue-password';
const REFRESH_MS = 60_000;

export interface QueueShard {
  k: number;
  status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled';
  attempt?: number | null;
  minute?: number | null;      // eq32 plays: minutes since the model server came up
  moving?: number | null;      // eq32 plays: plays that have made moves
  files?: number | null;       // box jobs: output files so far
  preemptions?: number;
  outcome?: string | null;
  launched_at?: string | null;
  // full document only
  zone?: string | null;
  failures?: number;
  gpu?: number[][] | null;     // per card [utilization %, memory MiB]
  log_tail?: string[] | null;
  launch_error?: string | null;
}

export interface QueueJob {
  id: string;
  user: string;
  client_key: string;
  kind: 'eq32' | 'box';
  machine: string;
  what: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  created_at?: string | null;
  updated_at?: string | null;
  finished_at?: string | null;
  shards: QueueShard[];
  // full document only
  cost_usd?: number;
  est_usd?: number | null;
}

export interface QueueMachine {
  label: string;
  live: number;
  max_vms?: number | null;
  price_per_vm_hour?: number | null;   // full document only
}

export interface QueueUser {
  spend_today_usd: number;
  cap_usd?: number | null;
  max_vms?: number | null;
  kinds: string[];
  live: number;
}

export interface QueueVm {
  name: string;
  zone: string;
  status: string;
  machine?: string | null;
  user?: string | null;
  kind?: string | null;
  created?: string | null;
}

export interface QueueDoc {
  generated_at?: string;
  paused?: boolean;
  tick_every_min?: number;
  machines: Record<string, QueueMachine>;
  jobs: QueueJob[];
  public?: boolean;
  // full document only
  users?: Record<string, QueueUser>;
  vms?: QueueVm[];
  log?: string[];
}

export class WrongPasswordError extends Error {}

/** One queue document: the public overview, or the full one when a password is given. */
export async function fetchQueue(password?: string | null): Promise<QueueDoc> {
  const full = !!password;
  const res = await fetch(`${ARC3_JOBS_API}/v1/public/queue${full ? '/full' : ''}`, {
    headers: full ? { 'X-Queue-Password': password as string } : undefined,
    cache: 'no-store',
  });
  if (full && res.status === 401) throw new WrongPasswordError('wrong password');
  if (!res.ok) throw new Error(`the job queue answered HTTP ${res.status}`);
  const doc = (await res.json()) as QueueDoc;
  return { ...doc, machines: doc.machines ?? {}, jobs: doc.jobs ?? [] };
}

/** The overview always; the full document as well while a password is set. Both refresh every minute. */
export function useJobQueue(password: string | null) {
  const overview = useQuery({
    queryKey: ['arc3-jobs-queue', 'public'],
    queryFn: () => fetchQueue(null),
    refetchInterval: REFRESH_MS,
    retry: 1,
  });
  const full = useQuery({
    queryKey: ['arc3-jobs-queue', 'full', password],
    queryFn: () => fetchQueue(password),
    enabled: !!password,
    refetchInterval: REFRESH_MS,
    retry: (count, err) => !(err instanceof WrongPasswordError) && count < 1,
  });
  return { overview, full };
}

const STATUS_WORDS: Record<string, string> = {
  queued: 'waiting', pending: 'waiting', running: 'running', done: 'done', failed: 'failed', cancelled: 'cancelled',
};

export function statusWord(status: string): string {
  return STATUS_WORDS[status] ?? status;
}

/** True while a job still needs boxes (shown first, and under "Active"). */
export function isActive(job: QueueJob): boolean {
  return job.status === 'queued' || job.status === 'running';
}

/** One play's progress in plain words, e.g. "try 2 · minute 34 · 32 plays moving · preempted once". */
export function shardProgress(job: QueueJob, s: QueueShard): string {
  const bits: string[] = [];
  if (job.shards.length > 1) bits.push(`play ${s.k + 1}`);
  if (s.status === 'running') {
    bits.push(`try ${s.attempt ?? 1}${s.zone ? ` · ${s.zone}` : ''}`);
    if (job.kind === 'box') {
      if (s.files != null) bits.push(`${s.files} output files`);
      if (s.gpu?.length) {
        bits.push(`GPU ${Math.round(s.gpu.reduce((sum, g) => sum + g[0], 0) / s.gpu.length)}%`);
      }
    } else if (s.minute != null) {
      bits.push(`minute ${Math.round(s.minute)}${s.moving != null ? ` · ${s.moving} plays moving` : ''}`);
    } else {
      bits.push('starting');
    }
  } else if (s.status === 'pending') {
    bits.push(s.launch_error ? `waiting: ${s.launch_error.slice(0, 90)}` : 'waiting for a box');
  } else if (s.outcome) {
    bits.push(s.outcome);
  }
  if (s.preemptions) bits.push(s.preemptions === 1 ? 'preempted once' : `preempted ${s.preemptions} times`);
  if (s.failures) bits.push(`${s.failures} failed`);
  return bits.join(' · ');
}

const EASTERN = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});

/** "Oct 19, 14:05" in New York time (the team's working clock). */
export function easternTime(iso?: string | null): string {
  return iso ? EASTERN.format(new Date(iso)) : '–';
}

export function minutesAgo(iso?: string | null, now = Date.now()): string {
  if (!iso) return '–';
  const m = Math.round((now - Date.parse(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 2880) return `${Math.floor(m / 60)} h ${m % 60} min ago`;
  return `${Math.floor(m / 1440)} days ago`;
}

export function upFor(iso?: string | null, now = Date.now()): string {
  if (!iso) return '–';
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function dollars(v?: number | null): string {
  return v == null ? '–' : `$${v.toFixed(2)}`;
}
