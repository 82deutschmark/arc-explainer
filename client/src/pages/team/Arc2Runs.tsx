/**
 * Author: Claude Opus 5.5 Low
 * Date: 2026-10-19
 * PURPOSE: /team/arc2-runs, the team-only record of every ARC-AGI-2 Kaggle submission by team
 *          ARC Mutants (Son's ask, 19-Oct-2026; built after the ARC-3 "Kaggle runs record" on
 *          arc3.sonpham.net). Same day, the Boss: more searchable, more data-dense, more stats,
 *          newest first, and "think much more like a financial terminal." So it is one dark
 *          monospaced screen (components/teamRuns/terminal.tsx), no intro prose:
 *          - a stat strip: team best, latest, submissions (7 days, failed), Claude's notes, who
 *            is signed in;
 *          - the score chart beside a per-person book (subs, scored, failed, best, last);
 *          - a command line: search ("/" focuses it) over descriptions, team notes, Claude's
 *            notes and notebooks, plus bracket toggles for person, window, kind and sort, all
 *            kept in the address so a view can be linked;
 *          - the blotter: one row per submission, newest first, one line each (WRAP shows the
 *            whole text): time, who, score, change against its baseline, the baseline, the
 *            submitter's own words, Claude's verdict, the notebook. Click a row for the run.
 *          The submitter's words are never rewritten; Claude's verdict sits beside them.
 * SRP/DRY check: Pass - list view only. Figures and filters in components/teamRuns/runStats.ts,
 *          the chart in ScoreTimeline.tsx, palette and primitives in terminal.tsx, data and the
 *          baseline rule in teamRunsApi.ts.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ago } from '@/components/kaggleLeaderboard/boardData';
import {
  SignInRequired, effectiveBaseline, scoreText, useArc2Runs, useSignInRedirect, useSignOut, useTeamSession,
  type RunRow,
} from '@/components/teamRuns/teamRunsApi';
import {
  DEFAULT_FILTER, applyFilter, newBestKeys, noteSection, readFilter, scored, teamStats, writeFilter, type RunFilter,
} from '@/components/teamRuns/runStats';
import { ScoreTimeline, personColors } from '@/components/teamRuns/ScoreTimeline';
import { Bracket, Delta, Pane, Screen, Stat, T, personCode, stamp } from '@/components/teamRuns/terminal';

function noteFlag(run: RunRow, baselineKey: string | null): string {
  const s = run.summary;
  if (s?.state === 'done') return s.baselineKey === baselineKey ? '' : 'REDOING';
  if (s?.state === 'failed') return 'NOTE FAILED';
  return s?.state ? 'PENDING' : '';
}

export default function Arc2Runs() {
  usePageMeta({ title: 'ARC-AGI-2 runs (team)', description: 'Team-only record of ARC Mutants submissions.', noindex: true });
  const runs = useArc2Runs();
  const session = useTeamSession();
  const signOut = useSignOut();
  const [location, navigate] = useLocation();
  useSignInRedirect(runs.error);
  const search = useRef<HTMLInputElement>(null);
  const [wrap, setWrap] = useState(false);

  const [filter, setFilter] = useState<RunFilter>(() => readFilter(window.location.search));
  // Keep the filter in the address (replace, not push: typing shouldn't fill the back button).
  useEffect(() => {
    window.history.replaceState(null, '', `${location}${writeFilter(filter)}`);
  }, [filter, location]);
  // "/" jumps to search, Escape clears it, as in a terminal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== search.current) { e.preventDefault(); search.current?.focus(); }
      if (e.key === 'Escape' && document.activeElement === search.current) setFilter((f) => ({ ...f, q: '' }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const set = (patch: Partial<RunFilter>) => setFilter((f) => ({ ...f, ...patch }));

  const rows = runs.data?.runs ?? [];
  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);
  const bestKeys = useMemo(() => newBestKeys(rows), [rows]);
  const stats = useMemo(() => teamStats(rows), [rows]);
  const colors = useMemo(() => personColors(rows), [rows]);
  const shown = useMemo(() => applyFilter(rows, filter, bestKeys), [rows, filter, bestKeys]);
  const noted = rows.filter((r) => r.summary?.state === 'done').length;
  const lastPublish = rows.reduce((a, r) => (r.publishedAt && r.publishedAt > a ? r.publishedAt : a), '');

  if (runs.isLoading) return <Screen><div style={{ color: T.dim }}>LOADING ARC-AGI-2 RUNS…</div></Screen>;
  if (runs.error && !(runs.error instanceof SignInRequired)) {
    return <Screen><div style={{ color: T.down }}>ERROR: {runs.error.message}</div></Screen>;
  }

  return (
    <Screen>
      {/* ── title bar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 pb-1" style={{ borderBottom: `1px solid ${T.amber}` }}>
        <span className="font-bold" style={{ color: T.amber }}>ARC-AGI-2 RUNS</span>
        <span style={{ color: T.dim }}>ARC MUTANTS · KAGGLE PUBLIC BOARD · TEAM ONLY</span>
        <span className="ml-auto" style={{ color: T.dim }}>
          UPD {lastPublish ? `${stamp(lastPublish)}Z` : '—'} · {session.data?.email ?? ''}{' '}
          <button className="hover:underline" style={{ color: T.link }}
                  onClick={() => signOut.mutate(undefined, { onSuccess: () => { window.location.href = '/team/login'; } })}>[LOGOUT]</button>
        </span>
      </div>

      {rows.length === 0 ? (
        <div style={{ color: T.dim }}>NO RUNS PUBLISHED YET. THE MAC MINI PUBLISHES EVERY 15 MIN.</div>
      ) : (
        <>
          {/* ── stat strip ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-5 mb-2" style={{ border: `1px solid ${T.rule}`, background: T.panel }}>
            <Stat label="Team best" value={scoreText(stats.best?.publicScore)} tone={T.up}
                  sub={stats.best && `${personCode(stats.best.who)} ${stamp(stats.best.submittedAt)}Z`} />
            <Stat label="Last" value={stats.latest?.status === 'complete' ? scoreText(stats.latest.publicScore) : stats.latest?.status?.toUpperCase()}
                  sub={stats.latest && `${personCode(stats.latest.who)} ${ago(stats.latest.submittedAt)}`} />
            <Stat label="Subs" value={stats.total} sub={`${stats.scoredCount} scored · ${stats.failedCount} failed`} />
            <Stat label="Last 7d" value={stats.lastWeek} sub="submissions" />
            <Stat label="Claude notes" value={noted} sub="Oct onward" />
          </div>

          {/* ── chart + book ────────────────────────────────────────────────── */}
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_460px] mb-2">
            <Pane title="Public score by submission" right="click a dot to open the run">
              <ScoreTimeline rows={rows} colors={colors} />
            </Pane>
            <Pane title="By person" right="click to filter">
              <table className="w-full tabular-nums">
                <thead style={{ color: T.dim }}>
                  <tr className="text-left">
                    <th className="px-2 py-[2px] font-normal">WHO</th>
                    <th className="px-2 font-normal text-right">SUBS</th>
                    <th className="px-2 font-normal text-right">SCORED</th>
                    <th className="px-2 font-normal text-right">FAIL</th>
                    <th className="px-2 font-normal text-right">BEST</th>
                    <th className="px-2 font-normal text-right">LAST</th>
                    <th className="px-2 font-normal text-right">AGE</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.people.map((p) => {
                    const fails = rows.filter((r) => r.who === p.who && r.status === 'error').length;
                    const last = p.latest;
                    return (
                      <tr key={p.who} className="cursor-pointer" onClick={() => set({ who: filter.who === p.who ? '' : p.who })}
                          style={{ borderTop: `1px solid ${T.rule}`, background: filter.who === p.who ? T.hover : undefined }}>
                        <td className="px-2 py-[2px]"><span style={{ color: colors.get(p.who) }}>●</span> {p.who}</td>
                        <td className="px-2 text-right">{p.count}</td>
                        <td className="px-2 text-right">{p.scoredCount}</td>
                        <td className="px-2 text-right" style={{ color: fails ? T.down : T.dim }}>{fails}</td>
                        <td className="px-2 text-right font-bold">{scoreText(p.best?.publicScore)}</td>
                        <td className="px-2 text-right">{scored(last) ? scoreText(last.publicScore) : last.status.toUpperCase()}</td>
                        <td className="px-2 text-right" style={{ color: T.dim }}>{ago(last.submittedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Pane>
          </div>

          {/* ── command line ────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1 mb-0" style={{ border: `1px solid ${T.rule}`, borderBottom: 'none', background: T.panel }}>
            <span style={{ color: T.amber }}>&gt;</span>
            <input ref={search} value={filter.q} onChange={(e) => set({ q: e.target.value })} aria-label="Search runs"
                   placeholder="search changes, notes, notebooks  ( / )" spellCheck={false}
                   className="w-[300px] bg-transparent outline-none placeholder:opacity-60" style={{ color: T.text, borderBottom: `1px solid ${T.rule}` }} />
            <span>
              <Bracket on={!filter.who} onClick={() => set({ who: '' })}>ALL</Bracket>
              {stats.people.map((p) => (
                <Bracket key={p.who} on={filter.who === p.who} onClick={() => set({ who: filter.who === p.who ? '' : p.who })} title={p.who}>
                  {personCode(p.who)}
                </Bracket>
              ))}
            </span>
            <span>
              {(['all', '30d', '7d'] as const).map((v) => (
                <Bracket key={v} on={filter.since === v} onClick={() => set({ since: v })}>{v === 'all' ? 'MAX' : v}</Bracket>
              ))}
            </span>
            <span>
              {([['all', 'ALL'], ['scored', 'SCORED'], ['best', 'NEW BEST'], ['failed', 'FAIL'], ['noted', 'NOTED']] as const).map(([v, label]) => (
                <Bracket key={v} on={filter.show === v} onClick={() => set({ show: v })}>{label}</Bracket>
              ))}
            </span>
            <span>
              <span style={{ color: T.dim }}>SORT </span>
              <Bracket on={filter.sort === 'newest'} onClick={() => set({ sort: 'newest' })}>TIME</Bracket>
              <Bracket on={filter.sort === 'score'} onClick={() => set({ sort: 'score' })}>SCORE</Bracket>
            </span>
            <Bracket on={wrap} onClick={() => setWrap((w) => !w)} title="Show whole descriptions and verdicts">WRAP</Bracket>
            <span className="ml-auto" style={{ color: T.dim }}>
              {shown.length}/{rows.length}
              {writeFilter(filter) && <button className="ml-2 hover:underline" style={{ color: T.link }} onClick={() => setFilter(DEFAULT_FILTER)}>[CLEAR]</button>}
            </span>
          </div>

          {/* ── blotter ─────────────────────────────────────────────────────── */}
          <div style={{ border: `1px solid ${T.rule}` }} className="overflow-x-auto">
            <table className="w-full tabular-nums" style={{ tableLayout: 'fixed', minWidth: 1100 }}>
              <colgroup>
                <col style={{ width: 92 }} /><col style={{ width: 46 }} /><col style={{ width: 56 }} /><col style={{ width: 60 }} />
                <col style={{ width: 52 }} /><col /><col style={{ width: '32%' }} /><col style={{ width: 190 }} />
              </colgroup>
              <thead className="sticky top-0" style={{ background: T.panel, color: T.amber }}>
                <tr className="text-left text-[11px]">
                  <th className="px-2 py-[3px] font-normal">TIME UTC</th>
                  <th className="px-1 font-normal">WHO</th>
                  <th className="px-1 font-normal text-right">SCORE</th>
                  <th className="px-1 font-normal text-right">Δ BASE</th>
                  <th className="px-1 font-normal text-right">BASE</th>
                  <th className="px-2 font-normal">CHANGE (THEIR WORDS)</th>
                  <th className="px-2 font-normal">CLAUDE VERDICT</th>
                  <th className="px-2 font-normal">NOTEBOOK</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((run) => {
                  const base = effectiveBaseline(run.proposedBaseline, run.note);
                  const baseRun = base.key ? byKey.get(base.key) : undefined;
                  const delta = scored(run) && baseRun && scored(baseRun) ? run.publicScore! - baseRun.publicScore! : null;
                  const current = run.summary?.state === 'done' && run.summary.baselineKey === base.key;
                  const verdict = current ? noteSection(run.summary?.markdown, 'Verdict') : null;
                  const flag = noteFlag(run, base.key);
                  const isBest = bestKeys.has(run.key);
                  const cell = wrap ? 'whitespace-normal' : 'truncate';
                  return (
                    <tr key={run.key} onClick={() => navigate(`/team/arc2-runs/${run.key}`)} className="cursor-pointer align-top"
                        style={{ borderTop: `1px solid ${T.rule}` }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = T.hover; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}>
                      <td className="px-2 py-[2px] whitespace-nowrap" style={{ color: T.dim }}>{stamp(run.submittedAt)}</td>
                      <td className="px-1 whitespace-nowrap" title={run.who}><span style={{ color: colors.get(run.who) }}>{personCode(run.who)}</span></td>
                      <td className="px-1 text-right font-bold" style={{ color: isBest ? T.up : run.status === 'error' ? T.down : T.text }}>
                        {scored(run) ? scoreText(run.publicScore) : run.status === 'error' ? 'FAIL' : run.status.slice(0, 4).toUpperCase()}
                      </td>
                      <td className="px-1 text-right"><Delta value={delta} /></td>
                      <td className="px-1 text-right" style={{ color: T.dim }} title={baseRun ? base.why : 'no baseline'}>
                        {baseRun ? `${scoreText(baseRun.publicScore)}${run.note?.baseline ? '' : '?'}` : '—'}
                      </td>
                      <td className={`px-2 ${cell}`} title={wrap ? undefined : run.description}>
                        {isBest && <span style={{ color: T.up }}>▲BEST </span>}
                        {run.description || <span style={{ color: T.dim }}>(no description)</span>}
                        {run.note?.note && <span style={{ color: T.amber }}> · NOTE: {run.note.note}</span>}
                      </td>
                      <td className={`px-2 ${cell}`} style={{ color: verdict ? T.text : T.dim }} title={wrap ? undefined : verdict ?? undefined}>
                        {verdict ?? (flag || '—')}
                      </td>
                      <td className="px-2 truncate" title={run.kernel?.ref ?? undefined}>
                        {run.kernel?.url ? (
                          <a href={run.kernel.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                             className="hover:underline" style={{ color: T.link }}>
                            {run.kernel.ref?.split('/')[1]}{run.kernel.version ? ` v${run.kernel.version}` : ''}
                          </a>
                        ) : <span style={{ color: T.dim }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {shown.length === 0 && <div className="px-2 py-3" style={{ color: T.dim }}>NO MATCHES.</div>}
          </div>
          <div className="mt-1 text-[11px]" style={{ color: T.dim }}>
            Δ BASE = score minus the run it builds on · "?" = baseline guessed from a score in the description (set it on the run) ·
            ▲BEST = new team best when submitted · scores are Kaggle's public board
          </div>
        </>
      )}
    </Screen>
  );
}
