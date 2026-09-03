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
         2026-09-03: no live frontier score appears in the prose. The hero asserts the
         GAP -- easy for a person, very hard for the best models -- because that survives
         the scores moving, and they move constantly. The 0.50% figure is cited once, in
         the footnote, scoped to the ARC-AGI-3 technical report (22-Apr-2026, Table 2), so
         it reads as a dated measurement rather than a current claim. Note the two ditches
         either side: an earlier draft said models "score zero", which is checkably wrong,
         and the draft after it welded 0.50% into the H1, which went stale in weeks.
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

/** Our own generation pipeline: 571 tasks, unreviewed, and the weakest thing on the site. */
const PIPELINE_CATEGORY = 'ai-generated';

/** The 50 reviewed tasks: agent-generated, then played and revised until they hold up.
 *  NOT hand-authored -- the copy used to say that and it was untrue. See the section
 *  labels in CommunityGallery.tsx, which this page has to agree with. */
const AUTHORED_CATEGORY = 'arena';

/**
 * Display order for every strip of tiles on this page.
 *
 * It used to be pipeline-first, on the reasoning that the generator's output is the set
 * actively growing and therefore the set to show. That was wrong twice over: it is also
 * the set we have the least confidence in, and this page is the first thing a visitor
 * sees. A landing page opening on 571 unreviewed tasks is advertising the slop.
 *
 * The reviewed set leads now, matching the gallery's section order and /play's queue.
 * Three surfaces, one answer about what is worth someone's time -- which is the whole
 * point, because a visitor who sees one task here and is handed a different one by Play
 * has been told the site does not know its own mind.
 */
