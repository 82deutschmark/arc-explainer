/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-19
 * PURPOSE: /team/arc2-runs/:key, one ARC-AGI-2 Kaggle submission in full, team only. Top to
 *          bottom: the submitter's own description and the public score; the run it is judged
 *          against, with the difference and a small form to change the baseline or add a team
 *          note; Claude's note (written on the Mac Mini from the code diff and the run log);
 *          the code changes against the baseline; the saved-version run log.
 *
 *          Two honesty rules, both from what the data can carry: the run log is the notebook's
 *          short saved-version check, not the hidden scoring run, and the page says so; and a
 *          note written against a different baseline than the current one is marked as being
 *          redone rather than shown as current.
 * SRP/DRY check: Pass - one-run view; data, baseline rule and formatting in
 *          components/teamRuns/teamRunsApi.ts, the note renderer in NoteMarkdown.tsx.
 *          shadcn Button/Textarea/Select/Collapsible.
 */

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'wouter';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NoteMarkdown } from '@/components/teamRuns/NoteMarkdown';
import {
  SignInRequired, deltaText, effectiveBaseline, scoreText, useArc2Run, useArc2Runs, useSaveNote, useSignInRedirect,
  utcStamp, type RunRow, type TeamRunNote,
} from '@/components/teamRuns/teamRunsApi';

const GUESS = '__guess__';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-[11px] uppercase tracking-[2px] font-semibold mb-3 pb-2 border-b">{title}</h2>
      {children}
    </section>
  );
}

