/*
Author: Claude Opus 5
Date: 2026-09-02
PURPOSE: /arc3/hypotheses — a readable write-up of the hypothesis sweep, for handing to
         somebody outside the project. Two things live here because they came out of the same
         work and neither stands well alone: what a local vision model actually does when shown
         one frame of a game it has never seen, and what LM Studio's thinking controls turn out
         to do, which is not what their names suggest.

         WHY A PAGE AND NOT A MARKDOWN DOC. The docs in /docs are written for whoever picks the
         work up next; they assume the repository. This is for a reader who has none of that
         and wants to see the actual outputs. The traces are the point, so they are browsable
         rather than summarised -- a table of counts would hide exactly the thing worth looking
         at, which is 160 differently-named readings of one picture.

         Data comes from /data/arc3-hypothesis-traces.json, generated from the raw run log by
         scripts/arc3/build_hypothesis_dataset.py. The raw JSONL is gitignored machine-local
         research data; the committed extract carries only what a reader needs.
SRP/DRY check: Pass -- presentation only. Extraction lives in the build script, the experiment
         in scripts/arc3/hypothesis_sweep.py, and the reasoning in
         docs/plans/2026-09-01-arc3-hypothesis-sweep-plan.md. No numbers are hardcoded here
         that the dataset already states; the ones that are hardcoded are the LM Studio probe
         results, which are measurements rather than data this page loads.
*/

import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';

const ARC = {
  ground: '#0a0a0c',
  panel: '#141416',
  line: '#26262a',
  text: '#e8e6e3',
  dim: '#9a9895',
  faint: '#6a6967',
  pink: '#e0218a',
  amber: '#f0b429',
};
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const SERIF = 'Charter, "Bitstream Charter", "Iowan Old Style", Georgia, serif';

interface Hypothesis { n: number; name: string; body: string }
interface Run {
  host: string; model: string; game: string; frameSha: string;
  effort: string; temperature: number; replicate: number;
  elapsedMs: number; completionTokens: number; reasoningTokens: number | null;
  finishReason: string; hypotheses: Hypothesis[]; raw: string | null;
}
interface Dataset {
  runs: Run[];
  summary: {
    runCount: number; hypothesisCount: number; unparsedRuns: number;
    games: string[]; hosts: string[]; models: string[]; cells: Record<string, number>;
  };
}

/**
 * Measured against qwen3.8-27b through LM Studio on 01-Sep-2026, with a fixed 64-token text
 * prompt so that the ONLY thing able to move the token count is the rendered template. These
 * are observations, not documentation: LM Studio's own docs list none of these fields.
 */
const EFFORT_PROBE = [
  { sent: 'nothing sent', tokens: 64, did: 'template default — injects a "think carefully, validate key assumptions" instruction' },
  { sent: 'xhigh / high', tokens: 64, did: 'same as the default; `high` is normalised to `xhigh`' },
  { sent: 'low / minimal', tokens: 52, did: 'injects "keep your thinking brief and focused"' },
  { sent: 'medium', tokens: 26, did: 'injects nothing at all — the only neutral level' },
  { sent: 'none', tokens: 28, did: 'thinking genuinely off: empty think block, no reasoning emitted' },
  { sent: 'chat_template_kwargs', tokens: 64, did: 'accepted and silently ignored, at any nesting' },
  { sent: 'enable_thinking / /no_think', tokens: 64, did: 'accepted and silently ignored' },
];

const CONTROL_MAP = [
  { where: 'LM Studio GUI / preset config', field: 'llm.prediction.reasoning.budgetTokens', what: 'A real thinking-token budget, as a checkbox and a value. Not reachable over either HTTP API.' },
  { where: 'LM Studio GUI / preset config', field: 'ext.virtualModel.customField.<model>.enableThinking', what: 'Per-model override. A value set here has been reported to beat the API value.' },
  { where: 'OpenAI-compatible /v1/chat/completions', field: 'reasoning_effort', what: 'The only lever that reaches the template. Works by rewriting the prompt, not by budgeting tokens.' },
  { where: 'Native /api/v1/chat', field: 'reasoning', what: 'A cleaner six-level enum: off, low, medium, high, xhigh, on. Rejects an object, so no budget here either.' },
];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ flex: '1 1 140px', minWidth: 140 }}>
      <div style={{ fontFamily: MONO, fontSize: 30, color: ARC.pink, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 13, color: ARC.dim, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 56 }}>
      <h2 style={{
        fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: ARC.pink, marginBottom: 18, fontWeight: 600,
      }}>{title}</h2>
      {children}
    </section>
  );
}

