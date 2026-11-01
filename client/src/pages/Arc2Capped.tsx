/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 26-October-2026
 * PURPOSE: Dense ARC-2 failure-inspection terminal: an API-backed cohort watchlist and
 *          selected test/training inspector, reusing query keys, GridDisplay and task links.
 * SRP/DRY check: Pass — presentation only; no copied dataset, solver or grid-rendering logic.
 */
import React, { useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowUpRight, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { GridDisplay } from '@/components/puzzle/grids/GridDisplay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ARCExample, ARCTask } from '@shared/types';
import './Arc2Capped.css';

// Source: Lattice's 26-Oct-2026 channel report. Indices are zero-based test indices,
// never attempt numbers or explanation IDs. Keep both selected tests for the two repeated tasks.
export const CAPPED_COHORT = [
  { id: '13e47133', tests: [1] }, { id: '20a9e565', tests: [1] },
  { id: '2d0172a1', tests: [0] }, { id: '3a25b0d8', tests: [1] },
  { id: '446ef5d2', tests: [0] }, { id: '4c7dc4dd', tests: [0] },
  { id: '4e34c42c', tests: [0] }, { id: '581f7754', tests: [0] },
  { id: '71e489b6', tests: [1] }, { id: '88bcf3b4', tests: [0, 1] },
  { id: '89565ca0', tests: [0] }, { id: '8b7bacbf', tests: [0] },
  { id: 'a25697e4', tests: [1] }, { id: 'a32d8b75', tests: [0] },
  { id: 'abc82100', tests: [0] }, { id: 'b9e38dc0', tests: [0] },
  { id: 'da515329', tests: [0] }, { id: 'de809cff', tests: [0] },
  { id: 'e12f9a14', tests: [0, 1] }, { id: 'f560132c', tests: [0] },
];

const OUTPUTS = CAPPED_COHORT.flatMap(({ id, tests }) => tests.map(index => ({ id, index, key: `${id}-${index}` })));
const dimensions = (grid?: number[][]) => grid?.length ? `${grid.length}×${grid[0]?.length ?? 0}` : '—';
const cellCount = (grid?: number[][]) => grid?.reduce((total, row) => total + row.length, 0) ?? 0;

function ExamplePair({ example, compact = false }: { example: ARCExample; compact?: boolean }) {
  return <div className={`terminal-pair ${compact ? 'terminal-pair-small' : ''}`}>
    <GridDisplay grid={example.input} label="INPUT" sizeClass={compact ? "w-full max-w-[136px]" : "w-full max-w-[310px]"} className="terminal-grid" />
    {example.output?.length ? <GridDisplay grid={example.output} label="KNOWN OUTPUT" sizeClass={compact ? "w-full max-w-[136px]" : "w-full max-w-[310px]"} className="terminal-grid" />
      : <p className="terminal-muted">Known output unavailable.</p>}
  </div>;
}

export default function Arc2Capped() {
  usePageMeta({ title: 'ARC-2 capped-output terminal', description: 'Inspect 22 always-capped ARC-2 test outputs in a compact task watchlist with grids, training examples and dimensions.', canonicalPath: '/arc2/capped' });
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'task' | 'cells'>('task');
  const [selectedKey, setSelectedKey] = useState(() => {
    const hash = window.location.hash.slice(1);
    return OUTPUTS.find(output => output.key === hash)?.key ?? OUTPUTS[0].key;
  });
  // Share the exact usePuzzle query keys/default fetcher, so visiting task pages reuses cached data.
  const queries = useQueries({ queries: CAPPED_COHORT.map(({ id }) => ({ queryKey: [`/api/puzzle/task/${id}`] })) });
  const tasks = new Map(CAPPED_COHORT.map(({ id }, i) => {
    const response = queries[i].data as { success: boolean; data: ARCTask } | undefined;
    return [id, response?.success ? response.data : undefined];
  }));
  const rows = OUTPUTS.map(output => ({ ...output, task: tasks.get(output.id) }));
  const visible = rows.filter(row => `${row.id}:${row.index}`.includes(search.trim().toLowerCase()))
    .sort((a, b) => sort === 'cells' ? cellCount(b.task?.test[b.index]?.output) - cellCount(a.task?.test[a.index]?.output) || a.key.localeCompare(b.key) : a.key.localeCompare(b.key));
  const selected = rows.find(row => row.key === selectedKey) ?? rows[0];
  const task = selected.task;
  const example = task?.test[selected.index];
  const selectedPosition = visible.findIndex(row => row.key === selected.key);
  const query = queries[CAPPED_COHORT.findIndex(entry => entry.id === selected.id)];
  function select(key: string) {
    setSelectedKey(key);
    window.history.replaceState(null, '', `#${key}`);
  }
  return <main className="arc2-terminal">
    <header className="terminal-topline">
      <div><span className="terminal-kicker">ARC / RESEARCH DESK</span><h1>CAP LIMIT <span>— OUTPUT INSPECTOR</span></h1></div>
      <Link href="/arc2/hard-set">HARD SET <ArrowUpRight size={12} /></Link>
    </header>
    <div className="terminal-ticker" aria-label="Cohort summary">
      <span><b>22</b> OUTPUTS</span><span><b>20</b> TASKS</span><span><b>64k</b> TOKEN CAP</span><span><b>8/8</b> FIRST-PASS RUNS CAPPED</span><span>FN · PANEL_V60</span><span>REPORTED 26 OCT 2026</span>
    </div>
    <p className="terminal-source">Lattice’s reported always-capped cohort, not all no-grid failures. One test output per request. Grids are dataset inputs and correct answers, not model predictions. Test indices start at 0.</p>
    <div className="terminal-workspace">
      <aside className="terminal-watchlist" aria-label="Capped output watchlist">
        <div className="terminal-panel-title"><h2>01 / OUTPUT WATCHLIST</h2><span>{visible.length} / 22</span></div>
        <div className="terminal-filters">
          <Input aria-label="Find task or test index" placeholder="Find task / task:index" value={search} onChange={event => setSearch(event.target.value)} />
          <select aria-label="Sort outputs" value={sort} onChange={event => setSort(event.target.value as 'task' | 'cells')}><option value="task">TASK ↑</option><option value="cells">CELLS ↓</option></select>
        </div>
        <div className="terminal-columns" aria-hidden="true"><span>TASK ID</span><span>IDX</span><span>OUT R×C</span><span>CELLS</span></div>
        <div className="terminal-rows">
          {visible.map(row => <button key={row.key} className={`terminal-row ${row.key === selected.key ? 'is-selected' : ''}`} onClick={() => select(row.key)} aria-label={`Inspect ${row.id} test index ${row.index}`} aria-pressed={row.key === selected.key}>
            <span>{row.id}</span><span>{row.index}</span><span>{dimensions(row.task?.test[row.index]?.output)}</span><span>{row.task ? cellCount(row.task.test[row.index]?.output) : '…'}</span>
          </button>)}
          {!visible.length && <p className="terminal-empty">No matching task. Clear the search to see all 22 outputs.</p>}
        </div>
        <div className="terminal-watchlist-note">AMBER = SELECTED · R×C = ROWS × COLUMNS<br />CELL COUNTS DESCRIBE KNOWN OUTPUTS</div>
      </aside>
      <article className="terminal-inspector" aria-label="Selected output inspector">
        <div className="terminal-panel-title"><h2>02 / TEST INSPECTOR</h2><div className="terminal-steppers">
          <Button variant="ghost" size="icon" aria-label="Previous output" disabled={selectedPosition <= 0} onClick={() => select(visible[selectedPosition - 1].key)}><ChevronLeft size={15} /></Button>
          <Button variant="ghost" size="icon" aria-label="Next output" disabled={selectedPosition < 0 || selectedPosition >= visible.length - 1} onClick={() => select(visible[selectedPosition + 1].key)}><ChevronRight size={15} /></Button>
        </div></div>
        <div className="terminal-task-heading"><h2>{selected.id}<span>:{selected.index}</span></h2><Link href={`/task/${selected.id}`}>TASK & EXPLANATIONS <ArrowUpRight size={13} /></Link></div>
        <div className="terminal-facts"><span>TEST <b>{selected.index + 1}</b> / {task?.test.length ?? '—'}</span><span>IN <b>{dimensions(example?.input)}</b></span><span>OUT <b>{dimensions(example?.output)}</b></span><span>CELLS <b>{example ? cellCount(example.output) : '—'}</b></span><span>TRAIN <b>{task?.train.length ?? '—'}</b></span></div>
        {selected.id === '13e47133' && <Link className="terminal-explanation" href="/task/13e47133?highlight=88511">DISCUSSION’S HIGHLIGHTED EXPLANATION ↗</Link>}
        {query.isLoading && <p className="terminal-empty" role="status"><Loader2 className="animate-spin inline mr-2" size={14} />Loading dataset grids…</p>}
        {(query.isError || (!query.isLoading && !example)) && <p className="terminal-empty" role="alert">Could not load this test. <button onClick={() => query.refetch()}>Retry</button> or open its task page.</p>}
        {task && example && <>
          <div className="terminal-selected-grids"><ExamplePair example={example} /></div>
          <div className="terminal-panel-title"><h2>03 / TRAINING EXAMPLES</h2><span>{task.train.length} PAIRS</span></div>
          <div className="terminal-training">{task.train.map((training, index) => <section key={index}><h3>TRAIN {String(index + 1).padStart(2, '0')}</h3><ExamplePair example={training} compact /></section>)}</div>
          {task.test.length > 1 && <details key={selected.id} className="terminal-other-tests"><summary>OTHER TESTS IN THIS TASK ({task.test.length - 1})</summary><div className="terminal-training">{task.test.map((other, index) => index === selected.index ? null : <section key={index}><h3>TEST {index + 1} · INDEX {index} <span>{CAPPED_COHORT.find(entry => entry.id === selected.id)?.tests.includes(index) ? 'IN COHORT' : 'NOT IN COHORT'}</span></h3><ExamplePair example={other} compact /></section>)}</div></details>}
        </>}
      </article>
    </div>
    <footer className="terminal-footer"><span>COHORT SNAPSHOT / 26 OCT 2026 · DATA / ARC EXPLAINER</span><span>CAP FAILURE ≠ UNSOLVABLE TASK</span></footer>
  </main>;
}
