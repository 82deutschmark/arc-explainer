/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-21
 * PURPOSE: /team/arc2-evals, the team-only list of ARC Mutants model-evaluation runs (Son's ask,
 *          21-Oct-2026): our own box runs, a model served on 4x L4 and scored on a panel of
 *          ARC-AGI-2 public-eval outputs, not Kaggle submissions (those are /team/arc2-runs).
 *          One line per run, newest first, on the same dark terminal screen as the runs record:
 *          when, the run's title with its model configuration as chips, the panel, outputs
 *          solved (large), answers parsed, finishes on stop against the token cap, near misses,
 *          generation speed, and the reference systems' scores on the same panel. Click a run for
 *          its outputs and their reasoning traces. Unlisted and noindex, like the runs record.
 * SRP/DRY check: Pass - list view only. Data in components/teamEvals/teamEvalsApi.ts, chips in
 *          Chips.tsx; sign-in, session and logout reuse teamRunsApi.ts, the palette and
 *          primitives teamRuns/terminal.tsx, exactly as Arc2Runs.tsx does.
 */

import { Link, useLocation } from 'wouter';
import { usePageMeta } from '@/hooks/usePageMeta';
import { SignInRequired, useSignInRedirect, useSignOut, useTeamSession } from '@/components/teamRuns/teamRunsApi';
import { Screen, T, stamp } from '@/components/teamRuns/terminal';
import { useArc2Evals, type EvalRunIndex, type EvalSummary } from '@/components/teamEvals/teamEvalsApi';
import { Chips } from '@/components/teamEvals/Chips';
import { count } from '@/components/teamEvals/evalStats';

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function Solved({ run }: { run: EvalRunIndex }) {
  const solved = num(run.summary?.solved);
  const outputs = num(run.summary?.outputs) ?? num(run.panel?.outputs);
  return (
    <span className="tabular-nums whitespace-nowrap">
      <span className="text-[20px] font-bold leading-none" style={{ color: solved ? T.up : T.text }}>{solved ?? '—'}</span>
      <span style={{ color: T.dim }}>/{outputs ?? '—'}</span>
    </span>
  );
}

