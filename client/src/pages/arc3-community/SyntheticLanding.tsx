/*
Author: Claude Opus 5
Date: 2026-08-28 / 2026-08-30 / 2026-09-06 / 2026-09-07 (prose + the Play button)
PURPOSE: Landing page served as the root of arc3.markbarney.net. ONE audience: someone
         with no background who needs the idea in plain language and one game to try.

         2026-08-30: the researcher half of this page was removed. arc3.sonpham.net is
         now the source of truth for the synthetic programme -- it owns the catalog, the
         submissions, the harness and the run data -- and this site is the public,
         no-account play surface that mirrors it. Sections on how the set is generated,
         how to contribute a task, and how to consume the data belonged to the research
         side and were duplicating it here, months out of date. What remains is the pitch
         to a human being and the shortest path to playing.

         ── 2026-09-06: THE PAGE STOPPED MAKING CLAIMS ABOUT AI ─────────────────────────

         This page kept going out of date because it kept reaching for a thesis it never
         needed. Three drafts of the same mistake:

           1. "models score zero"        -- checkably wrong
           2. "the best model scores 0.50%" welded into the H1 -- stale in weeks
           3. "frontier models get through almost none of it" -- the GAP, asserted instead
              of the number, on the reasoning that a gap survives the number moving

         (3) is the one that had to die. On 02-Sep-2026 ARC Prize published GPT-6 Astra at
         99.9% on the ARC-AGI-3 semi-private set -- the same set the old footnote cited
         0.50% from. The gap was itself a number in disguise, and it closed.

         The fix is NOT a better thesis. It is no thesis. This is two people describing a
         hobby and asking for help with the part they cannot do alone. Nothing on this page
         now asserts anything about the state of machine intelligence, because nothing here
         needs to, and every version of that claim has expired within weeks.

         RULES, in descending order of how much pain each one has already caused:

         - NO FRONTIER SCORE IN BODY PROSE. Measurements live in dated, cited blocks with
           their source next to them. A citation to a dated source becomes history; an
           assertion in the present tense becomes wrong.
         - NO CLAIM THE PAGE CANNOT CHECK. If a hostile reader would look it up, it is
           either live and dated (see KaggleStanding) or it is cut (see the summit poster,
           removed 06-Sep-2026 -- it was never confirmed).
         - THE ASK IS ABOUT OUR OWN TASKS. "Is this set any good" is the one question no
           frontier release can settle and only our visitors can. It is also a better ask
           than the old one, which was only true until it wasn't.

         ── 2026-09-07: HOW THE SENTENCES ARE BUILT, NOT JUST WHAT THEY CLAIM ───────────

         The rules above got the claims right and left the prose unreadable. Reported as
         "a word salad of the previous paragraph". The worst offender is gone, but it had
         a shape, and the shape had spread to four more sentences on the page:

           "The systems that pass medical exams and write working software mostly cannot."

         A long noun-phrase subject that recaps the paragraph above it, and a verb stranded
         at the end as a bolded fragment. Three rules, all cheap to check by reading a
         sentence out loud:

         - THE SUBJECT DOES NOT RECAP THE PREVIOUS PARAGRAPH. If a sentence opens by
           re-describing what the reader just read, it has no room left to say anything.
         - THE SUBJECT DOES NOT CHANGE MID-SENTENCE. "Last round of notes got turned into
           a hit list and rewrote most of the set" -- the notes were turned into a list,
           then the notes rewrote the set. Name the actor: WE turned them into a list.
         - CONTRACTIONS THROUGHOUT. The voice is the one the hero opens in: "Two of us. No
           company, no lab, no funding." Half this page used to be spoken and half written
           ("we cannot buy that", "it is our reading rather than anyone's finding"), and
           the seam is audible. If you would not say it to someone in a pub, cut it.

         Prose is set in a sans stack for readability; monospace is kept for chrome, ids
         and code, matching CommunityGallery and the official ARC-AGI-3 task pages.
         Steers play toward ZERO-PLAY tasks: coverage is the scarce resource, not tasks.
SRP/DRY check: Pass - reuses the mirror catalog + thumbnail endpoints that back the
         gallery, and the existing human-stats aggregate. The leaderboard placing and the
         Astra chart are their own components (KaggleStanding, HarnessGapChart) because
         each owns a data source this page should not know about. Palette moved to
         landingTheme.ts rather than copied a sixth time. Routing stays in App.tsx.
*/