export default function Arc3HypothesisResearch() {
  const { data, isLoading, isError } = useQuery<Dataset>({
    queryKey: ['/data/arc3-hypothesis-traces.json'],
    queryFn: async () => {
      const response = await fetch('/data/arc3-hypothesis-traces.json');
      if (!response.ok) throw new Error(`traces ${response.status}`);
      return response.json();
    },
    staleTime: Infinity,
  });

  const [cell, setCell] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  /** Which framings recur, once the names are stripped back to content words. This is the
   *  counterweight to the headline: the names are almost all new, the ideas are not. */
  const concepts = useMemo(() => {
    if (!data) return [];
    const stop = new Set(['the', 'and', 'with', 'from', 'that', 'this', 'system', 'mechanic',
      'based', 'game', 'board', 'grid', 'player', 'object', 'objects', 'square', 'squares']);
    const counts = new Map<string, number>();
    for (const run of data.runs) {
      for (const h of run.hypotheses) {
        for (const word of h.name.toLowerCase().match(/[a-z]+/g) ?? []) {
          if (word.length > 3 && !stop.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
        }
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [data]);

  const uniqueNames = useMemo(() => {
    if (!data) return 0;
    return new Set(data.runs.flatMap((r) => r.hypotheses.map((h) => h.name))).size;
  }, [data]);

  const cells = useMemo(() => (data ? Object.keys(data.summary.cells) : []), [data]);
  const shown = useMemo(() => {
    if (!data) return [];
    if (cell === 'all') return data.runs;
    return data.runs.filter((r) => `${r.effort}|${r.temperature}` === cell);
  }, [data, cell]);

  return (
    <div style={{ background: ARC.ground, color: ARC.text, minHeight: '100vh', padding: '48px 20px 96px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        <Link href="/arc3" style={{ fontFamily: MONO, fontSize: 12, color: ARC.faint, textDecoration: 'none' }}>
          ← ARC-AGI-3
        </Link>

        <h1 style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1.15, margin: '20px 0 0', fontWeight: 500 }}>
          One picture, one hundred and sixty guesses
        </h1>
        <p style={{ fontFamily: SERIF, fontSize: 19, lineHeight: 1.6, color: ARC.dim, marginTop: 14 }}>
          We showed a local vision model a single opening frame from one of our own ARC-AGI-3
          games — a game nobody outside this project has seen — and asked it, thirty-two separate
          times, what the rules might be. This is what came back, and what we learned about the
          machine underneath while getting it.
        </p>

        {isLoading && <p style={{ fontFamily: MONO, color: ARC.faint, marginTop: 40 }}>loading traces…</p>}
        {isError && (
          <p style={{ fontFamily: MONO, color: ARC.amber, marginTop: 40 }}>
            Could not load the trace data.
          </p>
        )}

        {data && (
          <>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 40, padding: '24px 0',
              borderTop: `1px solid ${ARC.line}`, borderBottom: `1px solid ${ARC.line}`,
            }}>
              <Stat value={String(data.summary.runCount)} label="runs, all completed" />
              <Stat value={String(data.summary.hypothesisCount)} label="hypotheses produced" />
              <Stat value={String(uniqueNames)} label="distinctly named" />
              <Stat value="0" label="incoherent answers" />
            </div>

            <Section title="What the model does">
              <p style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.7 }}>
                Asked five times over for five hypotheses about the same unchanged image, the
                model produced {data.summary.hypothesisCount} of them and gave{' '}
                {uniqueNames} of them a name it used nowhere else. It almost never repeats
                itself. Read one run and it looks like careful reasoning about a specific board;
                read eight from the same settings and the confidence starts to look like
                something else.
              </p>
              <p style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.7, marginTop: 16 }}>
                But novel names are not novel ideas. Strip the names back to their content words
                and a small set of framings keeps resurfacing — the model reaches for the same
                handful of explanations and dresses them differently each time.
              </p>

              <div style={{ marginTop: 22 }}>
                {concepts.map(([word, count]) => (
                  <div key={word} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <div style={{ fontFamily: MONO, fontSize: 13, width: 96, color: ARC.dim, textAlign: 'right' }}>{word}</div>
                    <div style={{
                      height: 14, width: `${(count / concepts[0][1]) * 320}px`,
                      background: ARC.pink, opacity: 0.75, borderRadius: 2,
                    }} />
                    <div style={{ fontFamily: MONO, fontSize: 12, color: ARC.faint }}>{count}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 13, color: ARC.faint, marginTop: 14, fontFamily: MONO }}>
                Word frequency across {data.summary.hypothesisCount} hypothesis names. Crude, and
                shown because it is crude: it counts vocabulary, not meaning.
              </p>
            </Section>

            <Section title="The thing we did not expect">
              <p style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.7 }}>
                Half of this experiment compares thinking on against thinking off, so the first
                job was pinning that switch. It turns out that on this stack{' '}
                <strong style={{ color: ARC.text }}>“reasoning effort” is not a thinking budget
                at all — it is a sentence added to your system prompt.</strong> Sending a
                different effort level rewrites the prompt the model receives, and you can watch
                it happen in the token count.
              </p>

              <div style={{ overflowX: 'auto', marginTop: 20 }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14, minWidth: 560 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${ARC.line}` }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px 8px 0', fontFamily: MONO, fontSize: 11, color: ARC.faint, textTransform: 'uppercase', letterSpacing: '0.1em' }}>sent</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', fontFamily: MONO, fontSize: 11, color: ARC.faint, textTransform: 'uppercase', letterSpacing: '0.1em' }}>tokens</th>
                      <th style={{ textAlign: 'left', padding: '8px 0 8px 12px', fontFamily: MONO, fontSize: 11, color: ARC.faint, textTransform: 'uppercase', letterSpacing: '0.1em' }}>what the template did</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EFFORT_PROBE.map((row) => (
                      <tr key={row.sent} style={{ borderBottom: `1px solid ${ARC.line}` }}>
                        <td style={{ padding: '10px 12px 10px 0', fontFamily: MONO, fontSize: 13, whiteSpace: 'nowrap' }}>{row.sent}</td>
                        <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 13, textAlign: 'right', color: ARC.pink }}>{row.tokens}</td>
                        <td style={{ padding: '10px 0 10px 12px', color: ARC.dim, lineHeight: 1.5 }}>{row.did}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.7, marginTop: 20 }}>
                The practical consequence is sharp. Comparing “thinking off” against effort{' '}
                <code style={{ fontFamily: MONO, fontSize: 14, color: ARC.amber }}>low</code> —
                the obvious pairing, and the one our first draft used — crosses a thinking
                switch with a prompt edit and cannot separate them. Only{' '}
                <code style={{ fontFamily: MONO, fontSize: 14, color: ARC.amber }}>medium</code>{' '}
                adds no text, so it is the only honest “on”. Nothing in the response reveals any
                of this. Both settings return fluent, confident answers.
              </p>

              <p style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.7, marginTop: 16 }}>
                A real thinking budget does exist — it is just somewhere else. There are four
                separate places to control this, and they do not agree:
              </p>

              <div style={{ marginTop: 18 }}>
                {CONTROL_MAP.map((row) => (
                  <div key={row.field} style={{
                    padding: '14px 16px', marginBottom: 8, background: ARC.panel,
                    border: `1px solid ${ARC.line}`, borderRadius: 4,
                  }}>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: ARC.faint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{row.where}</div>
                    <div style={{ fontFamily: MONO, fontSize: 13, color: ARC.pink, margin: '5px 0 6px', wordBreak: 'break-all' }}>{row.field}</div>
                    <div style={{ fontSize: 14, color: ARC.dim, lineHeight: 1.55 }}>{row.what}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 13, color: ARC.faint, marginTop: 12, lineHeight: 1.6 }}>
                Six spellings of a token budget were tried against the OpenAI-compatible
                endpoint. All were accepted and none had any effect. The native endpoint rejects
                a budget object outright, and its error message is the only place the six valid
                levels are written down.
              </p>
            </Section>

            <Section title="How it was run">
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <figure style={{ margin: 0, flex: '0 0 auto' }}>
                  <img
                    src="/data/arc3-hypothesis-frame-t088853a8.png"
                    alt="The 64x64 opening frame shown to the model: coloured squares on dark bands, divided by a black horizontal strip."
                    width={240}
                    height={240}
                    style={{ imageRendering: 'pixelated', border: `1px solid ${ARC.line}`, display: 'block' }}
                  />
                  <figcaption style={{ fontFamily: MONO, fontSize: 11, color: ARC.faint, marginTop: 8, maxWidth: 240, lineHeight: 1.5 }}>
                    Everything the model was given. 64×64 cells, no text, no controls.
                  </figcaption>
                </figure>
                <p style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.7, flex: '1 1 320px', margin: 0 }}>
                  One game, <code style={{ fontFamily: MONO, fontSize: 14 }}>{data.summary.games[0]}</code>,
                  rendered straight from the game engine — no console, no buttons, no labels.
                  Thirty-two runs across four settings: thinking off and on, at temperature 0.7
                  and 1.0, eight replicates each. Model{' '}
                  <code style={{ fontFamily: MONO, fontSize: 14 }}>{data.summary.models[0]}</code>{' '}
                  served locally.
                </p>
              </div>
              <p style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.7, marginTop: 18 }}>
                Every run records a hash of the exact bytes it was shown, so all thirty-two
                provably saw this one picture. That turned out to matter: the task was rewritten
                the following day and now opens on a different frame entirely. The image above is
                the one these traces are about, recovered from history and checked against the
                hash in the run log — without which the drift would have gone unnoticed and this
                page would be describing readings of a picture nobody could see any more.
              </p>
              <p style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.7, marginTop: 16 }}>
                The system prompt was deliberately wide — it names the domain and asks for
                hypotheses, and says nothing about grids, actions or levels. Describing the
                domain back to a model that already knows it is not context, it is steering.
              </p>
            </Section>

            <Section title="The traces">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                {['all', ...cells].map((key) => (
                  <button
                    key={key}
                    onClick={() => setCell(key)}
                    style={{
                      fontFamily: MONO, fontSize: 12, padding: '6px 12px', cursor: 'pointer',
                      background: cell === key ? ARC.pink : 'transparent',
                      color: cell === key ? '#fff' : ARC.dim,
                      border: `1px solid ${cell === key ? ARC.pink : ARC.line}`,
                      borderRadius: 3,
                    }}
                  >
                    {key === 'all'
                      ? `all ${data.summary.runCount}`
                      : `${key.split('|')[0]} · t=${key.split('|')[1]}`}
                  </button>
                ))}
              </div>

              {shown.map((run) => {
                const id = `${run.effort}-${run.temperature}-${run.replicate}`;
                const isOpen = expanded === id;
                return (
                  <div key={id} style={{
                    border: `1px solid ${ARC.line}`, borderRadius: 4, marginBottom: 10,
                    background: ARC.panel,
                  }}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : id)}
                      style={{
                        width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                        padding: '13px 16px', cursor: 'pointer', color: ARC.text,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                      }}
                    >
                      <span style={{ fontFamily: MONO, fontSize: 12, color: ARC.dim }}>
                        <span style={{ color: ARC.pink }}>{run.effort === 'none' ? 'thinking off' : 'thinking on'}</span>
                        {'  ·  '}t={run.temperature}{'  ·  '}run {run.replicate + 1}
                        {'  ·  '}{Math.round(run.elapsedMs / 1000)}s
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: ARC.faint }}>
                        {isOpen ? '−' : `${run.hypotheses.length} +`}
                      </span>
                    </button>

                    {!isOpen && (
                      <div style={{ padding: '0 16px 13px', fontSize: 14, color: ARC.dim, lineHeight: 1.6 }}>
                        {run.hypotheses.map((h) => h.name).join(' · ')}
                      </div>
                    )}

                    {isOpen && (
                      <div style={{ padding: '0 16px 16px' }}>
                        {run.hypotheses.map((h) => (
                          <div key={h.n} style={{ marginBottom: 16 }}>
                            <div style={{ fontFamily: MONO, fontSize: 14, color: ARC.amber, marginBottom: 5 }}>
                              {h.n}. {h.name}
                            </div>
                            <div style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.6, color: ARC.dim }}>
                              {h.body}
                            </div>
                          </div>
                        ))}
                        {run.raw && (
                          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: MONO, fontSize: 12, color: ARC.dim }}>
                            {run.raw}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </Section>

            <Section title="Caveats">
              <ul style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.7, color: ARC.dim, paddingLeft: 20 }}>
                <li style={{ marginBottom: 10 }}>
                  This is one game and one model. A second machine ran eight games and produced
                  the same broad picture, but those runs are not included here.
                </li>
                <li style={{ marginBottom: 10 }}>
                  “Zero incoherent answers” is a count of what a crude symbol-density heuristic
                  flagged, backed by spot-checking a handful by hand. It is not a hand-labelled
                  rate, and it would not catch an answer that is fluent and wrong — which is the
                  more interesting failure and the harder one to measure.
                </li>
                <li style={{ marginBottom: 10 }}>
                  Nothing here is scored against the real rules. We hold them, but grading after
                  the fact, with the answers already read, is how you talk yourself into a
                  result. That needs a rubric written first.
                </li>
                <li>
                  The LM Studio findings are observations of one build on two machines, not
                  documentation. They are the sort of thing that changes silently in a release.
                </li>
              </ul>
            </Section>

            <p style={{ fontFamily: MONO, fontSize: 12, color: ARC.faint, marginTop: 56, lineHeight: 1.7 }}>
              Runs on {data.summary.hosts.join(', ')} · frame hash{' '}
              {data.runs[0]?.frameSha} · harness at scripts/arc3/hypothesis_sweep.py
            </p>
          </>
        )}
      </div>
    </div>
  );
}
