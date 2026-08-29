/*
Author: Claude Opus 5
Date: 2026-08-28
PURPOSE: Landing page for the synthetic ARC-AGI-3 programme, served as the root of
         arc3.markbarney.net. Three audiences on one page, in this order: a visitor who
         has never heard of ARC and needs the idea in plain language plus one game to
         try; a researcher who wants to contribute or reuse the set; and us, keeping the
         methodology and the Boston poster ambition stated honestly.
         Deliberately steers play toward ZERO-PLAY tasks -- 55 of 59 currently have no
         plays at all, so the scarce resource is coverage, not games.
         Visual language matches CommunityGallery and the official ARC-AGI-3 task pages.
SRP/DRY check: Pass - reuses the community games API and the thumbnail endpoint added
         for the gallery; no new data plumbing. Routing lives in App.tsx as usual.
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
  ground: '#0E0C0C', text: '#E3E1DF', dim: '#9A9694', faint: '#6E6A68',
  cell: '#191919', border: '#262626', pink: '#E53AA3', pinkAlt: '#C42F89',
  control: '#393736', green: '#4FCC30',
};

const LUMA = 'https://luma.com/z1h24dqe?tk=kddwGm';
const ARENA_REPO = 'https://github.com/sonpham-org/autoresearch-arena';
const ARENA_SITE = 'https://arc3.sonpham.net';
const RELATED = [
  { href: 'https://arc3.sonpham.net', label: 'arc3.sonpham.net', note: 'The research arena — agents, evolution loops, leaderboards' },
  { href: 'https://markbarney.net', label: 'markbarney.net', note: 'Everything else' },
  { href: 'https://farm.markbarney.net', label: 'farm.markbarney.net', note: 'Kaggriculture — a farming-economy agent arena' },
  { href: 'https://voynichlabs.org', label: 'voynichlabs.org', note: 'Voynich Labs' },
];

function Tile({ game, alt }: { game: Game; alt: boolean }) {
  return (
    <Link href={`/arc3/play/${game.gameId}`}>
      <a className="group block">
        <div className="relative aspect-square overflow-hidden"
             style={{ background: ARC.cell, border: `1px solid ${ARC.border}` }}>
          <img
            src={`/api/arc3-community/games/${encodeURIComponent(game.gameId)}/thumbnail?size=256`}
            alt="" loading="lazy" decoding="async"
            className="w-full h-full opacity-90 group-hover:opacity-100 transition-opacity"
            style={{ imageRendering: 'pixelated', display: 'block' }}
          />
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(0,0,0,0) 0 2px, rgba(0,0,0,.38) 2px 4px)',
          }} />
        </div>
        <div className="flex items-center justify-between gap-2 px-2 py-1"
             style={{ background: alt ? ARC.pinkAlt : ARC.pink }}>
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
    <section className="mb-14">
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="text-[12px] tracking-[2px] uppercase" style={{ color: ARC.text }}>{title}</h2>
        {note && <span className="text-[11px]" style={{ color: ARC.faint }}>{note}</span>}
      </div>
      {children}
    </section>
  );
}

export default function SyntheticLanding() {
  const { data } = useQuery<GamesResponse>({
    queryKey: ['/api/arc3-community/games?orderBy=playCount&orderDir=DESC&limit=100'],
  });

  const games = data?.data?.games ?? [];

  // Coverage is the scarce resource, not games: point first-time players at a task
  // nobody has played. Rotates per visit so we do not pile every visitor onto one task.
  const needsCoverage = useMemo(() => {
    const unplayed = games.filter((g) => (g.playCount ?? 0) === 0);
    const pool = unplayed.length ? unplayed : games;
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [games]);

  const synthetic = games.filter((g) => (g.tags ?? []).includes('synthetic'));
  const rest = games.filter((g) => !(g.tags ?? []).includes('synthetic'));
  const unplayedCount = games.filter((g) => (g.playCount ?? 0) === 0).length;

  return (
    <div style={{ background: ARC.ground, color: ARC.text, minHeight: '100vh' }} className="font-mono">
      <div className="max-w-[1100px] mx-auto px-5 py-10">

        {/* ── for someone who has never heard of any of this ─────────────── */}
        <header className="mb-12">
          <p className="text-[11px] tracking-[3px] uppercase mb-4" style={{ color: ARC.pink }}>
            Synthetic ARC-AGI-3 tasks
          </p>
          <h1 className="text-[26px] sm:text-[34px] leading-[1.22] font-bold max-w-[22ch] mb-6">
            AI can pass the bar exam. It cannot beat these.
          </h1>
          <div className="text-[13px] leading-[2] max-w-[68ch] space-y-4" style={{ color: ARC.dim }}>
            <p>
              Click a task below and you get a screen, a few buttons, and no instructions.
              Nobody tells you the goal, what the buttons do, or what the colours mean. You
              press things, watch what changes, and figure it out.{' '}
              <strong style={{ color: ARC.text }}>Most people manage in about two minutes.</strong>
            </p>
            <p>
              The most advanced AI systems in the world — the ones that pass medical exams
              and write working software — mostly{' '}
              <strong style={{ color: ARC.text }}>score zero</strong>. Not "do badly". Zero.
              They have read more than any human alive, and they cannot work out a small
              game a child masters in a couple of minutes.
            </p>
            <p>
              That sounds like a joke, and it is actually the most useful fact we have about
              what these systems are. Exams reward recall. This rewards something else:
              looking at a thing you have never seen, guessing how it works, and{' '}
              <em style={{ color: ARC.text }}>throwing the guess away</em> the moment it
              stops fitting. Humans do that constantly and barely notice. Machines are
              strikingly bad at it, and nobody fully knows why.
            </p>
            <p>
              To measure that gap honestly you need both halves. We have the machine half —
              agents play these tasks and we log every move. The human half is missing, and
              it can only come from people. That is the entire ask:{' '}
              <strong style={{ color: ARC.text }}>play one game, once, without being told
              anything.</strong> Five minutes. No account, no sign-up, nothing to install.
              Your fumbling around is the data.
            </p>
          </div>
        </header>

        {/* ── the one CTA that matters ────────────────────────────────────── */}
        {needsCoverage && (
          <div className="mb-14 flex flex-col sm:flex-row gap-6 items-start p-5"
               style={{ background: ARC.cell, border: `1px solid ${ARC.border}` }}>
            <Link href={`/arc3/play/${needsCoverage.gameId}`}>
              <a className="shrink-0 w-[136px] group">
                <div className="relative aspect-square overflow-hidden"
                     style={{ border: `1px solid ${ARC.border}` }}>
                  <img
                    src={`/api/arc3-community/games/${encodeURIComponent(needsCoverage.gameId)}/thumbnail?size=256`}
                    alt="" className="w-full h-full" style={{ imageRendering: 'pixelated', display: 'block' }}
                  />
                </div>
                <div className="px-2 py-1 text-[11px] tracking-[.55px] text-white"
                     style={{ background: ARC.pink }}>{needsCoverage.gameId}</div>
              </a>
            </Link>
            <div className="min-w-0">
              <h2 className="text-[15px] mb-2" style={{ color: ARC.green }}>
                This one has never been played
              </h2>
              <p className="text-[12px] leading-[1.9] mb-4" style={{ color: ARC.dim }}>
                {unplayedCount} of {games.length} tasks have no human attempt on record —
                not one, ever. Until somebody tries, we genuinely cannot say whether this
                one is easy for a person or quietly impossible, which means we cannot say
                anything about how the machines did on it either. You would be the first.
                It takes about five minutes and you need to know nothing at all.
              </p>
              <Link href={`/arc3/play/${needsCoverage.gameId}`}>
                <a className="inline-block px-5 h-[36px] leading-[36px] text-[12px] tracking-[1px] rounded-[4px]"
                   style={{ background: ARC.pink, color: '#fff' }}>PLAY IT →</a>
              </Link>
              <Link href="/arc3/gallery">
                <a className="inline-block ml-3 text-[12px] underline" style={{ color: ARC.faint }}>
                  or pick your own
                </a>
              </Link>
            </div>
          </div>
        )}

        {/* ── the games ───────────────────────────────────────────────────── */}
        {synthetic.length > 0 && (
          <Section title="Our synthetic set" note={`${synthetic.length} generated`}>
            <p className="text-[12px] leading-[1.9] mb-4 max-w-[68ch]" style={{ color: ARC.dim }}>
              Generated from a mechanic-axis ledger, built against the real ARC-AGI-3
              engine, and verified solvable before shipping.
            </p>
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(112px,1fr))]">
              {synthetic.map((g, i) => <Tile key={g.gameId} game={g} alt={i % 2 === 1} />)}
            </div>
          </Section>
        )}

        {rest.length > 0 && (
          <Section title="The wider set" note={`${rest.length} tasks`}>
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(112px,1fr))]">
              {rest.map((g, i) => <Tile key={g.gameId} game={g} alt={i % 2 === 1} />)}
            </div>
          </Section>
        )}

        {/* ── methodology ─────────────────────────────────────────────────── */}
        <Section title="How the set is made">
          <div className="grid gap-6 sm:grid-cols-2 text-[12px] leading-[1.9]" style={{ color: ARC.dim }}>
            <div>
              <h3 className="text-[12px] mb-2" style={{ color: ARC.text }}>1 · An idea ledger, not a pile</h3>
              <p>
                Every candidate names a <em>mechanic axis</em> — what the puzzle is actually
                about — and the <em>failure mode</em> it targets in an agent. A new idea has
                to be novel on that axis against every existing entry. That dedup rule is
                what stops the set filling up with twenty reskins of "infer the hidden rule".
              </p>
            </div>
            <div>
              <h3 className="text-[12px] mb-2" style={{ color: ARC.text }}>2 · Built on the real engine</h3>
              <p>
                Tasks are authored as ARCEngine games — the same 64×64 frame, 16-colour
                palette and action space the benchmark uses. Humans and agents therefore
                play the identical environment, so comparing them is a subtraction rather
                than an argument.
              </p>
            </div>
            <div>
              <h3 className="text-[12px] mb-2" style={{ color: ARC.text }}>3 · Nothing is explained</h3>
              <p>
                No control legend, no goal statement, no tutorial text, no descriptive level
                names, no rule readouts — and no explanatory docstring, since task source is
                public. A player who is told the mechanic has been handed the answer the
                agent had to infer, and their run is worthless as a baseline. A conformance
                check enforces this; it caught real leaks on its first run.
              </p>
            </div>
            <div>
              <h3 className="text-[12px] mb-2" style={{ color: ARC.text }}>4 · Verified winnable</h3>
              <p>
                Loading is not enough. Each task ships a verifier that proves every level is
                actually solvable from its start state — an exhaustive search over the real
                state space. Porting the first task, that check caught five boards that were
                unsolvable and two doors sealed behind walls. All of them loaded fine.
              </p>
            </div>
          </div>
        </Section>

        {/* ── researchers ─────────────────────────────────────────────────── */}
        <Section title="For researchers"
                 note="ARC-AGI-3 · interactive reasoning · human baselines">
          <div className="grid gap-6 sm:grid-cols-2 text-[12px] leading-[1.9]" style={{ color: ARC.dim }}>
            <div>
              <h3 className="text-[12px] mb-2" style={{ color: ARC.text }}>Contribute a task</h3>
              <p className="mb-3">
                A task is one Python file: a class inheriting <code>ARCBaseGame</code>,
                importing from <code>arcengine</code>, on a 32×32 logical grid rendered to
                the 64×64 frame. Submissions go through a review queue.
              </p>
              <Link href="/arc3/upload">
                <a className="inline-block px-4 h-[32px] leading-[32px] text-[11px] tracking-[.5px] rounded-[4px]"
                   style={{ background: ARC.control, color: ARC.text }}>SUBMIT A TASK →</a>
              </Link>
            </div>
            <div>
              <h3 className="text-[12px] mb-2" style={{ color: ARC.text }}>Use the set and the data</h3>
              <p>
                Tasks and their source are public over the community API. Play telemetry is
                anonymous and aggregate-only: first-play completion rate per level, actions
                to solve, restarts before a first clear, and where people give up — recorded
                in the benchmark's own action space (<code>1=Up 2=Down 3=Left 4=Right
                5=Action 6=Click 7=Undo</code>) so a human row joins a harness row directly
                rather than through a translation layer.
              </p>
              <p className="mt-2">
                Only a first blind attempt answers "is this easy for a human", so first
                sessions are flagged and separated rather than pooled with repeat plays.
              </p>
              <p className="mt-3">
                <a href="/api/arc3-community/games" className="underline">community API</a>
                {' · '}
                <a href={ARENA_REPO} target="_blank" rel="noreferrer" className="underline">
                  generator + harness
                </a>
                {' · '}
                <a href={ARENA_SITE} target="_blank" rel="noreferrer" className="underline">
                  the research arena
                </a>
              </p>
            </div>
          </div>
        </Section>

        {/* ── the ask ─────────────────────────────────────────────────────── */}
        <Section title="Where this is going">
          <div className="p-5 text-[12px] leading-[1.9] max-w-[72ch]"
               style={{ background: ARC.cell, border: `1px solid ${ARC.border}`, color: ARC.dim }}>
            <p className="mb-3">
              We are aiming to present a poster at the{' '}
              <a href={LUMA} target="_blank" rel="noreferrer" className="underline"
                 style={{ color: ARC.text }}>ARC-AGI-3 event in Boston</a>.
            </p>
            <p className="mb-3">
              The poster is one chart: human first-play completion on one axis, agent
              completion on the other, per level, on the same tasks. Right now the agent
              half is measured and the human half is an assertion — which is exactly why
              every play here counts, and why we would rather you played something nobody
              has touched than the one at the top of the list.
            </p>
            <p style={{ color: ARC.faint }}>
              Anonymous gameplay events are recorded — inputs, timings, progress. No
              account, no personal data.
            </p>
          </div>
        </Section>

        <Section title="Related work">
          <div className="grid gap-3 sm:grid-cols-2">
            {RELATED.map((r) => (
              <a key={r.href} href={r.href} target="_blank" rel="noreferrer"
                 className="block p-4 transition-colors hover:border-[#E53AA3]"
                 style={{ background: ARC.cell, border: `1px solid ${ARC.border}` }}>
                <div className="text-[12px] mb-1" style={{ color: ARC.pink }}>{r.label} ↗</div>
                <div className="text-[11px] leading-[1.8]" style={{ color: ARC.dim }}>{r.note}</div>
              </a>
            ))}
          </div>
        </Section>

        <footer className="pt-2 text-[11px] leading-[2]" style={{ color: ARC.faint }}>
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