import { useMemo } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import KaggleStanding from '@/components/arc3/KaggleStanding';
import { PIPELINE_CATEGORY, AUTHORED_CATEGORY, visitorFacing } from '@/lib/arc3TaskSets';
import HarnessGapChart from '@/components/arc3/HarnessGapChart';
import { ASTRA_SOURCE, ENVS_WITH_GAP, ENV_TOTAL, WORST_ENV } from '@/data/astraHarnessGap';
import { ARC, SANS, MONO } from './landingTheme';

/** Mirrors MirroredGame in server/services/arc3Mirror/Arc3MirrorCatalog.ts.
 *  No title, description or tags by design -- see the gallery's no-spoiler note.
 *  `category` is an open string: upstream adds them (`ai-generated` arrived with 571
 *  games) and a closed union here turns growth into breakage. */
interface Game {
  gameId: string;
  category: string;
}


/**
 * Display order for every strip of tiles on this page.
 *
 * It used to be pipeline-first, on the reasoning that the generator's output is the set
 * actively growing and therefore the set to show. That was wrong twice over: it is also
 * the set we have the least confidence in, and this page is the first thing a visitor
 * sees. A landing page opening on 571 unreviewed tasks is advertising the slop.
 *
 * The reviewed set leads now, matching the gallery's section order. It does NOT match
 * /play's queue, which is unfiltered by design -- see frontPageSet. A visitor who sees one
 * task here and is handed a different one has been told the site does not know its own
 * mind, so the featured task links to its own id rather than re-resolving through /play.
 */
function authoredFirst(games: Game[]): Game[] {
  const rank = (g: Game) =>
    g.category === AUTHORED_CATEGORY ? 0 : g.category === PIPELINE_CATEGORY ? 2 : 1;
  return [...games].sort((a, b) => rank(a) - rank(b));
}

/**
 * The front page shows GLOW-UPS ONLY.
 *
 * 05-Sep-2026, Son Pham: "Fresh Off The Pipeline is a slop machine garbage of epic
 * proportion, hide them from main page for the time being. On the front page, we will
 * only accept games with at least one glow-up." Ordering the pipeline set last was not
 * enough -- it still supplied the featured task, which is the one thing this page asks a
 * visitor to do, and the review queue front is a pipeline task by construction.
 *
 * HIDDEN ON THIS PAGE AND THE GALLERY, NOWHERE DEEPER. The set stays fully playable and
 * fully reachable: /play's review queue still leads with it (that queue exists to judge
 * it) and the gallery's filter chip still opens it at full count. Same reasoning as
 * HIDDEN_FROM_BROWSE in CommunityGallery.tsx -- hiding is a presentation decision and
 * belongs at the presentation layer, never in the catalog that resolves sources and
 * thumbnails.
 *
 * KNOWN COST, ACCEPTED: this page and /play now offer different tasks. "One queue, one
 * answer" (see needsCoverage below) held while both surfaces wanted the same set; it
 * cannot hold once the front page refuses the set the queue exists to triage.
 *
 * TEMPORARY, and shaped to be reverted in one line: return `games`.
 */
