/*
Author: Claude Opus 5
Date: 2026-08-28 / 2026-08-30
PURPOSE: Landing page served as the root of arc3.markbarney.net. ONE audience: someone
         with no background who needs the idea in plain language and one game to try.

         2026-08-30: the researcher half of this page was removed. arc3.sonpham.net is
         now the source of truth for the synthetic programme -- it owns the catalog, the
         submissions, the harness and the run data -- and this site is the public,
         no-account play surface that mirrors it to collect a human baseline. Sections on
         how the set is generated, how to contribute a task, and how to consume the data
         belonged to the research side and were duplicating it here, months out of date.
         What remains is the pitch to a human being and the shortest path to playing.
         Numbers are cited from the ARC-AGI-3 technical report (22-Apr-2026) rather than
         asserted -- humans 100%, best frontier model 0.50% (Table 2). An earlier draft
         said models "score zero", which is wrong and would not survive a poster session.
         Prose is set in a sans stack for readability; monospace is kept for chrome, ids
         and code, matching CommunityGallery and the official ARC-AGI-3 task pages.
         Steers play toward ZERO-PLAY tasks: coverage is the scarce resource, not tasks.
SRP/DRY check: Pass - reuses the mirror catalog + thumbnail endpoints that back the
         gallery, and the existing human-stats aggregate; no new data plumbing. Routing
         stays in App.tsx.
*/

import { useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';

/** Mirrors MirroredGame in server/services/arc3Mirror/Arc3MirrorCatalog.ts.
 *  No title, description or tags by design -- see the gallery's no-spoiler note.
 *  `category` is an open string: upstream adds them (`ai-generated` arrived with 571
 *  games) and a closed union here turns growth into breakage. */
interface Game {
  gameId: string;
  category: string;
}

/** Our own generation pipeline. This is the set actively growing, and the reason the
 *  programme exists -- so it leads here the same way it leads the gallery, rather than
 *  the page opening on the 25 famous tasks we did not make. */
const PIPELINE_CATEGORY = 'ai-generated';

/** Pipeline tasks first, everything else after, original order preserved within each. */
function pipelineFirst(games: Game[]): Game[] {
  return [
    ...games.filter((g) => g.category === PIPELINE_CATEGORY),
    ...games.filter((g) => g.category !== PIPELINE_CATEGORY),
  ];
}
interface GamesResponse {
  success: boolean;
  data: { games: Game[]; total: number };
}
/** Aggregate first-blind-attempt rows, one per task that has ever been played. */
interface HumanStatsResponse {
  success: boolean;
  data: { games: { game_id: string; first_sessions: number }[] };
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
  { href: ARENA_SITE, label: 'arc3.sonpham.net', note: 'The research side — the task set itself, the agent harness, leaderboards' },
  { href: 'https://markbarney.net', label: 'markbarney.net', note: 'Everything else' },
  { href: 'https://farm.markbarney.net', label: 'farm.markbarney.net', note: 'Kaggriculture — a farming-economy agent arena' },
  { href: 'https://voynichlabs.org', label: 'voynichlabs.org', note: 'Voynich Labs' },
];

function thumb(gameId: string, size = 256) {
  return `/api/arc3-mirror/games/${encodeURIComponent(gameId)}/thumbnail?size=${size}`;
}

function Scanlines() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{
      backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0) 0 2px, rgba(0,0,0,.38) 2px 4px)',
    }} />
  );
}

