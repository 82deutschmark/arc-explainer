/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-19
 * PURPOSE: /team/arc2-runs/:key, one ARC-AGI-2 Kaggle submission in full, team only, on the
 *          same dark terminal screen as the list (the Boss: "think much more like a financial
 *          terminal"). Top to bottom:
 *          - a quote line: submission, time, score, change against its baseline, whether it
 *            set a new team best, the notebook; previous/next run;
 *          - the submitter's own words;
 *          - BASELINE: the run it is judged against and why, the later runs built on this one,
 *            and a form to change the baseline or add a team note (saved under the signed-in
 *            Google account's name);
 *          - CLAUDE'S READ: the note written on the Mac Mini from the code diff and the run log;
 *          - CODE DIFF against the baseline, coloured by line;
 *          - RUN LOG, folded: the notebook's saved-version check, not the hidden scoring run
 *            (Kaggle never shows that one's log), and the page says so.
 *          A note written against a different baseline than the current one is marked as being
 *          redone rather than shown as current.
 * SRP/DRY check: Pass - one-run view; data, baseline rule and formatting in
 *          components/teamRuns/teamRunsApi.ts, figures in runStats.ts, palette and primitives in
 *          terminal.tsx, the note renderer in NoteMarkdown.tsx.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'wouter';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NoteMarkdown } from '@/components/teamRuns/NoteMarkdown';
import {
  SignInRequired, effectiveBaseline, scoreText, useArc2Run, useArc2Runs, useSaveNote, useSignInRedirect,
  utcStamp, type RunRow, type TeamRunNote,
} from '@/components/teamRuns/teamRunsApi';
import { newBestKeys, scored } from '@/components/teamRuns/runStats';
import { Bracket, Delta, Pane, Screen, T, stamp } from '@/components/teamRuns/terminal';

const GUESS = '__guess__';
const field = { background: T.bg, color: T.text, border: `1px solid ${T.rule}`, fontFamily: T.mono } as const;

/** Unified diff with + green, - red, hunk headers amber. */
function DiffView({ text }: { text: string }) {
  return (
    <pre className="max-h-[560px] overflow-auto px-2 py-1 text-[11.5px] leading-[1.4] whitespace-pre-wrap break-all">
      {text.split('\n').map((line, i) => {
        const color = line.startsWith('@@') ? T.amber : line.startsWith('+++') || line.startsWith('---') ? T.dim
          : line.startsWith('+') ? T.up : line.startsWith('-') ? T.down : T.dim;
        return <div key={i} style={{ color }}>{line || ' '}</div>;
      })}
    </pre>
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
    <form onSubmit={submit} className="px-2 py-2 grid gap-1.5" style={{ borderTop: `1px solid ${T.rule}` }}>
      <label className="flex flex-wrap items-center gap-2">
        <span style={{ color: T.amber }}>SET BASELINE</span>
        <select value={baseline} onChange={(e) => setBaseline(e.target.value)} className="flex-1 min-w-[260px] px-1 py-[2px]" style={field}>
          <option value={GUESS}>{proposed ? `auto: ${proposed.key} (from the description)` : 'auto: none found'}</option>
          <option value="none">none</option>
          {earlier.map((r) => (
            <option key={r.key} value={r.key}>
              {stamp(r.submittedAt)} {scoreText(r.publicScore).padStart(6)}  {r.description.slice(0, 80)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-wrap items-start gap-2">
        <span style={{ color: T.amber }}>TEAM NOTE&nbsp;&nbsp;&nbsp;</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={2}
                  className="flex-1 min-w-[260px] px-1 py-[2px]" style={field} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={save.isPending} className="px-2" style={{ background: T.amber, color: T.bg }}>
          {save.isPending ? 'SAVING…' : 'SAVE'}
        </button>
        {save.isSuccess && <span style={{ color: T.up }}>SAVED. A changed baseline gets a fresh Claude note within the hour.</span>}
        {save.error && <span style={{ color: T.down }}>{save.error.message}</span>}
        {note && <span className="ml-auto" style={{ color: T.dim }}>last set by {note.updatedBy ?? '?'} {stamp(note.updatedAt)}Z</span>}
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
  const [showLog, setShowLog] = useState(false);

  if (one.isLoading) return <Screen><div style={{ color: T.dim }}>LOADING RUN {key}…</div></Screen>;
  if (one.error && !(one.error instanceof SignInRequired)) {
    return <Screen><div style={{ color: T.down }}>ERROR: {one.error.message} · <Link href="/team/arc2-runs" style={{ color: T.link }}>[ALL RUNS]</Link></div></Screen>;
  }
  if (!one.data) return null;

  const { run, note } = one.data;
  const rows = all.data?.runs ?? [];
  const base = effectiveBaseline(run.proposedBaseline, note);
  const baseRun = base.key ? rows.find((r) => r.key === base.key) : undefined;
  const delta = scored(run) && baseRun && scored(baseRun) ? run.publicScore! - baseRun.publicScore! : null;
  const earlier = rows.filter((r) => r.submittedAt < run.submittedAt);
  const summary = run.summary;
  const summaryCurrent = summary?.state === 'done' && (summary.baselineKey ?? null) === base.key;
  const isBest = newBestKeys(rows).has(run.key);
  // Neighbours in time, and the later runs that are judged against this one.
  const ordered = [...rows].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const at = ordered.findIndex((r) => r.key === run.key);
  const prev = at > 0 ? ordered[at - 1] : undefined;
  const next = at >= 0 && at < ordered.length - 1 ? ordered[at + 1] : undefined;
  const builtOn = rows.filter((r) => effectiveBaseline(r.proposedBaseline, r.note).key === run.key);
  const runLink = (r: RunRow, label: string) => (
    <Link href={`/team/arc2-runs/${r.key}`} className="hover:underline" style={{ color: T.link }}>
      [{label} {scored(r) ? scoreText(r.publicScore) : r.status.toUpperCase()}]
    </Link>
  );

  return (
    <Screen>
      {/* ── nav ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 mb-2 pb-1" style={{ borderBottom: `1px solid ${T.amber}` }}>
        <Link href="/team/arc2-runs" className="hover:underline" style={{ color: T.link }}>[◂ ALL RUNS]</Link>
        {prev && runLink(prev, '◂ PREV')}
        {next && runLink(next, 'NEXT ▸')}
        <span className="ml-auto" style={{ color: T.dim }}>ARC-AGI-2 · SUBMISSION {run.key}</span>
      </div>

      {/* ── quote line ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-2 py-2 mb-2 tabular-nums" style={{ border: `1px solid ${T.rule}`, background: T.panel }}>
        <span className="text-[28px] font-bold leading-none" style={{ color: run.status === 'error' ? T.down : isBest ? T.up : T.text }}>
          {scored(run) ? scoreText(run.publicScore) : run.status.toUpperCase()}
        </span>
        <span className="text-[16px]"><Delta value={delta} /> <span style={{ color: T.dim }}>vs {baseRun ? scoreText(baseRun.publicScore) : '—'}</span></span>
        {isBest && <span style={{ color: T.up }}>▲ NEW TEAM BEST</span>}
        <span><span style={{ color: T.amber }}>TIME </span>{stamp(run.submittedAt)}Z</span>
        {run.kernel?.url && (
          <span><span style={{ color: T.amber }}>NB </span>
            <a href={run.kernel.url} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: T.link }}>
              {run.kernel.ref}{run.kernel.version ? ` v${run.kernel.version}` : ''}
            </a>
          </span>
        )}
        <span style={{ color: T.dim }}>public board score</span>
      </div>

      <Pane title="Change, in the submitter's words" className="mb-2">
        <div className="px-2 py-1.5 text-[13px]">{run.description || <span style={{ color: T.dim }}>(no description on Kaggle)</span>}</div>
        {note?.note && <div className="px-2 pb-1.5" style={{ color: T.amber }}>TEAM NOTE: <span style={{ color: T.text }}>{note.note}</span></div>}
      </Pane>

      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] mb-2 items-start">
        <Pane title="Baseline" right={base.why}>
          <div className="px-2 py-1.5">
            {baseRun ? (
              <>
                <div className="tabular-nums">
                  {runLink(baseRun, stamp(baseRun.submittedAt))}
                </div>
                <div className="mt-1" style={{ color: T.dim }}>{baseRun.description}</div>
              </>
            ) : (
              <span style={{ color: T.dim }}>{base.key ? `RUN ${base.key} NOT IN THE RECORD` : 'NONE'}</span>
            )}
            {builtOn.length > 0 && (
              <div className="mt-2">
                <span style={{ color: T.amber }}>BUILT ON THIS: </span>
                {builtOn.map((r) => <span key={r.key} className="mr-2">{runLink(r, stamp(r.submittedAt))}</span>)}
              </div>
            )}
          </div>
          <NoteForm runKey={run.key} note={note} proposed={run.proposedBaseline} earlier={earlier} />
        </Pane>

        <Pane title="Claude's read" right={summaryCurrent && summary?.at ? `${summary.model} · ${stamp(summary.at)}Z` : undefined}>
          <div className="px-2 py-1">
            {summaryCurrent && summary?.markdown ? (
              <NoteMarkdown text={summary.markdown} />
            ) : summary?.state === 'done' ? (
              <span style={{ color: T.dim }}>WRITTEN AGAINST A DIFFERENT BASELINE. A FRESH ONE IS ON ITS WAY.</span>
            ) : summary?.state === 'failed' ? (
              <span style={{ color: T.down }}>NOTE FAILED: {summary.error ?? 'no reason given'}. RETRIED NEXT PASS.</span>
            ) : (
              <span style={{ color: T.dim }}>NOT WRITTEN YET.</span>
            )}
          </div>
        </Pane>
      </div>

      <Pane title="Code diff against the baseline" className="mb-2"
            right={run.codeDiff ? `vs ${run.codeDiff.against}${run.codeDiff.truncated ? ' · cut short' : ''}` : undefined}>
        {run.codeDiff ? <DiffView text={run.codeDiff.text} /> : (
          <div className="px-2 py-1.5" style={{ color: T.dim }}>
            NO DIFF: {base.key ? "one of the two notebooks' code wasn't kept" : 'no baseline'}.
          </div>
        )}
      </Pane>

      <Pane title="Run log" right={<Bracket on={showLog} onClick={() => setShowLog((s) => !s)}>{showLog ? 'HIDE' : 'SHOW'}</Bracket>}>
        <div className="px-2 py-1" style={{ color: T.dim }}>
          The notebook's saved-version check run, not the hidden scoring run (Kaggle never shows that one's log).
          {run.output?.note ? ` ${run.output.note}` : ''}
          {run.log?.truncated ? ' Long log: start and end kept, middle cut.' : ''}
        </div>
        {showLog && (run.log ? (
          <pre className="max-h-[640px] overflow-auto px-2 py-1 text-[11.5px] leading-[1.4] whitespace-pre-wrap break-all">{run.log.text}</pre>
        ) : <div className="px-2 pb-1.5" style={{ color: T.dim }}>NO LOG KEPT.</div>)}
      </Pane>
      <div className="mt-1 text-[11px]" style={{ color: T.dim }}>Submitted {utcStamp(run.submittedAt)} from the {run.submittedBy} Kaggle account.</div>
    </Screen>
  );
}