export default function Arc2Evals() {
  usePageMeta({ title: 'ARC-AGI-2 eval runs (team)', description: 'Team-only record of ARC Mutants model evaluation runs.', noindex: true });
  const evals = useArc2Evals();
  const session = useTeamSession();
  const signOut = useSignOut();
  const [, navigate] = useLocation();
  useSignInRedirect(evals.error);

  if (evals.isLoading) return <Screen><div style={{ color: T.dim }}>LOADING ARC-AGI-2 EVAL RUNS…</div></Screen>;
  if (evals.error && !(evals.error instanceof SignInRequired)) {
    return <Screen><div style={{ color: T.down }}>ERROR: {evals.error.message}</div></Screen>;
  }

  const runs = evals.data?.runs ?? [];
  const open = (key: string) => navigate(`/team/arc2-evals/${encodeURIComponent(key)}`);
  const lastPublish = runs.reduce((a, r) => (r.updatedAt > a ? r.updatedAt : a), '');

  return (
    <Screen>
      {/* ── title bar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 pb-1" style={{ borderBottom: `1px solid ${T.amber}` }}>
        <span className="font-bold" style={{ color: T.amber }}>ARC-AGI-2 EVAL RUNS</span>
        <span style={{ color: T.dim }}>ARC MUTANTS · EVAL BOX · PUBLIC-EVAL PANELS · TEAM ONLY</span>
        <Link href="/team/arc2-runs" className="hover:underline" style={{ color: T.link }}>[◂ KAGGLE RUNS]</Link>
        <span className="ml-auto" style={{ color: T.dim }}>
          UPD {lastPublish ? `${stamp(lastPublish)}Z` : '—'} · {session.data?.email ?? ''}{' '}
          <button className="hover:underline" style={{ color: T.link }}
                  onClick={() => signOut.mutate(undefined, { onSuccess: () => { window.location.href = '/team/login'; } })}>[LOGOUT]</button>
        </span>
      </div>

      {runs.length === 0 ? (
        <div style={{ color: T.dim }}>NO EVAL RUNS PUBLISHED YET. THE EVAL BOX PUBLISHES EACH RUN WHEN ITS PANEL FINISHES.</div>
      ) : (
        <div style={{ border: `1px solid ${T.rule}` }} className="overflow-x-auto">
          <table className="w-full tabular-nums" style={{ tableLayout: 'fixed', minWidth: 1100 }}>
            <colgroup>
              <col style={{ width: 92 }} /><col /><col style={{ width: 120 }} /><col style={{ width: 84 }} />
              <col style={{ width: 62 }} /><col style={{ width: 84 }} /><col style={{ width: 52 }} /><col style={{ width: 60 }} />
              <col style={{ width: 250 }} />
            </colgroup>
            <thead className="sticky top-0" style={{ background: T.panel, color: T.amber }}>
              <tr className="text-left text-[11px]">
                <th className="px-2 py-[3px] font-normal">CREATED UTC</th>
                <th className="px-2 font-normal">RUN · MODEL</th>
                <th className="px-2 font-normal">PANEL</th>
                <th className="px-2 font-normal text-right">SOLVED</th>
                <th className="px-1 font-normal text-right">PARSED</th>
                <th className="px-1 font-normal text-right" title="finished on stop / hit the token cap">STOP/LEN</th>
                <th className="px-1 font-normal text-right" title="near misses, as the eval box counts them">NEAR</th>
                <th className="px-1 font-normal text-right" title="generation tokens per second">TOK/S</th>
                <th className="px-2 font-normal">REFERENCE (SAME PANEL)</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const s: EvalSummary = run.summary ?? {};
                const tokS = num(s.genTokS);
                const refs = Array.isArray(run.reference) ? run.reference : [];
                return (
                  <tr key={run.key} onClick={() => open(run.key)} className="cursor-pointer align-top"
                      style={{ borderTop: `1px solid ${T.rule}` }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = T.hover; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}>
                    <td className="px-2 py-1 whitespace-nowrap" style={{ color: T.dim }}>{stamp(run.createdAt ?? run.updatedAt)}</td>
                    <td className="px-2 py-1">
                      <div className="truncate font-bold" title={run.title ?? run.key}>{run.title ?? run.key}</div>
                      <div className="truncate text-[11px]" style={{ color: T.dim }}>
                        {typeof run.model?.name === 'string' ? `${run.model.name} · ` : ''}{run.key}
                      </div>
                      <div className="mt-0.5"><Chips record={run.model} skip={['name']} /></div>
                    </td>
                    <td className="px-2 py-1" title={typeof run.panel?.note === 'string' ? run.panel.note : undefined}>
                      <div className="truncate">{run.panel?.name ?? '—'}</div>
                      <div className="text-[11px]" style={{ color: T.dim }}>{num(run.panel?.outputs) ?? '?'} outputs</div>
                    </td>
                    <td className="px-2 py-1 text-right"><Solved run={run} /></td>
                    <td className="px-1 py-1 text-right">{count(num(s.parsed))}</td>
                    <td className="px-1 py-1 text-right">
                      {count(num(s.stop))}<span style={{ color: T.dim }}>/</span>
                      <span style={{ color: num(s.length) ? T.down : T.text }}>{count(num(s.length))}</span>
                    </td>
                    <td className="px-1 py-1 text-right">{count(num(s.nearMiss))}</td>
                    <td className="px-1 py-1 text-right">{tokS == null ? '—' : tokS.toFixed(1)}</td>
                    <td className="px-2 py-1 text-[11px]">
                      {refs.length === 0 ? <span style={{ color: T.dim }}>—</span> : refs.map((ref, i) => (
                        <div key={i} className="truncate" title={ref.label}>
                          <span style={{ color: T.dim }}>{ref.label}: </span>{ref.solved}/{ref.outputs}
                        </div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-1 text-[11px]" style={{ color: T.dim }}>
        SOLVED = outputs answered exactly right · PARSED = a grid could be read from the answer · STOP/LEN = finished on its own
        / hit the token cap · NEAR = near misses, as the eval box counts them · reference = other systems' scores on the same outputs
      </div>
    </Screen>
  );
}