function Tile({ game, alt }: { game: Game; alt: boolean }) {
  /* Id only. The mirror strips names before they reach the browser. */
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
    queryKey: ['/api/arc3-mirror/games'],
    staleTime: 5 * 60 * 1000,
  });
  // Coverage now comes from the telemetry aggregate rather than a play_count column on
  // a catalog row: the catalog is mirrored and read-only, so it cannot carry our counts.
  const { data: stats } = useQuery<HumanStatsResponse>({
    queryKey: ['/api/arc3-play/human-stats'],
    staleTime: 60 * 1000,
  });
  /** The review queue, so the task shown here is the task /play actually hands over. */
  const { data: review } = useQuery<{ data: { games: { gameId: string }[] } }>({
    queryKey: ['/api/arc3-mirror/review-queue'],
    staleTime: 60 * 60 * 1000,
  });

  const games = useMemo(() => data?.data?.games ?? [], [data]);
  const playedIds = useMemo(
    () => new Set((stats?.data?.games ?? []).map((g) => g.game_id)),
    [stats],
  );

  const ordered = useMemo(() => pipelineFirst(games), [games]);

  /**
   * The task this page offers — which must be the SAME task /play hands over, resolved by
   * the same rule: first in the review queue that nobody has played.
   *
   * It used to pick at random from the unplayed pipeline set, which made this page a third
   * competing opinion about where to start, alongside the nav and the gallery. A visitor
   * could see one task here, click Play in the nav and be given another, and the tile they
   * had just decided to try was gone. One queue, one answer, everywhere.
   *
   * Falls back to the old random pick only when the queue is unavailable, so the ask never
   * disappears from the page.
   */
  const needsCoverage = useMemo(() => {
    const byId = new Map(games.map((g) => [g.gameId, g]));
    const queued = (review?.data?.games ?? []).map((g) => byId.get(g.gameId)).filter(Boolean);
    const front = queued.find((g) => !playedIds.has(g!.gameId)) ?? queued[0];
    if (front) return front;

    const never = ordered.filter((g) => !playedIds.has(g.gameId));
    const neverPipeline = never.filter((g) => g.category === PIPELINE_CATEGORY);
    const pool = neverPipeline.length ? neverPipeline : never.length ? never : ordered;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }, [games, review, ordered, playedIds]);

  // A dozen real frames read as a body of work; four read as a sample. This is the
  // first thing a visitor sees, so it should look like the set it is -- and it should be
  // our set, not the official 25.
  const heroTiles = useMemo(() => ordered.slice(0, 12), [ordered]);

  const unplayed = games.filter((g) => !playedIds.has(g.gameId)).length;
  const pipelineCount = games.filter((g) => g.category === PIPELINE_CATEGORY).length;
  // A strip of real frames, not a full catalog dump -- browsing lives in the gallery.
  const previewTiles = useMemo(() => ordered.slice(0, 24), [ordered]);

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
            <Link href="/play" className="shrink-0 w-[150px] group">
                <div className="relative aspect-square overflow-hidden"
                     style={{ border: `1px solid ${ARC.border}` }}>
                  <img src={thumb(needsCoverage.gameId)} alt=""
                       className="w-full h-full" style={{ imageRendering: 'pixelated', display: 'block' }} />
                  <Scanlines />
                </div>
                <div className="px-2 py-1 text-[11px] tracking-[.55px] text-white"
                     style={{ background: ARC.pink, fontFamily: MONO }}>{needsCoverage.gameId}</div>
            </Link>
            <div className="min-w-0">
              <h2 className="text-[20px] font-bold mb-3">Nobody has ever played this one.</h2>
              <p className="text-[14px] leading-[1.75] mb-5" style={{ color: ARC.dim }}>
                {unplayed} of {games.length} tasks here have no human attempt on record — not
                one, ever. Most of them came off our generator in the last few days and no
                person has seen them at all. Until somebody tries, we cannot say whether this
                one is easy for a person or quietly impossible, which means a model's score on
                it means nothing either. You would be the first.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/play"
                  className="inline-block px-6 h-[42px] leading-[42px] text-[13px] font-semibold tracking-[.5px] rounded-[4px]"
                  style={{ background: ARC.pink, color: '#fff' }}
                >
                  Play it →
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

        {/* ── a look at the set ───────────────────────────────────────────── */}
        {previewTiles.length > 0 && (
          <Section title="What they look like" note={`${games.length} playable`}>
            <p className="text-[14px] leading-[1.75] mb-5 max-w-[70ch]" style={{ color: ARC.dim }}>
              Every one of these is a real ARC-AGI-3 environment running on the official
              engine — the same thing an AI agent is given, with the same screen and the
              same buttons. These are their opening frames. That is all you get.
            </p>
            {pipelineCount > 0 && (
              <p className="text-[13px] leading-[1.75] mb-5 max-w-[70ch]" style={{ color: ARC.faint }}>
                Shown newest first, so these are mostly the{' '}
                <strong style={{ color: ARC.text }}>{pipelineCount}</strong> tasks our own
                generator has produced — the set that is still growing. The 25 official ARC
                Prize tasks are in there too, further down{' '}
                <Link href="/arc3/gallery"><a className="underline">the gallery</a></Link>.
              </p>
            )}
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(112px,1fr))]">
              {previewTiles.map((g, i) => <Tile key={g.gameId} game={g} alt={i % 2 === 1} />)}
            </div>
            <p className="text-[13px] mt-5">
              <Link href="/arc3/gallery"><a className="underline" style={{ color: ARC.dim }}>
                Browse every task →
              </a></Link>
            </p>
          </Section>
        )}

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
              The poster is one chart: how far people get on these tasks, against how far
              the best AI agents get, on exactly the same tasks. The AI half is measured
              already. The human half is you. That is the entire reason this site exists,
              and it is why we would rather you played something nobody has touched than
              whatever happens to be at the top of the list.
            </p>
            <p className="mb-4">
              If you want the research side — how the tasks are generated, the agent
              harness, the run data, or how to contribute a task — that all lives at{' '}
              <a href={ARENA_SITE} target="_blank" rel="noreferrer" className="underline"
                 style={{ color: ARC.text }}>arc3.sonpham.net</a>, which is the source of
              truth for the programme. This site just lets people play them.
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
          {/* Labelled as spoilers on purpose. /arc3 names the mechanic of six official
              games and links to full write-ups, and five of those six are playable here.
              A blind player must not be able to wander into it from a bare "reference". */}
          <Link href="/arc3"><a className="underline">Reference (spoilers)</a></Link>
          <span className="mx-2 opacity-50">·</span>
          <Link href="/home"><a className="underline">ARC Explainer</a></Link>
        </footer>
      </div>
    </div>
  );
}
