/*
Author: Claude Opus 5
Date: 2026-08-28
PURPOSE: Landing page for the synthetic ARC-AGI-3 programme, served as the root of
         arc3.markbarney.net. Two audiences, one page: someone with no background who
         needs the idea in plain language and one game to try, and a researcher deciding
         whether the set and its data are worth their time.
         Numbers are cited from the ARC-AGI-3 technical report (22-Apr-2026) rather than
         asserted -- humans 100%, best frontier model 0.50% (Table 2). An earlier draft
         said models "score zero", which is wrong and would not survive a poster session.
         Prose is set in a sans stack for readability; monospace is kept for chrome, ids
         and code, matching CommunityGallery and the official ARC-AGI-3 task pages.
         Steers play toward ZERO-PLAY tasks: coverage is the scarce resource, not tasks.
SRP/DRY check: Pass - reuses the community games API and the thumbnail endpoint added for
         the gallery; no new data plumbing. Routing stays in App.tsx.
*/

import { useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';

interface Game {
  gameId: string;
  displayName: string;
  authorName: string;
  playCount: number;
  levelCount: number | null;
  tags: string[];
}
interface GamesResponse {
  success: boolean;
  data: { games: Game[]; total: number };
}

const ARC = {
  ground: '#0E0C0C', text: '#E3E1DF', dim: '#A7A3A1', faint: '#6E6A68',
  cell: '#191919', border: '#262626', pink: '#E53AA3', pinkAlt: '#C42F89',
  control: '#393736', green: '#4FCC30', yellow: '#FFDC00',
};
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif";
const MONO = "'SF Mono', Menlo, Consolas, 'Courier New', monospace";

const LUMA = 'https://luma.com/z1h24dqe?tk=kddwGm';
const REPORT = 'https://arcprize.org/media/ARC_AGI_3_Technical_Report.pdf';
const ARENA_REPO = 'https://github.com/sonpham-org/autoresearch-arena';
const ARENA_SITE = 'https://arc3.sonpham.net';

/* ARC-AGI-3 technical report, Table 2 — semi-private leaderboard at release. */
const RELEASE_SCORES: [string, string][] = [
  ['Claude Opus 4.6 (Max)', '0.50%'],
  ['Gemini 3.1 Pro Preview', '0.40%'],
  ['GPT 5.4 (High)', '0.20%'],
  ['Grok-4.20 (Reasoning)', '0.10%'],
];

const RELATED = [
  { href: ARENA_SITE, label: 'arc3.sonpham.net', note: 'The research arena — agent harness, evolution loops, leaderboards' },
  { href: 'https://markbarney.net', label: 'markbarney.net', note: 'Everything else' },
  { href: 'https://farm.markbarney.net', label: 'farm.markbarney.net', note: 'Kaggriculture — a farming-economy agent arena' },
  { href: 'https://voynichlabs.org', label: 'voynichlabs.org', note: 'Voynich Labs' },
];

function thumb(gameId: string, size = 256) {
  return `/api/arc3-community/games/${encodeURIComponent(gameId)}/thumbnail?size=${size}`;
}

function Scanlines() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{
      backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0) 0 2px, rgba(0,0,0,.38) 2px 4px)',
    }} />
  );
}

function Tile({ game, alt }: { game: Game; alt: boolean }) {
  return (
    <Link href={`/arc3/play/${game.gameId}`}>
      <a className="group block">
        <div className="relative aspect-square overflow-hidden"
             style={{ background: ARC.cell, border: `1px solid ${ARC.border}` }}>
          <img src={thumb(game.gameId)} alt="" loading="lazy" decoding="async"
               className="w-full h-full opacity-90 group-hover:opacity-100 transition-opacity"
               style={{ imageRendering: 'pixelated', display: 'block' }} />
          <Scanlines />
        </div>
        <div className="flex items-center justify-between gap-2 px-2 py-1"
             style={{ background: alt ? ARC.pinkAlt : ARC.pink, fontFamily: MONO }}>
          <span className="text-[11px] tracking-[.55px] text-white truncate">{game.gameId}</span>
          {game.levelCount ? (
            <span className="text-[10px] text-white/75 shrink-0">{game.levelCount}L</span>
          ) : null}
        </div>
      </a>
    </Link>
  );
}