function authoredFirst(games: Game[]): Game[] {
  const rank = (g: Game) =>
    g.category === AUTHORED_CATEGORY ? 0 : g.category === PIPELINE_CATEGORY ? 2 : 1;
  return [...games].sort((a, b) => rank(a) - rank(b));
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

/**
 * LIGHT. This page ran on the console's near-black palette, inherited from the play
 * surface where a dark ground is the right call -- it is a game screen and the frames are
 * saturated pixel art that needs somewhere quiet to sit. A landing page is not a game
 * screen. It is three paragraphs of argument and an ask, and dark chrome made it read as
 * a research console for people already inside the project rather than an invitation to
 * someone who has never heard of any of this.
 *
 * The task thumbnails keep their own dark cells, so the frames still sit on the ground
 * they were drawn for and the page's only saturated colour is the work itself.
 */
const ARC = {
  ground: '#FFFFFF', text: '#111111', dim: '#4A4A4A', faint: '#767676',
  cell: '#F6F5F4', border: '#E2E0DE', pink: '#C42F89', pinkAlt: '#A8256F',
  control: '#393736', green: '#2E8B1F', yellow: '#B8860B',
  /** The dark ground a task frame is drawn against, kept inside the tiles. */
  tile: '#141414',
};
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif";
const MONO = "'SF Mono', Menlo, Consolas, 'Courier New', monospace";

const LUMA = 'https://luma.com/z1h24dqe?tk=kddwGm';
/** The official ARC Prize server. Same invite the rest of this site already uses. */
const DISCORD = 'https://discord.gg/9b77dPAmcA';
/** Tufa Labs' duck harness -- what the competition entry is built on. Named wherever the
 *  leaderboard placing is: the lab that wrote it sits one place above us on that board. */
const DUCK_HARNESS = 'https://github.com/Tufalabs/duck-harness';
const REPORT = 'https://arcprize.org/media/ARC_AGI_3_Technical_Report.pdf';
const ARENA_REPO = 'https://github.com/sonpham-org/autoresearch-arena';
const ARENA_SITE = 'https://arc3.sonpham.net';

/**
 * Two links, both of which are other people's work on the same problem.
 *
 * What was here before: markbarney.net, voynichlabs.org and farm.markbarney.net, none of
 * which a visitor to an ARC-AGI-3 page has any use for -- and the farm one was captioned
 * "Kaggriculture, a farming-economy agent arena", which it is not. It is a hobby farm.
 * A related-work section that sends people to the author's chickens is not related work.
 */
const RELATED = [
  { href: ARENA_SITE, label: 'arc3.sonpham.net', note: "Son Pham's site — the research half of this programme: the task set, the agent harness, the run data" },
  { href: 'https://github.com/theredbluepill/arc-interactive', label: 'ARC-Interactive', note: "theredbluepill's community game repo — 252 of the tasks here are his, and it has 200+ more, tutorials, and a local human-play mode" },
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
             style={{ background: ARC.tile, border: `1px solid ${ARC.border}` }}>
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

  const ordered = useMemo(() => authoredFirst(games), [games]);

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
  const authoredCount = games.filter((g) => g.category === AUTHORED_CATEGORY).length;
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
                Easy for you. Very hard for the best AI in the world.
              </h1>
              {/* NO LIVE SCORE IN THIS COPY, AND DO NOT PUT ONE BACK.
                  The hero used to end on "the best AI in the world scores half a percent",
                  with 0.50% repeated in the second paragraph. Frontier scores move every
                  few weeks; a number welded into an H1 is a maintenance job nobody signed
                  up for, and it was already out of date. The durable claim is the GAP --
                  people work these out in minutes, frontier systems mostly do not -- which
                  stays true as the number moves and is the actual point of the page.
                  The number still exists, once, in the footnote below, where it is scoped
                  to a dated report. A citation to a dated source does not go stale; it
                  becomes history. An assertion in the present tense does.
                  Equally: do not swing to "models score zero". They do not, it is checkably
                  wrong, and an earlier draft of this page said it. */}
              <div className="text-[15px] leading-[1.75] space-y-4" style={{ color: ARC.dim }}>
                <p>
                  Open one and you get a screen, a few buttons, and no instructions. Nobody
                  tells you the goal, what the buttons do, or what the colours mean. You
                  press things, watch what changes, and work it out.{' '}
                  <strong style={{ color: ARC.text }}>Most people manage in a couple of minutes.</strong>
                </p>
                <p>
                  The systems that pass medical exams and write working software{' '}
                  <strong style={{ color: ARC.text }}>mostly cannot.</strong> On the official
                  ARC-AGI-3 environments a person gets through the set and the frontier
                  models get through almost none of it — a gap of nearly the whole
                  benchmark, not a few points. New results land constantly, so treat any
                  one figure as a snapshot; the one this page cites is below, with its date.
                </p>
                <p>
                  Exams reward recall. This rewards something else — looking at a thing you
                  have never seen and working out how it behaves. Nobody fully knows why
                  machines are so bad at it.
                </p>
              </div>
              {/* ── the one ask ────────────────────────────────────────────────
                It sits INSIDE the hero's left column, under the prose. It used to be a
                full-width band below the fold, which left a column of dead white space
                beside the twelve-tile grid -- the grid is taller than the three
                paragraphs -- and pushed the single thing this page asks of a visitor off
                the first screen. */}
              {needsCoverage && (
                <div className="mt-8 flex flex-col sm:flex-row gap-6 items-start p-6"
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
                      {unplayed} of {games.length} tasks here have no human attempt on record —
                      not one, ever. Until somebody tries, we cannot say whether this one is easy
                      for a person or quietly impossible, and a model's score on it means nothing
                      either way. You would be the first.
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
                      When you stop, the game asks what you made of it — that note is the most
                      useful thing you can leave us, and it tells you what the task actually was.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Real opening frames — the fastest way to convey what a task even is. */}
            {heroTiles.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {heroTiles.map((g) => (
                  <Link key={g.gameId} href={`/arc3/play/${g.gameId}`}>
                    <a className="relative aspect-square overflow-hidden block group"
                       style={{ background: ARC.tile, border: `1px solid ${ARC.border}` }}>
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

        {/*
          THE FOUR STAT CARDS THAT USED TO SIT HERE ARE GONE, AND SHOULD NOT COME BACK.
          They showed 100%, 0.50%, the task count and the unplayed count. Every one of the
          four restated a number from prose immediately above or below it: the first two
          were in the hero's second paragraph, in the same words, and the second two are the
          opening line of the ask, which now sits in the hero's left column. 0.50% has since
          come out of the prose entirely -- it lives in the dated footnote and nowhere else,
          which is NOT an opening to promote it back to a card. A frontier score on a card
          is a number this page would have to chase forever. A number is worth a card when it is the
          first place the reader meets it. Repeated a paragraph later in a bigger font it
          is decoration, and four of them in a row read as a dashboard bolted onto an
          argument. The citation stays, because that is load-bearing -- it is what makes
          the hero's claim checkable rather than asserted.
        */}
        <p className="text-[12px] mb-14 max-w-[76ch]" style={{ color: ARC.faint }}>
          The figures behind that, as measured at the benchmark's release and not since:
          humans 100%, best model 0.50% — Table 2 of the{' '}
          <a href={REPORT} target="_blank" rel="noreferrer" className="underline">
            ARC-AGI-3 technical report
          </a>{' '}
          (22 April 2026), best-of-four, semi-private set. Frontier models have been
          evaluated many times since and score better; none has closed the gap. For a
          current board, see the{' '}
          <a href="https://arcprize.org/leaderboard" target="_blank" rel="noreferrer" className="underline">
            ARC Prize leaderboard
          </a>.
        </p>

        {/* ── a look at the set ───────────────────────────────────────────── */}
        {previewTiles.length > 0 && (
          <Section title="What they look like" note={`${games.length} playable`}>
            <p className="text-[14px] leading-[1.75] mb-5 max-w-[70ch]" style={{ color: ARC.dim }}>
              Real ARC-AGI-3 environments on the official engine — the same screen and the
              same buttons an agent is given. These are their opening frames. That is all
              you get.
            </p>
            <p className="text-[13px] leading-[1.75] mb-5 max-w-[70ch]" style={{ color: ARC.faint }}>
              These are the <strong style={{ color: ARC.text }}>{authoredCount}</strong>{' '}
              reviewed ones — written by our agent, then played and sent back for revision
              until they hold up, six to eight levels each, and still being iterated.
              Behind them sit the 25 official ARC Prize tasks, a contributed community
              catalog, and <strong style={{ color: ARC.text }}>{pipelineCount}</strong>{' '}
              straight off the same generator that nobody has judged yet.
            </p>
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

        {/* ── come and talk to us ──────────────────────────────────────────── */}
        {/*
          THIS REPLACED A SECTION CALLED "WHERE THIS IS GOING", which was three paragraphs
          about a poster, a link to the research site, and a privacy note. It explained our
          plans to a reader who had not yet been given a reason to care about them.
          What this page actually wants is people to talk to. So: who we are, where we are
          on Sundays, and the door in. The poster is one line inside it rather than the
          reason for the section.
        */}
        <Section title="Come and talk to us">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
            <div className="p-6 text-[14px] leading-[1.8]"
                 style={{ background: ARC.cell, border: `1px solid ${ARC.border}`, color: ARC.dim }}>
              <p className="mb-4">
                Two people, spare time, no lab and no funding. On the ARC Prize 2026
                competition leaderboard we are currently{' '}
                <strong style={{ color: ARC.text }}>fifth</strong>.
              </p>
              {/* The harness credit is not a footnote and does not get separated from the
                  placing. Tufa Labs wrote it and sit one seat above us on the same board;
                  citing the placing without citing them would be taking credit for their
                  work. Same rule as the ARC-Interactive attribution. */}
              <p className="mb-4">
                That run is built on{' '}
                <a href={DUCK_HARNESS} target="_blank" rel="noreferrer" className="underline"
                   style={{ color: ARC.text }}>Tufa Labs' duck harness</a>, and Tufa Labs are
                fourth — one place ahead of us, on their own harness. It is an open
                competition and that is the point: everything we used is public.
              </p>
              <p className="mb-0">
                We are also taking a poster to the{' '}
                <a href={LUMA} target="_blank" rel="noreferrer" className="underline"
                   style={{ color: ARC.text }}>ARC Prize Research Summit in Boston</a>.
                One chart: how far people get on these tasks against how far the best
                agents get, on exactly the same tasks. The agent half is measured. The
                human half is whoever plays.
              </p>
            </div>

            <a href={DISCORD} target="_blank" rel="noreferrer"
               className="block p-6 transition-colors hover:opacity-90"
               style={{ background: ARC.cell, border: `2px solid ${ARC.pink}` }}>
              <div className="text-[11px] tracking-[2px] uppercase mb-2"
                   style={{ color: ARC.pink, fontFamily: MONO }}>Discord ↗</div>
              <p className="text-[14px] leading-[1.7] mb-3" style={{ color: ARC.text }}>
                The official ARC Prize server. Come and argue with us about any of this.
              </p>
              <p className="text-[13px] leading-[1.7]" style={{ color: ARC.dim }}>
                There is a community call <strong style={{ color: ARC.text }}>every
                Sunday</strong>. Open to anyone — competitors, sceptics, and people who
                have only just heard of ARC.
              </p>
            </a>
          </div>
          <p className="text-[12px] mt-4" style={{ color: ARC.faint }}>
            Anonymous gameplay events are recorded — inputs, timings, progress. No account,
            no personal data.
          </p>
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

        {/* NOT a third link to the gallery. The ask above offers "or pick your own" and the
            preview section ends with "Browse every task", both of which go there; a footer
            repeat made three on one page, plus Browse in the nav. A footer earns its place
            by reaching what the body does not. */}
        <footer className="pt-2 text-[12px] leading-[2]" style={{ color: ARC.faint }}>
          <Link href="/arc3/hypotheses"><a className="underline">Research: what a model guesses from one frame</a></Link>
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