function frontPageSet(games: Game[]): Game[] {
  return visitorFacing(games);
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

/* Palette, type stacks and the shared date format now live in ./landingTheme, imported
 * above -- see that file for why this page is light while the play surface is dark. */

/** The official ARC Prize server. Same invite the rest of this site already uses. */
const DISCORD = 'https://discord.gg/9b77dPAmcA';
/** Tufa Labs' duck harness -- what the competition entry is built on. Named wherever the
 *  placing is: taking credit for a run without naming the harness it rides on would be
 *  taking credit for their work. Same rule as the ARC-Interactive attribution below. */
const DUCK_HARNESS = 'https://github.com/Tufalabs/duck-harness';
const ARENA_SITE = 'https://arc3.sonpham.net';

/* LUMA (the ARC Prize Research Summit event page) was removed on 06-Sep-2026 along with
 * the sentence that used it: "We are also taking a poster to the ARC Prize Research Summit
 * in Boston." Nothing about that was settled -- the Luma page says registration is subject
 * to host approval and mentions no poster session, and the venue is MIT in Cambridge, not
 * Boston. Put it back when there is something confirmed to say, not before.
 *
 * REPORT (the 22-Apr-2026 ARC-AGI-3 technical report) went with the footnote that cited
 * its 0.50% figure. That citation was honest and correctly dated; what made it a liability
 * was the present-tense claim it propped up. See the header comment. */

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
  // The same finding as the harness section above, reached independently and six months
  // earlier: what the model is allowed to keep and look up beats what it is told to do.
  // Fox et al gave a coding agent nothing but READ, GREP and python over one uncompressed
  // log file and got within ~19% of the human action count -- and reported that ADDING
  // memory abstractions made it worse. Worth linking precisely because it is not us.
  { href: 'https://blog.alexisfox.dev/arcagi3', label: 'Hill-climbing ARC-AGI-3', note: "Alexis Fox, Junlin Wang, Paul Rosu and Bhuwan Dhingra (DukeNLP), March 2026 — an agent with only READ, GREP and Python over a raw log finished the three preview games in 1,069 actions against a human baseline of ~900" },
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
    <Link href={`/arc3/play/${game.gameId}`} className="group block">
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

  const ordered = useMemo(() => authoredFirst(frontPageSet(games)), [games]);

  /**
   * The task this page offers: first in the review queue that is visitor-facing and that
   * nobody has played.
   *
   * IT IS RESOLVED ONCE, HERE, AND LINKED TO BY ID. It used to render this task's
   * thumbnail and id and then point its button at bare /play, which threw the answer away
   * and re-resolved from the unfiltered queue -- so the page showed g026, said nobody had
   * ever played it, and handed over a pipeline task. Reported 07-Sep. Any surface that
   * shows a specific task links to /arc3/play/:id; /play is for "just give me something".
   *
   * The earlier note here claimed this must be the SAME task /play hands over. That parity
   * died on 05-Sep when frontPageSet started excluding the pipeline set and /play did not,
   * and frontPageSet's own docstring records it as a known cost. What was not accepted,
   * and was never true, is a button that does not go where the page says it goes.
   *
   * Falls back to the old random pick only when the queue is unavailable, so the ask never
   * disappears from the page.
   */
  const needsCoverage = useMemo(() => {
    const byId = new Map(ordered.map((g) => [g.gameId, g]));
    const queued = (review?.data?.games ?? []).map((g) => byId.get(g.gameId)).filter(Boolean);
    const front = queued.find((g) => !playedIds.has(g!.gameId)) ?? queued[0];
    if (front) return front;

    const never = ordered.filter((g) => !playedIds.has(g.gameId));
    const pool = never.length ? never : ordered;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }, [games, review, ordered, playedIds]);

  // A dozen real frames read as a body of work; four read as a sample. This is the
  // first thing a visitor sees, so it should look like the set it is -- and it should be
  // our set, not the official 25.
  const heroTiles = useMemo(() => ordered.slice(0, 12), [ordered]);

  const unplayed = ordered.filter((g) => !playedIds.has(g.gameId)).length;
  const authoredCount = ordered.filter((g) => g.category === AUTHORED_CATEGORY).length;
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
              {/* KEEP THIS SHORT AND KEEP IT ABOUT US. Every long headline this page has
                  had was a claim about AI, and all of them expired -- see the header
                  comment. It says what we are doing. That is all it has to do. */}
              <h1 className="text-[34px] sm:text-[44px] leading-[1.1] font-bold mb-6 tracking-[-0.5px]">
                We're doing ARC-AGI-3.
              </h1>
              <div className="text-[15px] leading-[1.75] space-y-4" style={{ color: ARC.dim }}>
                <p>
                  Two of us. No company, no lab, no funding — spare evenings and a Kaggle
                  account, up against teams with actual money.
                </p>
                <p>
                  ARC-AGI-3 is a set of little games with no instructions. Open one and you
                  get a screen, a few buttons, and nothing else. Nobody tells you the goal,
                  what the buttons do, or what the colours mean. You press things, watch what
                  changes, and work it out.{' '}
                  <strong style={{ color: ARC.text }}>Most people manage in a couple of minutes.</strong>
                </p>
                {/* THE ARGUMENT PARAGRAPH. It is about our method, not about how good AI
                    is -- see the 06-Sep block above for why that distinction is the whole
                    ballgame. "Unlike anything in the training data" is the benchmark's
                    stated design, not a capability claim, so it does not expire when the
                    next model lands. No count of tasks here: the real ones are 402 and 877
                    and both are on the page already, and "thousands" would be a number we
                    would have to defend. */}
                <p>
                  The point of the benchmark is that it's unlike anything in the training
                  data. So we make more of them — that's the boring answer to an
                  out-of-distribution problem: make enough and it isn't one. Then we
                  hill-climb the harness that plays them: change one thing, measure, keep it
                  or bin it. We're not solving AGI, we're making training data. We've played
                  ours, and{' '}
                  <strong style={{ color: ARC.text }}>a lot of it is slop</strong>. Want to
                  see? Want to help?
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
                  <Link href={`/arc3/play/${needsCoverage.gameId}`} className="shrink-0 w-[150px] group">
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
                    <h2 className="text-[20px] font-bold mb-3">Play this one. Then roast us.</h2>
                    <p className="text-[14px] leading-[1.75] mb-5" style={{ color: ARC.dim }}>
                      Nobody has ever played it, and nobody has played {unplayed} of the{' '}
                      {ordered.length} tasks here either. So we honestly don't know whether
                      this one is a decent puzzle, trivially easy, or quietly impossible.
                      You'd be the first person to find out.
                    </p>
                    <div className="flex flex-wrap items-center gap-4">
                      <Link
                        href={`/arc3/play/${needsCoverage.gameId}`}
                        className="inline-block px-6 h-[42px] leading-[42px] text-[13px] font-semibold tracking-[.5px] rounded-[4px]"
                        style={{ background: ARC.pink, color: '#fff' }}
                      >
                        Play it →
                      </Link>
                      <Link href="/arc3/gallery" className="text-[13px] underline"
                            style={{ color: ARC.dim }}>or pick your own</Link>
                    </div>
                    {/* The feedback box is the ask, not a courtesy. Said plainly, because the
                        previous copy called the note "the most useful thing you can leave us"
                        and then described it last, in the smallest type on the page. */}
                    <p className="text-[12px] leading-[1.7] mt-4" style={{ color: ARC.faint }}>
                      About five minutes. No account, nothing to install, no experience needed.
                      There is a box at the end — <strong style={{ color: ARC.dim }}>use it</strong>.
                      Tell us it was boring, that the controls did nothing, that it looks like
                      every other one, that you sat there ten minutes and never had a single
                      idea. Praise teaches us nothing. Last round we turned the notes into a hit
                      list and rewrote most of the set inside a week.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Real opening frames — the fastest way to convey what a task even is. */}
            {heroTiles.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {heroTiles.map((g) => (
                  <Link key={g.gameId} href={`/arc3/play/${g.gameId}`}
                        className="relative aspect-square overflow-hidden block group"
                        style={{ background: ARC.tile, border: `1px solid ${ARC.border}` }}>
                      <img src={thumb(g.gameId, 128)} alt="" loading="lazy"
                           className="w-full h-full opacity-85 group-hover:opacity-100 transition-opacity"
                           style={{ imageRendering: 'pixelated', display: 'block' }} />
                      <Scanlines />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </header>

        {/*
          THE FOUR STAT CARDS THAT USED TO SIT HERE ARE GONE, AND SHOULD NOT COME BACK.
          They showed 100%, 0.50%, the task count and the unplayed count. Every one of the
          four restated a number from prose immediately above or below it. A frontier score
          on a card is a number this page would have to chase forever; a number earns a card
          only where it is the first place the reader meets it. Repeated a paragraph later
          in a bigger font it is decoration, and four in a row read as a dashboard bolted
          onto an argument.

          THE DATED FOOTNOTE THAT REPLACED THEM IS ALSO GONE (06-Sep-2026). It cited humans
          100% / best model 0.50% from the 22-Apr-2026 technical report, and said "none has
          closed the gap". By the time anyone read that sentence it was false: GPT-6 Astra,
          02-Sep-2026, 99.9% on the same semi-private set. The citation itself was fine --
          correctly dated, correctly scoped. What killed it was the present-tense claim it
          existed to support. It is not replaced by a newer score. It is replaced by the
          section below, which is about what we do rather than about how good AI is.
        */}
        <div className="mb-14 h-px" style={{ background: ARC.border }} />

        {/* ── what we actually do ──────────────────────────────────────────── */}
        <Section title="What we're actually doing" note="harness engineering">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-start mb-10">
            <div>
              <p className="text-[14px] leading-[1.8] mb-4" style={{ color: ARC.dim }}>
                We enter the ARC Prize 2026 competition on Kaggle. Our run is built on{' '}
                <a href={DUCK_HARNESS} target="_blank" rel="noreferrer" className="underline"
                   style={{ color: ARC.text }}>Tufa Labs' duck harness</a> — an open harness
                written by people who are also competing. It is that kind of competition, and
                that is the good part of it.
              </p>
              <p className="text-[13px] leading-[1.8]" style={{ color: ARC.faint }}>
                A harness is the scaffolding around the model: what it sees each turn, what
                it's allowed to remember, when it gets to stop and think. Not the model itself.
                It sounds like plumbing.
              </p>
            </div>
            {/* Live, dated, and never asserted from memory -- this is the number a sceptical
                reader checks first, and until today the page got it wrong. */}
            <KaggleStanding />
          </div>

          <h3 className="text-[20px] font-bold mb-3 max-w-[70ch]">
            It turns out the plumbing can matter more than the model.
          </h3>
          <div className="text-[14px] leading-[1.8] space-y-4 mb-8 max-w-[74ch]"
               style={{ color: ARC.dim }}>
            {/* The date is not decoration. Every measurement on this page renders with the
                day it was published, so a reader can see at a glance how old the claim is
                instead of taking "recently" on trust -- and so it ages into history rather
                than into a lie. Sourced from the data file, never retyped here. */}
            <p>
              On {ASTRA_SOURCE.published} ARC Prize published a set of runs that made this
              unusually vivid. The same model was pointed at the same {ENV_TOTAL} ARC-AGI-3
              environments twice. The only thing that changed between the two was the
              harness — whether the model's own working state was carried from one request
              to the next, or thrown away and rebuilt each turn.
            </p>
            <p>
              On <strong style={{ color: ARC.text }}>{WORST_ENV.env}</strong>, the throw-it-away
              path never got above{' '}
              <strong style={{ color: ARC.text }}>
                {(WORST_ENV.standard * 100).toFixed(1)}%
              </strong>{' '}
              — not at any of the six reasoning settings, including the most expensive one.
              Let it keep its state, and it solves the environment. Same weights, same
              puzzle. Turning up the thinking did nothing; letting it remember did
              everything. That pattern holds on {ENVS_WITH_GAP} of the {ENV_TOTAL}.
            </p>
            <p>
              We think that's the most interesting thing published about this benchmark all
              year. That's our reading, not anyone's finding — ARC Prize put the numbers up
              and said nothing about what they meant. It's also, more selfishly, the bit we
              spend our evenings on.
            </p>
          </div>
          <HarnessGapChart />
        </Section>

        {/* ── a look at the set ───────────────────────────────────────────── */}
        {previewTiles.length > 0 && (
          <Section title="What they look like" note={`${ordered.length} playable`}>
            <p className="text-[14px] leading-[1.75] mb-5 max-w-[70ch]" style={{ color: ARC.dim }}>
              Real ARC-AGI-3 environments on the official engine — the same screen and the
              same buttons an agent is given. These are their opening frames. That is all
              you get.
            </p>
            <p className="text-[13px] leading-[1.75] mb-5 max-w-[70ch]" style={{ color: ARC.faint }}>
              These are the <strong style={{ color: ARC.text }}>{authoredCount}</strong>{' '}
              reviewed ones — written by our agent, then played and sent back for revision
              until they hold up, six to eight levels each, and still being iterated.
              Behind them sit the 25 official ARC Prize tasks and a contributed community
              catalog.
            </p>
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(112px,1fr))]">
              {previewTiles.map((g, i) => <Tile key={g.gameId} game={g} alt={i % 2 === 1} />)}
            </div>
            <p className="text-[13px] mt-5">
              <Link href="/arc3/gallery" className="underline" style={{ color: ARC.dim }}>
                Browse every task →
              </Link>
            </p>
          </Section>
        )}

        {/* ── come and talk to us ──────────────────────────────────────────── */}
        {/*
          THIS REPLACED A SECTION CALLED "WHERE THIS IS GOING", which was three paragraphs
          about a poster, a link to the research site, and a privacy note. It explained our
          plans to a reader who had not yet been given a reason to care about them.
          What this page actually wants is people to talk to. So: who we are, where we are
          on Sundays, and the door in.
          2026-09-06: the poster line that used to close it was cut (never confirmed), and
          the leaderboard placing moved out of here into a live component further up. What
          is left is the invitation, which is what the section was for.
        */}
        <Section title="Come and talk to us">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
            {/* THE PLACING IS NOT REPEATED HERE. It used to be -- "we are currently fifth",
                hard-coded, three weeks out of date by the time anyone read it, sitting
                beside a sentence naming the team one place ahead which had ALSO gone wrong.
                It now appears once, live and dated, in "What we're actually doing" above.
                One number, one place, fetched. Do not restate it in prose anywhere.

                THE POSTER SENTENCE IS GONE (06-Sep-2026): "We are also taking a poster to
                the ARC Prize Research Summit in Boston." None of it was settled. Say
                something here when there is something confirmed to say. */}
            <div className="p-6 text-[14px] leading-[1.8]"
                 style={{ background: ARC.cell, border: `1px solid ${ARC.border}`, color: ARC.dim }}>
              <p className="mb-4">
                Everything here is public — the harness we build on, the competition, the
                task set, the replays. If you think we're doing it wrong, you can see exactly
                how we're doing it wrong and say so.
              </p>
              <p className="mb-0">
                The most useful thing you can give us is five minutes on one of the tasks and
                two sentences afterwards. It's the one thing here we can't generate more of.
                That's the entire reason this page exists.
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
          <Link href="/arc3/hypotheses" className="underline">Research: what a model guesses from one frame</Link>
          <span className="mx-2 opacity-50">·</span>
          {/* Labelled as spoilers on purpose. /arc3 names the mechanic of six official
              games and links to full write-ups, and five of those six are playable here.
              A blind player must not be able to wander into it from a bare "reference". */}
          <Link href="/arc3" className="underline">Reference (spoilers)</Link>
          <span className="mx-2 opacity-50">·</span>
          <Link href="/home" className="underline">ARC Explainer</Link>
        </footer>
      </div>
    </div>
  );
}