function Section({ title, note, children }: {
  title: string; note?: string; children: React.ReactNode;
}) {
  return (
    <section className="mb-16">
      <div className="flex items-baseline gap-3 mb-5 pb-2"
           style={{ borderBottom: `1px solid ${ARC.border}` }}>
        <h2 className="text-[11px] tracking-[2.5px] uppercase"
            style={{ color: ARC.text, fontFamily: MONO }}>{title}</h2>
        {note && <span className="text-[11px]" style={{ color: ARC.faint, fontFamily: MONO }}>{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className="p-4" style={{ background: ARC.cell, border: `1px solid ${ARC.border}` }}>
      <div className="text-[26px] leading-none mb-2" style={{ color: tone, fontFamily: MONO }}>{value}</div>
      <div className="text-[12px] leading-[1.6]" style={{ color: ARC.dim }}>{label}</div>
    </div>
  );
}

export default function SyntheticLanding() {
  const { data } = useQuery<GamesResponse>({
    queryKey: ['/api/arc3-community/games?orderBy=playCount&orderDir=DESC&limit=100'],
  });

  const games = data?.data?.games ?? [];

  // Coverage, not supply, is the bottleneck: point first-time players at a task nobody
  // has played, rotating per visit so we do not pile every visitor onto one task.
  const needsCoverage = useMemo(() => {
    const unplayed = games.filter((g) => (g.playCount ?? 0) === 0);
    const pool = unplayed.length ? unplayed : games;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }, [games]);

  // A dozen real frames read as a body of work; four read as a sample. This is the
  // first thing a visitor sees, so it should look like the set it is.
  const heroTiles = useMemo(() => games.slice(0, 12), [games]);

  // Who actually made these. The set is overwhelmingly community-contributed and the
  // page said nothing about that, which undersold the thing it is asking people to join.
  const byAuthor = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of games) counts.set(g.authorName, (counts.get(g.authorName) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [games]);
  const synthetic = games.filter((g) => (g.tags ?? []).includes('synthetic'));
  const rest = games.filter((g) => !(g.tags ?? []).includes('synthetic'));
  const unplayed = games.filter((g) => (g.playCount ?? 0) === 0).length;

  return (
    <div style={{ background: ARC.ground, color: ARC.text, minHeight: '100vh', fontFamily: SANS }}>
      <div className="max-w-[1080px] mx-auto px-5 py-12">

        {/* ── hero ─────────────────────────────────────────────────────────── */}
        <header className="mb-12">
          <p className="text-[11px] tracking-[3px] uppercase mb-5"
             style={{ color: ARC.pink, fontFamily: MONO }}>
            Synthetic ARC-AGI-3 tasks
          </p>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-start">
            <div>
              <h1 className="text-[30px] sm:text-[40px] leading-[1.15] font-bold mb-6 tracking-[-0.5px]">
                Humans solve these. The best AI in the world scores half a percent.
              </h1>
              <div className="text-[15px] leading-[1.75] space-y-4" style={{ color: ARC.dim }}>
                <p>
                  Open one and you get a screen, a few buttons, and no instructions. Nobody
                  tells you the goal, what the buttons do, or what the colours mean. You
                  press things, watch what changes, and work it out.{' '}
                  <strong style={{ color: ARC.text }}>Most people manage in a couple of minutes.</strong>
                </p>
                <p>
                  The systems that pass medical exams and write working software{' '}
                  <strong style={{ color: ARC.text }}>almost entirely cannot.</strong> On the
                  official benchmark humans clear 100% of these environments. The best model
                  anyone has tested scores <strong style={{ color: ARC.text }}>0.50%</strong>.
                </p>
                <p>
                  That gap is not a gimmick — it is the most useful thing we know about what
                  these systems are. Exams reward recall. This rewards something else:
                  looking at a thing you have never seen, guessing how it works, and
                  throwing the guess away the moment it stops fitting. You do that all day
                  without noticing. Machines are remarkably bad at it, and nobody fully
                  knows why.
                </p>
              </div>
            </div>

            {/* Real opening frames — the fastest way to convey what a task even is. */}
            {heroTiles.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {heroTiles.map((g) => (
                  <Link key={g.gameId} href={`/arc3/play/${g.gameId}`}>
                    <a className="relative aspect-square overflow-hidden block group"
                       style={{ background: ARC.cell, border: `1px solid ${ARC.border}` }}>
                      <img src={thumb(g.gameId, 128)} alt="" loading="lazy"
                           className="w-full h-full opacity-85 group-hover:opacity-100 transition-opacity"
                           style={{ imageRendering: 'pixelated', display: 'block' }} />
                      <Scanlines />
                    </a>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* ── the numbers, cited ───────────────────────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <Stat value="100%" label="of these environments solved by humans" tone={ARC.green} />
          <Stat value="0.50%" label="best frontier model, at benchmark release" tone={ARC.pink} />
          <Stat value={games.length ? String(games.length) : '—'} label="tasks playable here, right now" tone={ARC.text} />
          <Stat value={games.length ? String(unplayed) : '—'} label="with no human attempt on record" tone={ARC.yellow} />
        </div>
        <p className="text-[12px] mb-14" style={{ color: ARC.faint }}>
          Human and model figures from the{' '}
          <a href={REPORT} target="_blank" rel="noreferrer" className="underline">
            ARC-AGI-3 technical report
          </a>{' '}
          (22 April 2026), Table 2. Best-of-four at release: Opus 4.6 0.50%, Gemini 3.1 Pro
          0.40%, GPT 5.4 0.20%, Grok-4.20 0.10%.
        </p>

        {/* ── the one ask ──────────────────────────────────────────────────── */}
        {needsCoverage && (
          <div className="mb-16 flex flex-col sm:flex-row gap-6 items-start p-6"
               style={{ background: ARC.cell, border: `1px solid ${ARC.pink}` }}>
            <Link href={`/arc3/play/${needsCoverage.gameId}`}>
              <a className="shrink-0 w-[150px] group">
                <div className="relative aspect-square overflow-hidden"
                     style={{ border: `1px solid ${ARC.border}` }}>
                  <img src={thumb(needsCoverage.gameId)} alt=""
                       className="w-full h-full" style={{ imageRendering: 'pixelated', display: 'block' }} />
                  <Scanlines />
                </div>
                <div className="px-2 py-1 text-[11px] tracking-[.55px] text-white"
                     style={{ background: ARC.pink, fontFamily: MONO }}>{needsCoverage.gameId}</div>
              </a>
            </Link>
            <div className="min-w-0">
              <h2 className="text-[20px] font-bold mb-3">Nobody has ever played this one.</h2>
              <p className="text-[14px] leading-[1.75] mb-5" style={{ color: ARC.dim }}>
                {unplayed} of {games.length} tasks here have no human attempt on record — not
                one, ever. Until somebody tries, we cannot say whether this one is easy for a
                person or quietly impossible, which means the model's score on it means
                nothing either. You would be the first.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link href={`/arc3/play/${needsCoverage.gameId}`}>
                  <a className="inline-block px-6 h-[42px] leading-[42px] text-[13px] font-semibold tracking-[.5px] rounded-[4px]"
                     style={{ background: ARC.pink, color: '#fff' }}>Play it →</a>
                </Link>
                <Link href="/arc3/gallery">
                  <a className="text-[13px] underline" style={{ color: ARC.dim }}>or pick your own</a>
                </Link>
              </div>
              <p className="text-[12px] mt-4" style={{ color: ARC.faint }}>
                About five minutes. No account, nothing to install, no experience needed.
              </p>
            </div>
          </div>
        )}

        {/* ── the tasks ────────────────────────────────────────────────────── */}
        {synthetic.length > 0 && (
          <Section title="Our synthetic set" note={`${synthetic.length} generated`}>
            <p className="text-[14px] leading-[1.75] mb-5 max-w-[70ch]" style={{ color: ARC.dim }}>
              Generated from a mechanic-axis ledger, built against the real ARC-AGI-3 engine,
              and proven solvable before shipping.
            </p>
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(112px,1fr))]">
              {synthetic.map((g, i) => <Tile key={g.gameId} game={g} alt={i % 2 === 1} />)}
            </div>
          </Section>
        )}

        {rest.length > 0 && (
          <Section title="Community tasks" note={`${rest.length} contributed`}>
            <p className="text-[14px] leading-[1.75] mb-4 max-w-[70ch]" style={{ color: ARC.dim }}>
              Most of what is playable here was contributed by other people. Every one is a
              real ARC-AGI-3 environment running on the official engine — the same thing an
              agent is given.
            </p>
            {byAuthor.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {byAuthor.map(([name, n]) => (
                  <span key={name} className="text-[11px] px-2 py-1"
                        style={{ background: ARC.cell, border: `1px solid ${ARC.border}`,
                                 color: ARC.dim, fontFamily: MONO }}>
                    {name} <span style={{ color: ARC.pink }}>{n}</span>
                  </span>
                ))}
              </div>
            )}
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(112px,1fr))]">
              {rest.map((g, i) => <Tile key={g.gameId} game={g} alt={i % 2 === 1} />)}
            </div>
            <p className="text-[13px] mt-5">
              <Link href="/arc3/gallery"><a className="underline" style={{ color: ARC.dim }}>
                Browse every task →
              </a></Link>
            </p>
          </Section>
        )}

        {/* ── method ───────────────────────────────────────────────────────── */}
        <Section title="How the set is made">
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 text-[14px] leading-[1.75]"
               style={{ color: ARC.dim }}>
            {[
              ['An idea ledger, not a pile',
               'Every candidate names a mechanic axis — what the puzzle is actually about — and the failure mode it targets in an agent. A new idea must be novel on that axis against every existing entry. That dedup rule is what stops the set filling up with twenty reskins of "infer the hidden rule".'],
              ['Built on the real engine',
               'Tasks are authored as ARCEngine games: the same 64×64 frame, 16-colour palette and action space the benchmark uses. Humans and agents therefore play the identical environment, so comparing them is a subtraction rather than an argument.'],
              ['Nothing is explained',
               'No control legend, no goal statement, no tutorial text, no descriptive level names, no rule readouts — and no explanatory docstring, since task source is public. A player who is told the mechanic has been handed the answer the agent had to infer. A conformance check enforces this, and it caught real leaks on its first run.'],
              ['Proven winnable, not just loadable',
               'Loading is a low bar. Each task ships a verifier that proves every level is solvable from its start state by exhaustive search over the real state space. Porting the first task, that check caught five boards that were unsolvable and two doors sealed behind walls — all of which loaded perfectly.'],
            ].map(([title, body], i) => (
              <div key={title}>
                <h3 className="text-[15px] font-semibold mb-2" style={{ color: ARC.text }}>
                  <span style={{ color: ARC.pink, fontFamily: MONO }}>{i + 1}</span> · {title}
                </h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── researchers ──────────────────────────────────────────────────── */}
        <Section title="For researchers" note="contribute · reuse · replicate">
          <div className="grid gap-x-10 gap-y-8 lg:grid-cols-3 text-[14px] leading-[1.75]"
               style={{ color: ARC.dim }}>
            <div>
              <h3 className="text-[15px] font-semibold mb-2" style={{ color: ARC.text }}>Contribute a task</h3>
              <p className="mb-4">
                One Python file: a class inheriting <code style={{ fontFamily: MONO, color: ARC.text }}>ARCBaseGame</code>,
                importing from <code style={{ fontFamily: MONO, color: ARC.text }}>arcengine</code>,
                rendering to the 64×64 frame. Submissions go through a review queue.
              </p>
              <Link href="/arc3/upload">
                <a className="inline-block px-4 h-[36px] leading-[36px] text-[12px] rounded-[4px]"
                   style={{ background: ARC.control, color: ARC.text }}>Submit a task →</a>
              </Link>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold mb-2" style={{ color: ARC.text }}>Use the data</h3>
              <p>
                Play telemetry is anonymous and aggregate-only: first-play completion rate
                per level, actions to solve, restarts before a first clear, and where people
                give up. It is recorded in the harness's own action space —{' '}
                <code style={{ fontFamily: MONO, color: ARC.text }}>1=Up 2=Down 3=Left 4=Right 5=Action 6=Click 7=Undo</code>{' '}
                — so a human row joins an agent row directly instead of through a translation
                layer. Only a first blind attempt answers "is this easy for a human", so
                first sessions are flagged and kept separate from repeat plays.
              </p>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold mb-2" style={{ color: ARC.text }}>Release scores</h3>
              <table className="w-full text-[12px]" style={{ fontFamily: MONO }}>
                <tbody>
                  {RELEASE_SCORES.map(([model, score]) => (
                    <tr key={model} style={{ borderBottom: `1px solid ${ARC.border}` }}>
                      <td className="py-1.5 pr-2" style={{ color: ARC.dim }}>{model}</td>
                      <td className="py-1.5 text-right" style={{ color: ARC.pink }}>{score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[12px] mt-3" style={{ color: ARC.faint }}>
                Technical report Table 2. Humans: 100%.
              </p>
              <p className="text-[13px] mt-4">
                <a href="/api/arc3-community/games" className="underline">API</a>
                {' · '}
                <a href={ARENA_REPO} target="_blank" rel="noreferrer" className="underline">generator + harness</a>
                {' · '}
                <a href={ARENA_SITE} target="_blank" rel="noreferrer" className="underline">research arena</a>
              </p>
            </div>
          </div>
        </Section>

        {/* ── the ask ──────────────────────────────────────────────────────── */}
        <Section title="Where this is going">
          <div className="p-6 text-[14px] leading-[1.8] max-w-[76ch]"
               style={{ background: ARC.cell, border: `1px solid ${ARC.border}`, color: ARC.dim }}>
            <p className="mb-4">
              We are aiming to present a poster at the{' '}
              <a href={LUMA} target="_blank" rel="noreferrer" className="underline"
                 style={{ color: ARC.text }}>ARC-AGI-3 event in Boston</a>.
            </p>
            <p className="mb-4">
              The poster is one chart: human first-play completion on one axis, agent
              completion on the other, per level, on the same tasks. The agent half is
              measured. The human half is currently an assertion — which is exactly why
              every play counts, and why we would rather you played something nobody has
              touched than whatever sits at the top of the list.
            </p>
            <p style={{ color: ARC.faint }}>
              Anonymous gameplay events are recorded — inputs, timings, progress. No account,
              no personal data.
            </p>
          </div>
        </Section>

        {/* ── related ──────────────────────────────────────────────────────── */}
        <Section title="Related work">
          <div className="grid gap-3 sm:grid-cols-2">
            {RELATED.map((r) => (
              <a key={r.href} href={r.href} target="_blank" rel="noreferrer"
                 className="block p-4 transition-colors"
                 style={{ background: ARC.cell, border: `1px solid ${ARC.border}` }}>
                <div className="text-[13px] mb-1" style={{ color: ARC.pink, fontFamily: MONO }}>
                  {r.label} ↗
                </div>
                <div className="text-[13px] leading-[1.7]" style={{ color: ARC.dim }}>{r.note}</div>
              </a>
            ))}
          </div>
        </Section>

        <footer className="pt-2 text-[12px] leading-[2]" style={{ color: ARC.faint }}>
          <Link href="/arc3/gallery"><a className="underline">All tasks</a></Link>
          <span className="mx-2 opacity-50">·</span>
          <Link href="/arc3"><a className="underline">ARC-AGI-3 reference</a></Link>
          <span className="mx-2 opacity-50">·</span>
          <Link href="/home"><a className="underline">ARC Explainer</a></Link>
        </footer>
      </div>
    </div>
  );
}
