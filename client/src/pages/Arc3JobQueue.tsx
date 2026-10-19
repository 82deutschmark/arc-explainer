/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-19
 * PURPOSE: /arc3/jobs, the ARC-3 team's GPU job queue (Son, 19-Oct-2026: "Add a page under markbarney
 *          repository for tracking"). Collaborators send jobs to the team's arc3-jobs API: Keith's LoRA
 *          evaluations on the 32-equal game set (1-card RTX PRO 6000 boxes) and Jack Cole's own experiments on
 *          4x L4 boxes. This page shows what is waiting and running, each job's progress and how busy each box
 *          type is, refreshed every minute. Spend against each person's daily cap, job costs, the boxes
 *          themselves, run output and the dispatcher log sit behind the queue view password ("password gate
 *          on internal stuffs"). Unlisted (noindex) and not in the navigation: people get the link.
 *          The same queue, for the team behind Google sign-in, is arc3.sonpham.net/jobs.html.
 * SRP/DRY check: Pass — composition only; fetching, types and wording live in
 *          components/arc3Jobs/queueData.ts. Reuses the shadcn Card/Table/Badge/Input/Button/ToggleGroup and
 *          usePageMeta like pages/KaggleLeaderboard.tsx; no server route (the data comes from the team's API).
 */

import { useState, type FormEvent, type ReactNode } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  PASSWORD_KEY, WrongPasswordError, dollars, easternTime, isActive, minutesAgo, shardProgress, statusWord, upFor,
  useJobQueue, type QueueDoc, type QueueJob,
} from '@/components/arc3Jobs/queueData';

function Section({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3 pt-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {note && <CardDescription className="text-xs">{note}</CardDescription>}
      </CardHeader>
      <CardContent className="pb-4">{children}</CardContent>
    </Card>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card className="min-w-0">
      <CardContent className="space-y-1 p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'failed' ? 'destructive' : status === 'running' || status === 'done' ? 'default' : 'outline';
  return <Badge variant={variant}>{statusWord(status)}</Badge>;
}

function readPassword(): string | null {
  try {
    return sessionStorage.getItem(PASSWORD_KEY);
  } catch {
    return null;
  }
}

function JobsTable({ jobs, detailed }: { jobs: QueueJob[]; detailed: boolean }) {
  if (!jobs.length) return <p className="text-sm text-muted-foreground">Nothing here.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sent (ET)</TableHead>
            <TableHead>Who</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>What</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            {detailed && <TableHead className="text-right">Cost</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((j) => {
            const tail = detailed && j.kind === 'box' ? j.shards[0]?.log_tail?.[0] : null;
            return (
              <TableRow key={j.id}>
                <TableCell className="whitespace-nowrap font-mono text-xs">{easternTime(j.created_at)}</TableCell>
                <TableCell className="font-medium">{j.user}</TableCell>
                <TableCell className="font-mono text-xs">{j.client_key}</TableCell>
                <TableCell className="max-w-[360px] text-sm">
                  {j.what}
                  {tail && <div className="truncate font-mono text-xs text-muted-foreground" title={tail}>{tail}</div>}
                </TableCell>
                <TableCell><StatusBadge status={j.status} /></TableCell>
                <TableCell className="text-sm">
                  {j.shards.map((s) => <div key={s.k}>{shardProgress(j, s)}</div>)}
                </TableCell>
                {detailed && (
                  <TableCell className="whitespace-nowrap text-right font-mono text-xs">
                    {dollars(j.cost_usd)}
                    <div className="text-muted-foreground">est {dollars(j.est_usd)}</div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function TeamDetails({ doc, onLock }: { doc: QueueDoc; onLock: () => void }) {
  const users = Object.entries(doc.users ?? {});
  const vms = [...(doc.vms ?? [])].sort((a, b) => String(a.created).localeCompare(String(b.created)));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Spend is box-hours times each region's Spot price, per New York day.</p>
        <Button variant="ghost" size="sm" onClick={onLock}><Lock className="mr-1 h-4 w-4" />Lock</Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Who</TableHead>
              <TableHead>Job kinds</TableHead>
              <TableHead className="text-right">Spend today</TableHead>
              <TableHead className="text-right">Daily cap</TableHead>
              <TableHead className="text-right">Boxes now</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(([name, u]) => (
              <TableRow key={name}>
                <TableCell className="font-medium">{name}</TableCell>
                <TableCell className="text-sm">{u.kinds.join(', ')}</TableCell>
                <TableCell className="text-right font-mono text-xs">{dollars(u.spend_today_usd)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{dollars(u.cap_usd)}</TableCell>
                <TableCell className="text-right font-mono text-xs">{u.live} of {u.max_vms ?? '–'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <h3 className="pt-2 text-sm font-semibold">Boxes now</h3>
      {vms.length ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Box</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Up for</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vms.map((v) => (
                <TableRow key={`${v.name}-${v.zone}`}>
                  <TableCell className="font-mono text-xs">{v.name}</TableCell>
                  <TableCell>{v.user}</TableCell>
                  <TableCell className="text-sm">{doc.machines[v.machine ?? '']?.label ?? v.machine}</TableCell>
                  <TableCell className="font-mono text-xs">{v.zone}</TableCell>
                  <TableCell className="text-sm">{v.status.toLowerCase()}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{upFor(v.created)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No job boxes right now: nothing is billing.</p>
      )}
      <h3 className="pt-2 text-sm font-semibold">Dispatcher log <span className="font-normal text-muted-foreground">· newest first, UTC</span></h3>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 font-mono text-xs">
        {[...(doc.log ?? [])].reverse().join('\n') || 'nothing yet'}
      </pre>
    </div>
  );
}

export default function Arc3JobQueue() {
  usePageMeta({
    title: 'ARC-3 team job queue | ARC Explainer',
    description: "Live status of the ARC-3 team's GPU job queue: jobs waiting and running, their progress, and busy boxes.",
    canonicalPath: '/arc3/jobs',
    noindex: true,
  });
  const [password, setPassword] = useState<string | null>(readPassword);
  const [draft, setDraft] = useState('');
  const [which, setWhich] = useState<'active' | 'week'>('active');
  const { overview, full } = useJobQueue(password);
  const wrong = full.error instanceof WrongPasswordError;
  const doc: QueueDoc | undefined = (password && !wrong && full.data) || overview.data;
  const detailed = !!(password && full.data && !wrong);

  const unlock = (e: FormEvent) => {
    e.preventDefault();
    const pw = draft.trim();
    if (!pw) return;
    try { sessionStorage.setItem(PASSWORD_KEY, pw); } catch { /* private window: keep it in memory only */ }
    setPassword(pw);
    setDraft('');
  };
  const lock = () => {
    try { sessionStorage.removeItem(PASSWORD_KEY); } catch { /* nothing stored */ }
    setPassword(null);
  };

  const jobs = [...(doc?.jobs ?? [])]
    .filter((j) => which === 'week' || isActive(j))
    .sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || String(b.created_at).localeCompare(String(a.created_at)));
  const stale = doc?.generated_at ? Date.now() - Date.parse(doc.generated_at) > 8 * 60_000 : false;

  return (
    <div className="mx-auto max-w-[1200px] space-y-3 px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-xl font-semibold">ARC-3 job queue</h1>
        {doc && (
          <span className={`text-xs ${stale ? 'text-destructive' : 'text-muted-foreground'}`}>
            Updated {minutesAgo(doc.generated_at)} · {easternTime(doc.generated_at)} ET
            {stale && ' · the dispatcher may be down'}
            {doc.paused && ' · queue paused'}
          </span>
        )}
      </div>

      {overview.isLoading && !doc && <Skeleton className="h-28 w-full" />}
      {overview.error && !doc && (
        <Alert variant="destructive">
          <AlertDescription>The job queue isn't answering right now ({String((overview.error as Error).message)}).</AlertDescription>
        </Alert>
      )}

      {doc && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(doc.machines).map(([key, m]) => (
              <Tile key={key} label={`${m.label} boxes`} value={`${m.live} of ${m.max_vms ?? '–'}`} detail="running now" />
            ))}
            <Tile label="Jobs waiting" value={String(doc.jobs.filter((j) => j.status === 'queued').length)}
                  detail={`${doc.jobs.filter((j) => j.status === 'running').length} running`} />
          </div>

          <Section
            title="Jobs"
            note="Every box is a Spot VM made for the job and deleted after it; a box Google takes back is replaced in another zone."
          >
            <div className="mb-3">
              <ToggleGroup type="single" size="sm" className="justify-start" value={which}
                           onValueChange={(v) => v && setWhich(v as 'active' | 'week')}>
                <ToggleGroupItem value="active">Active</ToggleGroupItem>
                <ToggleGroupItem value="week">Last 7 days</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <JobsTable jobs={jobs} detailed={detailed} />
          </Section>

          <Section title="Team details" note="Spend, costs, the boxes and the dispatcher log.">
            {detailed && full.data ? (
              <TeamDetails doc={full.data} onLock={lock} />
            ) : (
              <form onSubmit={unlock} className="flex max-w-md flex-wrap items-center gap-2">
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Queue view password"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-w-0 flex-1"
                  aria-label="Queue view password"
                />
                <Button type="submit" disabled={!draft.trim() || full.isFetching}>
                  <LockOpen className="mr-1 h-4 w-4" />{full.isFetching ? 'Checking…' : 'Show'}
                </Button>
                {wrong && <p className="w-full text-xs text-destructive">That password didn't work.</p>}
              </form>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
