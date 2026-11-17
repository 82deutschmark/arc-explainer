/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-21
 * PURPOSE: /team/arc2-evals/:key, one ARC Mutants model-evaluation run in full, team only, on the
 *          dark terminal screen of the runs record (Son's ask, 21-Oct-2026: read each output's
 *          full reasoning to see where the model goes wrong). Top to bottom:
 *          - nav: back to the eval runs and to the Kaggle runs;
 *          - the run: title, created, model configuration and client settings as chips, the box
 *            job, its cost and hours, the panel, and the publisher's notes (as markdown, through
 *            the runs record's NoteMarkdown);
 *          - a stat strip: solved, parsed, finished on stop / hit the cap, near misses, speed,
 *            wall time;
 *          - the reference systems' scores on the same panel against ours, and how many outputs
 *            we solve that the per-output reference never did, and the reverse;
 *          - two panes. Left: the outputs (finish, completion tokens, parsed, solved, cells wrong,
 *            reference solved/runs), filtered to all / solved / wrong answer / no answer / hit cap,
 *            in panel order or by tokens; J/K step through them. Right: the selected output's
 *            trace: the training pairs and test input as small grids, the expected grid beside
 *            the model's answer with wrong cells ringed (same shape only), the final answer text
 *            and the full reasoning with find (ReasoningView).
 *          The selected output is kept in the address (?o=7b5033c1_0, replaced not pushed, as the
 *          runs list keeps its filters) so a link opens it, through sign-in too.
 *          2026-10-21 (Claude Opus 5.5), the runs API: the header also shows the run's kind,
 *          author, env switches, machine and links; a speed / kernel / profile run shows its
 *          arms side by side (components/teamEvals/ArmsView.tsx) instead of the outputs.
 * SRP/DRY check: Pass - one-run view. Data in components/teamEvals/teamEvalsApi.ts, filters and
 *          grid checks in evalStats.ts, grids in EvalGrid.tsx (the site's TinyGrid), reasoning in
 *          ReasoningView.tsx, chips in Chips.tsx; sign-in, palette, primitives and the notes
 *          renderer are the runs record's own (teamRunsApi.ts, terminal.tsx, NoteMarkdown.tsx).
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { usePageMeta } from '@/hooks/usePageMeta';
import { NoteMarkdown } from '@/components/teamRuns/NoteMarkdown';
import { SignInRequired, useSignInRedirect, utcStamp } from '@/components/teamRuns/teamRunsApi';
import { Bracket, Pane, Screen, Stat, T } from '@/components/teamRuns/terminal';
import {
  useArc2Eval, useArc2EvalTrace, type EvalRow, type EvalRunDocument, type EvalSummary,
} from '@/components/teamEvals/teamEvalsApi';
import {
  SHOW_OPTIONS, count, duration, gridShape, referenceSplit, shapeText, showCounts, signed, visibleRows, wrongCells,
  type EvalShow, type EvalSort,
} from '@/components/teamEvals/evalStats';
import { ArmsView, RunLinks } from '@/components/teamEvals/ArmsView';
import { Chips } from '@/components/teamEvals/Chips';
import { EvalGrid } from '@/components/teamEvals/EvalGrid';
import { ReasoningView } from '@/components/teamEvals/ReasoningView';

const OUTPUT_KEY = /^[0-9a-f]{8}_[0-9]{1,2}$/;
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

function readOutput(search: string): string | null {
  const o = new URLSearchParams(search).get('o');
  return o && OUTPUT_KEY.test(o) ? o : null;
}

/** "YES" in green or "NO" in red: words, not tick and cross glyphs (Mark's coding standards). */
function YesNo({ value, good = true }: { value: boolean | null | undefined; good?: boolean }) {
  if (value == null) return <span style={{ color: T.dim }}>—</span>;
  return <span style={{ color: value === good ? T.up : T.down }}>{value ? 'YES' : 'NO'}</span>;
}

function FinishText({ finish }: { finish: EvalRow['finish'] }) {
  if (!finish) return <span style={{ color: T.dim }}>—</span>;
  return <span style={{ color: finish === 'length' ? T.down : finish === 'stop' ? T.text : T.amber }}>{finish === 'length' ? 'CAP' : finish.toUpperCase()}</span>;
}

const refText = (row: EvalRow) => (row.refSolved == null || !row.refRuns ? '—' : `${row.refSolved}/${row.refRuns}`);

/** Title block: what was run, on what, with which settings. */
function RunHeader({ run }: { run: EvalRunDocument }) {
  const box = run.box;
  const cost = num(box?.costUsd);
  const hours = num(box?.hours);
  const outputs = run.rows?.length ?? 0;
  return (
    <div className="px-2 py-2 mb-2 grid gap-1" style={{ border: `1px solid ${T.rule}`, background: T.panel }}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-[18px] font-bold" style={{ color: T.amber }}>{run.title ?? run.key}</span>
        <span style={{ color: T.dim }}>{run.key}</span>
        <span style={{ color: T.dim }}>{String(run.kind ?? 'accuracy').toUpperCase()}</span>
        <span style={{ color: T.dim }}>CREATED {utcStamp(run.createdAt)}</span>
        {run.author && <span style={{ color: T.dim }}>BY {run.author}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span style={{ color: T.amber }}>MODEL</span>
        {typeof run.model?.name === 'string' && <span className="font-bold">{run.model.name}</span>}
        <Chips record={run.model} skip={['name']} />
      </div>
      {run.env && Object.keys(run.env).length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span style={{ color: T.amber }}>ENV</span>
          <Chips record={run.env} />
        </div>
      )}
      {run.client && (
        <div className="flex flex-wrap items-center gap-2">
          <span style={{ color: T.amber }}>CLIENT</span>
          {typeof run.client.name === 'string' && <span>{run.client.name}</span>}
          <Chips record={run.client} skip={['name']} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {run.panel && (
          <span>
            <span style={{ color: T.amber }}>PANEL </span>{run.panel.name ?? '—'}
            <span style={{ color: T.dim }}> · {num(run.panel.outputs) ?? outputs} outputs{run.panel.note ? ` · ${run.panel.note}` : ''}</span>
          </span>
        )}
        {box && (
          <span>
            <span style={{ color: T.amber }}>BOX </span>{box.job ?? '—'}
            <span style={{ color: T.dim }}>
              {typeof box.machine === 'string' ? ` · ${box.machine}` : ''}{cost != null ? ` · $${cost.toFixed(2)}` : ''}{hours != null ? ` · ${hours.toFixed(1)}h` : ''}
            </span>
          </span>
        )}
        <RunLinks links={run.links} />
      </div>
    </div>
  );
}

/** The reference systems' scores on this panel, and where this run differs output by output. */
function ReferencePane({ run }: { run: EvalRunDocument }) {
  const rows = run.rows ?? [];
  const ours = num(run.summary?.solved) ?? rows.filter((r) => r.correct).length;
  const split = referenceSplit(rows);
  const refs = Array.isArray(run.reference) ? run.reference : [];
  if (!refs.length && !split.compared) return null;
  return (
    <Pane title="Reference" right="other systems on the same outputs" className="mb-2">
      <table className="tabular-nums">
        <tbody>
          <tr>
            <td className="px-2 py-[2px] font-bold" style={{ color: T.amber }}>THIS RUN</td>
            <td className="px-2 text-right font-bold">{ours}/{num(run.summary?.outputs) ?? rows.length}</td>
            <td className="px-2" />
          </tr>
          {refs.map((ref, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${T.rule}` }}>
              <td className="px-2 py-[2px]">{ref.label}</td>
              <td className="px-2 text-right">{ref.solved}/{ref.outputs}</td>
              <td className="px-2 text-right" style={{ color: ours > ref.solved ? T.up : ours < ref.solved ? T.down : T.dim }}>
                us {signed(ours - ref.solved)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {split.compared > 0 && (
        <div className="px-2 py-1" style={{ borderTop: `1px solid ${T.rule}` }}>
          <span style={{ color: T.up }}>{split.gained}</span> solved here that the per-output reference never solved ·{' '}
          <span style={{ color: T.down }}>{split.lost}</span> the reference solved at least once and this run missed
          <span style={{ color: T.dim }}> ({split.compared} outputs compared)</span>
        </div>
      )}
    </Pane>
  );
}

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return <Pane title={title} right={right} className="mb-2">{children}</Pane>;
}

/** The right-hand pane: one output's puzzle, answers and reasoning. */
function TracePane({ runKey, row, selected }: { runKey: string; row: EvalRow | undefined; selected: string | null }) {
  const trace = useArc2EvalTrace(runKey, row?.hasTrace ? row.outputKey : null);
  useSignInRedirect(trace.error);
  const t = trace.data?.trace;
  const diff = useMemo(() => (t ? wrongCells(t.expected, t.answer) : null), [t]);

  if (!selected) {
    return <Pane title="Trace"><div className="px-2 py-3" style={{ color: T.dim }}>SELECT AN OUTPUT ON THE LEFT · J / K STEP THROUGH THEM</div></Pane>;
  }
  if (!row) {
    return <Pane title="Trace"><div className="px-2 py-3" style={{ color: T.down }}>OUTPUT {selected} IS NOT IN THIS RUN.</div></Pane>;
  }

  const head = (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-2 py-1.5 mb-2 tabular-nums" style={{ border: `1px solid ${T.rule}`, background: T.panel }}>
      <span className="text-[16px] font-bold" style={{ color: row.correct ? T.up : row.parsed ? T.down : T.text }}>{row.outputKey}</span>
      <Link href={`/puzzle/${encodeURIComponent(row.task)}`} className="hover:underline" style={{ color: T.link }}>[PUZZLE {row.task} ▸]</Link>
      <span><span style={{ color: T.amber }}>TEST </span>{row.testIndex}</span>
      <span><span style={{ color: T.amber }}>FINISH </span><FinishText finish={row.finish} /></span>
      <span><span style={{ color: T.amber }}>TOK </span>{count(row.promptTokens)} in · {count(row.completionTokens)} out</span>
      <span><span style={{ color: T.amber }}>TIME </span>{duration(row.seconds)}</span>
      <span><span style={{ color: T.amber }}>PARSED </span><YesNo value={row.parsed} /></span>
      <span><span style={{ color: T.amber }}>SOLVED </span><YesNo value={row.correct} /></span>
      {row.cellsWrong != null && <span><span style={{ color: T.amber }}>CELLS WRONG </span>{row.cellsWrong}</span>}
      <span><span style={{ color: T.amber }}>REF </span>{refText(row)}</span>
      {row.error && <span className="basis-full" style={{ color: T.down }}>ERROR: {row.error}</span>}
    </div>
  );

  if (!row.hasTrace) {
    return <div>{head}<Pane title="Trace"><div className="px-2 py-3" style={{ color: T.dim }}>NO TRACE PUBLISHED FOR THIS OUTPUT{row.ran ? '' : ' (IT DID NOT RUN)'}.</div></Pane></div>;
  }
  if (trace.isLoading) return <div>{head}<div className="px-2" style={{ color: T.dim }}>LOADING TRACE {row.outputKey}…</div></div>;
  if (trace.error && !(trace.error instanceof SignInRequired)) {
    return <div>{head}<div className="px-2" style={{ color: T.down }}>ERROR: {trace.error.message}</div></div>;
  }
  if (!t) return head;

  const expectedShape = gridShape(t.expected);
  const answerShape = gridShape(t.answer);
  // The trace is stored as the box sent it; anything not of the expected kind shows as absent.
  const train = Array.isArray(t.train) ? t.train : [];
  const content = typeof t.content === 'string' ? t.content : '';
  const reasoning = typeof t.reasoning === 'string' ? t.reasoning : '';
  return (
    <div>
      {head}
      <Section title="Puzzle" right={`${train.length} training pairs · test ${t.testIndex ?? row.testIndex}`}>
        <div className="flex flex-wrap gap-x-5 gap-y-3 px-2 py-2">
          {train.map((pair, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <EvalGrid grid={pair?.input} label={`train ${i + 1} in`} maxPx={120} cellMax={10} />
              <span className="self-center" style={{ color: T.dim }}>▸</span>
              <EvalGrid grid={pair?.output} label="out" maxPx={120} cellMax={10} />
            </div>
          ))}
          <div className="flex items-start gap-1.5 pl-3" style={{ borderLeft: `1px solid ${T.rule}` }}>
            <EvalGrid grid={t.testInput} label="test in" maxPx={120} cellMax={10} tone={T.amber} />
          </div>
        </div>
      </Section>

      <Section title="Expected vs answer"
               right={diff ? `${diff.wrong} cell${diff.wrong === 1 ? '' : 's'} wrong` : t.answer == null ? 'no answer parsed'
                 : `shape differs: expected ${shapeText(expectedShape)}, got ${shapeText(answerShape)}`}>
        <div className="flex flex-wrap gap-6 px-2 py-2">
          <EvalGrid grid={t.expected} label="expected" maxPx={300} cellMax={20} tone={T.up} />
          {t.answer == null ? (
            <div className="self-center" style={{ color: T.down }}>NO ANSWER PARSED</div>
          ) : (
            <EvalGrid grid={t.answer} label="model answer" maxPx={300} cellMax={20} mask={diff?.mask}
                      tone={diff && diff.wrong === 0 ? T.up : T.down} />
          )}
        </div>
        {diff && diff.wrong > 0 && <div className="px-2 pb-1.5 text-[11px]" style={{ color: T.dim }}>Wrong cells are ringed in white.</div>}
      </Section>

      <Section title="Final answer text" right={content ? `${count(content.length)} chars` : undefined}>
        {content ? (
          <pre className="max-h-[260px] overflow-auto px-2 py-1 text-[11.5px] leading-[1.45] whitespace-pre-wrap break-words">{content}</pre>
        ) : <div className="px-2 py-1.5" style={{ color: T.dim }}>(empty)</div>}
      </Section>

      <Section title="Reasoning" right={t.usage?.completion_tokens != null ? `${count(t.usage.completion_tokens)} completion tokens` : undefined}>
        <ReasoningView text={reasoning} completionTokens={t.usage?.completion_tokens ?? row.completionTokens} />
      </Section>
    </div>
  );
}

export default function Arc2Eval() {
  const { key = '' } = useParams<{ key: string }>();
  usePageMeta({ title: `ARC-AGI-2 eval ${key} (team)`, description: 'Team-only record of one ARC Mutants model evaluation run.', noindex: true });
  const one = useArc2Eval(key);
  useSignInRedirect(one.error);
  const [location] = useLocation();
  const [selected, setSelected] = useState<string | null>(() => readOutput(window.location.search));
  const [show, setShow] = useState<EvalShow>('all');
  const [sort, setSort] = useState<EvalSort>('panel');

  // The selected output lives in the address (replace, not push: stepping shouldn't fill the back button).
  useEffect(() => {
    window.history.replaceState(null, '', `${location}${selected ? `?o=${selected}` : ''}`);
  }, [selected, location]);

  const rows = one.data?.run.rows ?? [];
  const shown = useMemo(() => visibleRows(rows, show, sort), [rows, show, sort]);
  const counts = useMemo(() => showCounts(rows), [rows]);
  const row = selected ? rows.find((r) => r.outputKey === selected) : undefined;

  // J / K step through the listed outputs, as in a terminal (not while typing in a box).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || (e.key !== 'j' && e.key !== 'k') || !shown.length) return;
      const at = shown.findIndex((r) => r.outputKey === selected);
      const next = e.key === 'j' ? Math.min(shown.length - 1, at + 1) : Math.max(0, at < 0 ? 0 : at - 1);
      setSelected(shown[next].outputKey);
      document.querySelector(`[data-output="${shown[next].outputKey}"]`)?.scrollIntoView({ block: 'nearest' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown, selected]);

  if (one.isLoading) return <Screen><div style={{ color: T.dim }}>LOADING EVAL RUN {key}…</div></Screen>;
  if (one.error && !(one.error instanceof SignInRequired)) {
    return <Screen><div style={{ color: T.down }}>ERROR: {one.error.message} · <Link href="/team/arc2-evals" style={{ color: T.link }}>[ALL EVAL RUNS]</Link></div></Screen>;
  }
  if (!one.data) return null;

  const { run } = one.data;
  const s: EvalSummary = run.summary ?? {};
  const outputs = num(s.outputs) ?? rows.length;
  const tokS = num(s.genTokS);
  const tokenSort = () => setSort((v) => (v === 'tokens-desc' ? 'tokens-asc' : 'tokens-desc'));
  const kind = String(run.kind ?? 'accuracy');

  const nav = (
    <div className="flex flex-wrap items-center gap-x-3 mb-2 pb-1" style={{ borderBottom: `1px solid ${T.amber}` }}>
      <Link href="/team/arc2-evals" className="hover:underline" style={{ color: T.link }}>[◂ ALL EVAL RUNS]</Link>
      <Link href="/team/arc2-runs" className="hover:underline" style={{ color: T.link }}>[KAGGLE RUNS]</Link>
      <span className="ml-auto" style={{ color: T.dim }}>ARC-AGI-2 · {kind.toUpperCase()} RUN {run.key}</span>
    </div>
  );

  // Speed, kernel and profile runs have arms to compare, not outputs to read.
  if (kind !== 'accuracy') {
    return (
      <Screen>
        {nav}
        <RunHeader run={run} />
        <ArmsView run={run} />
      </Screen>
    );
  }

  return (
    <Screen>
      {nav}

      <RunHeader run={run} />

      {/* ── stat strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-7 mb-2" style={{ border: `1px solid ${T.rule}`, background: T.panel }}>
        <Stat label="Solved" value={<>{num(s.solved) ?? counts.solved}<span className="text-[13px]" style={{ color: T.dim }}>/{outputs}</span></>} tone={T.up}
              sub={outputs ? `${(((num(s.solved) ?? counts.solved) / outputs) * 100).toFixed(1)}%` : undefined} />
        <Stat label="Parsed" value={num(s.parsed) ?? '—'} sub="a grid could be read" />
        <Stat label="Stop / cap" value={<>{num(s.stop) ?? '—'}<span style={{ color: T.dim }}> / </span><span style={{ color: T.down }}>{num(s.length) ?? '—'}</span></>}
              sub="finished / hit token cap" />
        <Stat label="Near miss" value={num(s.nearMiss) ?? '—'} sub="as the box counts them" />
        <Stat label="Gen tok/s" value={tokS == null ? '—' : tokS.toFixed(1)} />
        <Stat label="Wall time" value={duration(num(s.clientSeconds))} sub="client side" />
        <Stat label="Ran" value={num(s.ran) ?? '—'} sub={`of ${outputs} outputs`} />
      </div>

      <ReferencePane run={run} />

      {run.notes && (
        <Pane title="Notes" className="mb-2">
          <div className="px-2 py-1"><NoteMarkdown text={run.notes} /></div>
        </Pane>
      )}

      {/* ── outputs | trace ─────────────────────────────────────────────── */}
      <div className="grid gap-2 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] items-start">
        <div className="lg:sticky lg:top-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1" style={{ border: `1px solid ${T.rule}`, borderBottom: 'none', background: T.panel }}>
            {SHOW_OPTIONS.map(([v, label]) => (
              <Bracket key={v} on={show === v} onClick={() => setShow(v)}>{label} {counts[v]}</Bracket>
            ))}
            <span className="ml-auto">
              <span style={{ color: T.dim }}>SORT </span>
              <Bracket on={sort === 'panel'} onClick={() => setSort('panel')}>PANEL</Bracket>
              <Bracket on={sort !== 'panel'} onClick={tokenSort} title="Completion tokens; click again to flip">
                TOKENS {sort === 'tokens-asc' ? '▲' : '▼'}
              </Bracket>
            </span>
          </div>
          <div className="max-h-[calc(100vh-90px)] overflow-auto" style={{ border: `1px solid ${T.rule}` }}>
            <table className="w-full tabular-nums" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 98 }} /><col style={{ width: 44 }} /><col style={{ width: 62 }} /><col style={{ width: 52 }} />
                <col style={{ width: 52 }} /><col style={{ width: 56 }} /><col />
              </colgroup>
              <thead className="sticky top-0" style={{ background: T.panel, color: T.amber }}>
                <tr className="text-left text-[11px]">
                  <th className="px-2 py-[3px] font-normal">OUTPUT</th>
                  <th className="px-1 font-normal">FIN</th>
                  <th className="px-1 font-normal text-right" title="completion tokens">TOKENS</th>
                  <th className="px-1 font-normal text-right">PARSED</th>
                  <th className="px-1 font-normal text-right">SOLVED</th>
                  <th className="px-1 font-normal text-right" title="cells wrong, when the shape is right">WRONG</th>
                  <th className="px-2 font-normal text-right" title="reference runs that solved this output">REF</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const on = r.outputKey === selected;
                  return (
                    <tr key={r.outputKey} data-output={r.outputKey} onClick={() => setSelected(r.outputKey)} className="cursor-pointer"
                        style={{ borderTop: `1px solid ${T.rule}`, background: on ? T.hover : undefined, boxShadow: on ? `inset 2px 0 0 ${T.amber}` : undefined }}
                        onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = T.hover; }}
                        onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = ''; }}>
                      <td className="px-2 py-[2px] whitespace-nowrap" style={{ color: on ? T.amber : r.ran ? T.text : T.dim }} title={r.error}>
                        {r.outputKey}{r.hasTrace ? '' : <span style={{ color: T.dim }}>*</span>}
                      </td>
                      <td className="px-1"><FinishText finish={r.finish} /></td>
                      <td className="px-1 text-right">{count(r.completionTokens)}</td>
                      <td className="px-1 text-right"><YesNo value={r.ran ? r.parsed : null} /></td>
                      <td className="px-1 text-right"><YesNo value={r.ran ? r.correct : null} /></td>
                      <td className="px-1 text-right" style={{ color: r.cellsWrong ? T.down : T.dim }}>
                        {r.cellsWrong != null ? r.cellsWrong : r.parsed && r.sameShape === false ? 'SHAPE' : '—'}
                      </td>
                      <td className="px-2 text-right" style={{ color: T.dim }}>{refText(r)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {shown.length === 0 && <div className="px-2 py-3" style={{ color: T.dim }}>NO OUTPUTS UNDER THIS FILTER.</div>}
          </div>
          <div className="mt-1 text-[11px]" style={{ color: T.dim }}>
            CAP = hit the token cap · WRONG = cells wrong (SHAPE: wrong shape) · REF = reference runs that solved it · * = no trace published
          </div>
        </div>

        <TracePane runKey={run.key} row={row} selected={selected} />
      </div>
    </Screen>
  );
}