function Fold({ label, text, foot }: { label: string; text: string; foot?: string }) {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm">{label}</Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="mt-3 max-h-[640px] overflow-auto text-[12px] leading-[1.45] p-3 bg-muted whitespace-pre-wrap break-words">{text}</pre>
        {foot && <p className="mt-2 text-xs text-muted-foreground">{foot}</p>}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Change the baseline or the team note. The server records who saved it from their Google sign-in. */
function NoteForm({ runKey, note, proposed, earlier }: {
  runKey: string; note: TeamRunNote | null; proposed: RunRow['proposedBaseline']; earlier: RunRow[];
}) {
  const save = useSaveNote(runKey);
  const [baseline, setBaseline] = useState(note?.baseline ?? GUESS);
  const [text, setText] = useState(note?.note ?? '');
  useEffect(() => { setBaseline(note?.baseline ?? GUESS); setText(note?.note ?? ''); }, [note]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ baseline: baseline === GUESS ? '' : baseline, note: text });
  };

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
      <div className="space-y-1.5 sm:col-span-2">
        <Label>Judge it against</Label>
        <Select value={baseline} onValueChange={setBaseline}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={GUESS}>{proposed ? `The watcher's guess (${proposed.key})` : "The watcher's guess (none found)"}</SelectItem>
            <SelectItem value="none">No baseline</SelectItem>
            {earlier.map((r) => (
              <SelectItem key={r.key} value={r.key}>
                {scoreText(r.publicScore)} · {r.who} · {utcStamp(r.submittedAt)} · {r.description.slice(0, 60)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="team-note">Team note (optional)</Label>
        <Textarea id="team-note" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={3} />
      </div>
      <div className="sm:col-span-2 flex items-center gap-3">
        <Button type="submit" size="sm" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
        {save.isSuccess && <span className="text-xs text-muted-foreground">Saved. A changed baseline gets a fresh Claude note within the hour.</span>}
        {save.error && <span className="text-xs text-destructive">{save.error.message}</span>}
        {note && <span className="text-xs text-muted-foreground ml-auto">Last set by {note.updatedBy ?? 'someone'}, {utcStamp(note.updatedAt)}</span>}
      </div>
    </form>
  );
}

export default function Arc2Run() {
  const { key = '' } = useParams<{ key: string }>();
  usePageMeta({ title: `ARC-AGI-2 run ${key} (team)`, description: 'Team-only record of one ARC Mutants submission.', noindex: true });
  const one = useArc2Run(key);
  const all = useArc2Runs();
  useSignInRedirect(one.error);

  if (one.isLoading) return <div className="max-w-[1000px] mx-auto px-4 py-8"><Skeleton className="h-[520px] w-full" /></div>;
  if (one.error && !(one.error instanceof SignInRequired)) {
    return <div className="max-w-[1000px] mx-auto px-4 py-8 text-sm">This run didn't load: {one.error.message}. <Link href="/team/arc2-runs" className="underline">All runs</Link></div>;
  }
  if (!one.data) return null;

  const { run, note } = one.data;
  const rows = all.data?.runs ?? [];
  const base = effectiveBaseline(run.proposedBaseline, note);
  const baseRun = base.key ? rows.find((r) => r.key === base.key) : undefined;
  const delta = deltaText(run.publicScore, baseRun?.publicScore ?? null);
  const earlier = rows.filter((r) => r.submittedAt < run.submittedAt);
  const summary = run.summary;
  const summaryCurrent = summary?.state === 'done' && (summary.baselineKey ?? null) === base.key;

  return (
    <div className="max-w-[1000px] mx-auto px-4 py-8">
      <p className="text-sm mb-4"><Link href="/team/arc2-runs" className="underline text-muted-foreground">← All ARC-AGI-2 runs</Link></p>

      <header className="mb-10">
        <div className="text-xs uppercase tracking-[1.5px] text-muted-foreground mb-2">
          {run.who} · {utcStamp(run.submittedAt)} · submission {run.key}
        </div>
        <blockquote className="text-lg leading-relaxed border-l-4 pl-4 mb-5">
          {run.description || '(no description on Kaggle)'}
        </blockquote>
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <div>
            <div className="text-4xl font-bold tabular-nums">{run.status === 'complete' ? scoreText(run.publicScore) : run.status}</div>
            <div className="text-xs text-muted-foreground">public leaderboard score</div>
          </div>
          {delta && baseRun && (
            <div>
              <div className="text-2xl font-semibold tabular-nums">{delta}</div>
              <div className="text-xs text-muted-foreground">against {scoreText(baseRun.publicScore)}</div>
            </div>
          )}
          {run.kernel?.url && (
            <a href={run.kernel.url} target="_blank" rel="noreferrer" className="text-sm underline inline-flex items-center gap-1">
              Notebook on Kaggle{run.kernel.version ? `, version ${run.kernel.version}` : ''} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </header>

      <Section title="Judged against">
        {baseRun ? (
          <div className="text-sm">
            <p><b>{scoreText(baseRun.publicScore)}</b> · {baseRun.who} · {utcStamp(baseRun.submittedAt)} · <Link href={`/team/arc2-runs/${baseRun.key}`} className="underline">submission {baseRun.key}</Link></p>
            <p className="mt-1 text-muted-foreground">{baseRun.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">Why this one: {base.why}.</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{base.key ? `Run ${base.key} isn't in the record.` : `No baseline (${base.why}).`}</p>
        )}
        {note?.note && <p className="mt-3 text-sm"><b>Team note:</b> {note.note}</p>}
        <NoteForm runKey={run.key} note={note} proposed={run.proposedBaseline} earlier={earlier} />
      </Section>

      <Section title="Claude's read">
        {summaryCurrent && summary?.markdown ? (
          <>
            <NoteMarkdown text={summary.markdown} />
            <p className="mt-3 text-xs text-muted-foreground">Written by {summary.model} on the Mac Mini, {utcStamp(summary.at)}, from the code diff and the run log. It's commentary; the submitter's description above is the record.</p>
          </>
        ) : summary?.state === 'done' ? (
          <p className="text-sm text-muted-foreground">The note was written against a different baseline. A fresh one is on its way.</p>
        ) : summary?.state === 'failed' ? (
          <p className="text-sm text-muted-foreground">Claude's note failed: {summary.error ?? 'no reason given'}. It is retried on the next pass.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Not written yet.</p>
        )}
      </Section>

      <Section title="Code changes against the baseline">
        {run.codeDiff ? (
          <Fold label={`Show the diff against ${run.codeDiff.against}`} text={run.codeDiff.text}
                foot={run.codeDiff.truncated ? 'Cut short; the full diff is on the Mac Mini.' : undefined} />
        ) : (
          <p className="text-sm text-muted-foreground">No diff: {base.key ? "one of the two notebooks' code wasn't kept" : 'there is no baseline'}.</p>
        )}
      </Section>

      <Section title="Run log">
        <p className="text-sm text-muted-foreground mb-3">
          This is the notebook's saved-version run, a short check Kaggle runs before submitting, not the
          hidden scoring run (Kaggle never shows that one's log).
          {run.output?.note ? ` ${run.output.note}` : ''}
        </p>
        {run.log ? (
          <Fold label="Show the log" text={run.log.text} foot={run.log.truncated ? 'Long log: the start and the end are kept, the middle is cut.' : undefined} />
        ) : (
          <p className="text-sm text-muted-foreground">No log kept for this run.</p>
        )}
      </Section>
    </div>
  );
}
