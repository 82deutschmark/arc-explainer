/*
Author: GPT-6 / Codex; Claude Opus 5.5 and earlier contributors
Date: 2026-10-07
PURPOSE: Landing page served as the root of arc3.markbarney.net. ONE audience: someone
         with no background who wants to know what we are doing and how the race is going.
         2026-10-07: distinguish visible notes from opaque reasoning state, credit ARC
         Prize's Astra analysis, and describe score gaps without claiming completion.

         ── 2026-10-05: THE PAGE LEADS WITH THE LEADERBOARD, NOT THE PRACTICE GAMES ─────

         Boss: we are not leaning on the synthetic games as much any more, and the Kaggle
         board is where the story is -- who is rocketing up, who is sinking, who is grinding
         up a step at a time. The page now opens on our live standing and a "this week on
         the leaderboard" section, all computed from the half-hourly board save
         (components/kaggleLeaderboard/storyData.ts) and never typed in, which is the
         only way leaderboard drama can live on a page with this one's history (below).
         The full board is at /kaggle-leaderboard. The harness section stays. The practice
         games drop to one small section near the bottom; the "play this one, then roast us"
         ask, the twelve-tile hero grid and the play-coverage counts are gone.
         KaggleStanding was replaced by OurStandingCard, which keeps its rules.

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
           either live and dated (see OurStandingCard) or it is cut (see the summit poster,
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
         - CONTRACTIONS THROUGHOUT. The voice is the one the hero opens in: "Two of us,
           working this in spare evenings with a Kaggle account." (Reworded 12-Sep-2026 --
           the earlier "no company, no lab, no funding... up against teams with actual
           money" version read as adversarial rather than just honest about scale; the
           point was never who we're up against.) Half this page used to be spoken and half
           written ("we cannot buy that", "it is our reading rather than anyone's finding"),
           and the seam is audible. If you would not say it to someone in a pub, cut it.

         Prose is set in a sans stack for readability; monospace is kept for chrome, ids
         and code, matching CommunityGallery and the official ARC-AGI-3 task pages.
         Steers play toward ZERO-PLAY tasks: coverage is the scarce resource, not tasks.
SRP/DRY check: Pass - leaderboard data, stories and the medal-race chart are the same
         modules the /kaggle-leaderboard page uses (useKaggleBoard, storyData, Storylines,
         MedalRaceChart); our placing is OurStandingCard; the Astra chart is HarnessGapChart.
         The practice-game strip reuses the mirror catalog + thumbnail endpoints that back
         the gallery. Palette moved to
         landingTheme.ts rather than copied a sixth time. Routing stays in App.tsx.
*/

import { publicGameId } from '@shared/arc3PublicIds';
import { useMemo, type CSSProperties } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AUTHORED_CATEGORY, PIPELINE_CATEGORY, visitorFacing } from '@/lib/arc3TaskSets';
import HarnessGapChart from '@/components/arc3/HarnessGapChart';
import OurStandingCard from '@/components/arc3/OurStandingCard';
import { ago, useKaggleBoard } from '@/components/kaggleLeaderboard/boardData';
import { MedalRaceChart } from '@/components/kaggleLeaderboard/MedalRaceChart';
import { HeadlineFacts, StoryGrid } from '@/components/kaggleLeaderboard/Storylines';
import { ASTRA_SOURCE, ENVS_WITH_GAP, ENV_TOTAL, WORST_ENV } from '@/data/astraHarnessGap';
import { ARC, SANS, MONO } from './landingTheme';

/** Mirrors MirroredGame in server/services/arc3Mirror/Arc3MirrorCatalog.ts.
 *  No title, description or tags by design -- see the gallery's no-spoiler note.
 *  `category` is an open string: upstream adds them and a closed union turns growth into breakage. */
interface Game {
  gameId: string;
  category: string;
}
interface GamesResponse {
  success: boolean;
  data: { games: Game[]; total: number };
}

/**
 * Reviewed tasks first, the generator's output last -- the gallery's order. Only the
 * visitor-facing allowlist is shown (05-Sep-2026, Son Pham: the raw pipeline set stays off
 * the front page); see arc3TaskSets.
 */
function practiceSet(games: Game[]): Game[] {
  const rank = (g: Game) => (g.category === AUTHORED_CATEGORY ? 0 : g.category === PIPELINE_CATEGORY ? 2 : 1);
  return [...visitorFacing(games)].sort((a, b) => rank(a) - rank(b));
}

/** The official ARC Prize server. Same invite the rest of this site already uses. */
const DISCORD = 'https://discord.gg/9b77dPAmcA';
/** Tufa Labs' duck harness -- what the competition entry is built on. Named wherever the
 *  placing is: taking credit for a run without naming the harness it rides on would be
 *  taking credit for their work. */
const DUCK_HARNESS = 'https://github.com/Tufalabs/duck-harness';
const ARENA_SITE = 'https://arc3.sonpham.net';

/* LUMA and REPORT were removed on 06-Sep-2026 with the sentences that used them; see the
 * header. Put a summit link back only when something is confirmed. */

/** Other people's work on the same problem. */
const RELATED = [
  { href: ARENA_SITE, label: 'arc3.sonpham.net', note: "Son Pham's site — the research half of this programme: the agent harness and the run data" },
  { href: 'https://github.com/theredbluepill/arc-interactive', label: 'ARC-Interactive', note: "theredbluepill's community game repo — 252 of the practice games here are his, and it has tutorials and a local human-play mode" },
  // What the model is allowed to keep and look up beats what it is told to do -- the same
  // finding as the harness section, reached independently, and worth linking because it is not us.
  { href: 'https://blog.alexisfox.dev/arcagi3', label: 'Hill-climbing ARC-AGI-3', note: "Alexis Fox, Junlin Wang, Paul Rosu and Bhuwan Dhingra (DukeNLP), March 2026 — an agent with only READ, GREP and Python over a raw log finished the three preview games in 1,069 actions against a human baseline of ~900" },
];

function thumb(gameId: string, size = 256) {
  return `/api/arc3-mirror/games/${encodeURIComponent(publicGameId(gameId))}/thumbnail?size=${size}`;
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
    <Link href={`/arc3/play/${publicGameId(game.gameId)}`} className="group block">
      <div className="relative aspect-square overflow-hidden"
           style={{ background: ARC.tile, border: `1px solid ${ARC.border}` }}>
        <img src={thumb(game.gameId, 128)} alt="" loading="lazy" decoding="async"
             className="w-full h-full opacity-90 group-hover:opacity-100 transition-opacity"
             style={{ imageRendering: 'pixelated', display: 'block' }} />
        <Scanlines />
      </div>
      <div className="flex items-center justify-between gap-2 px-2 py-1"
           style={{ background: alt ? ARC.pinkAlt : ARC.pink, fontFamily: MONO }}>
        <span className="text-[11px] tracking-[.55px] text-white truncate">{publicGameId(game.gameId)}</span>
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

/**
 * The shared leaderboard components draw "us" in the theme's --primary. On this page our
 * accent is the pink, so the leaderboard block re-points --primary at it rather than
 * letting a second blue accent onto a page that has one colour. .kaggle-lb supplies the
 * chart series colours, as on /kaggle-leaderboard.
 */
const BOARD_SCOPE = { '--primary': ARC.pink, '--foreground': ARC.text, '--muted-foreground': ARC.faint, '--border': ARC.border, '--card': ARC.ground } as CSSProperties;

export default function SyntheticLanding() {
  const board = useKaggleBoard();
  const { data } = useQuery<GamesResponse>({
    queryKey: ['/api/arc3-mirror/games'],
    staleTime: 5 * 60 * 1000,
  });
  const practice = useMemo(() => practiceSet(data?.data?.games ?? []), [data]);
  const strip = practice.slice(0, 12);
  const model = board.model;

  return (
    <div style={{ background: ARC.ground, color: ARC.text, minHeight: '100vh', fontFamily: SANS }}>
      <div className="max-w-[1080px] mx-auto px-5 py-12">

        {/* ── hero ─────────────────────────────────────────────────────────── */}
        <header className="mb-14">
          <p className="text-[11px] tracking-[3px] uppercase mb-5" style={{ color: ARC.pink, fontFamily: MONO }}>
            ARC Prize 2026 · ARC-AGI-3 on Kaggle
          </p>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start">
            <div>
              {/* KEEP THIS SHORT AND KEEP IT ABOUT US. Every long headline this page has had
                  was a claim about AI, and all of them expired -- see the header comment. */}
              <h1 className="text-[34px] sm:text-[44px] leading-[1.1] font-bold mb-6 tracking-[-0.5px]">
                We're doing ARC-AGI-3.
              </h1>
              <div className="text-[15px] leading-[1.75] space-y-4" style={{ color: ARC.dim }}>
                <p>Two of us, working this in spare evenings with a Kaggle account.</p>
                <p>
                  ARC-AGI-3 is a set of little games with no instructions. You get a screen, a
                  few buttons, and nothing else; you press things, watch what changes, and work
                  out the goal.{' '}
                  <strong style={{ color: ARC.text }}>Every official environment was solved by human testers.</strong>{' '}
                  The competition is to build an agent that does the same.
                </p>
                {/* No numbers in this paragraph: every figure about the race lives in the
                    live, dated blocks beside and below it. */}
                <p>
                  The public leaderboard updates all day, and it's a good show: teams appear
                  out of nowhere near the top, others drift down the moment they stop
                  submitting, and the medal lines keep moving. We save it every half hour and
                  keep score below.
                </p>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <Link
                  href="/kaggle-leaderboard"
                  className="inline-block px-6 h-[42px] leading-[42px] text-[13px] font-semibold tracking-[.5px] rounded-[4px]"
                  style={{ background: ARC.pink, color: '#fff' }}
                >
                  Full leaderboard →
                </Link>
                <Link href="/play" className="text-[13px] underline" style={{ color: ARC.dim }}>
                  or try a game yourself
                </Link>
              </div>
            </div>
            <OurStandingCard model={model} loading={board.isLoading} />
          </div>
        </header>

        {/* ── the race ─────────────────────────────────────────────────────── */}
        {model && (
          <Section title="This week on the leaderboard" note={`live · saved ${ago(model.latest.fetched)}`}>
            <div className="kaggle-lb" style={BOARD_SCOPE}>
              <HeadlineFacts model={model} />
              <div className="mt-8 mb-2 text-[13px]" style={{ color: ARC.dim }}>
                <strong style={{ color: ARC.text }}>The race for medals.</strong> Every team in
                the contested part of the board, best on the left. Shaded bands are the medal
                zones right now; hover to see who is where.
              </div>
              <MedalRaceChart model={model} />
              <div className="mt-10">
                <StoryGrid model={model} />
              </div>
              <p className="text-[13px] mt-8">
                <Link href="/kaggle-leaderboard" className="underline" style={{ color: ARC.dim }}>
                  Every team, the history, and a watch list of your own →
                </Link>
              </p>
            </div>
          </Section>
        )}
        {board.error && !model && (
          <p className="mb-16 text-[13px]" style={{ color: ARC.faint }}>
            The leaderboard didn't load just now.{' '}
            <Link href="/kaggle-leaderboard" className="underline">Try the full page</Link>.
          </p>
        )}

        {/* ── what we actually do ──────────────────────────────────────────── */}
        <Section title="What we're actually doing" note="harness engineering">
          <div className="text-[14px] leading-[1.8] space-y-4 mb-8 max-w-[74ch]" style={{ color: ARC.dim }}>
            <p>
              Our entry is built on{' '}
              <a href={DUCK_HARNESS} target="_blank" rel="noreferrer" className="underline"
                 style={{ color: ARC.text }}>Tufa Labs' duck harness</a> — an open harness
              written by people who are also competing. It is that kind of competition, and
              that is the good part of it.
            </p>
            <p style={{ color: ARC.faint }}>
              A harness is the scaffolding around the model: what it sees each turn, what it's
              allowed to remember, when it gets to stop and think. Not the model itself. It
              sounds like plumbing.
            </p>
          </div>

          <h3 className="text-[20px] font-bold mb-3 max-w-[70ch]">
            It turns out the plumbing can matter more than the model.
          </h3>
          <div className="text-[14px] leading-[1.8] space-y-4 mb-8 max-w-[74ch]" style={{ color: ARC.dim }}>
            {/* The date is not decoration: every measurement renders with the day it was
                published, sourced from the data file, never retyped here. */}
            <p>
              On {ASTRA_SOURCE.published} ARC Prize published a set of runs that made this
              unusually vivid. The same model played the same {ENV_TOTAL} public ARC-AGI-3
              environments under two harnesses, each at six reasoning settings. The Standard
              harness carries forward visible notes chosen by the model. The Provider Adapter
              also preserves opaque reasoning state between requests and uses compaction to
              manage longer conversations.
            </p>
            <p>
              On <strong style={{ color: ARC.text }}>{WORST_ENV.env}</strong>, the Standard
              harness never scored above{' '}
              <strong style={{ color: ARC.text }}>{(WORST_ENV.standard * 100).toFixed(1)}%</strong>{' '}
              across those six settings; the Provider Adapter reached 100%. Its best score
              was higher on {ENVS_WITH_GAP} of the {ENV_TOTAL} environments. These are
              action-efficiency scores, not completion percentages. The comparison shows
              that harness configuration matters, but does not isolate which feature caused
              each improvement.
            </p>
            <p>
              ARC Prize discusses these results in{' '}
              <a href="https://arcprize.org/blog/astra" target="_blank" rel="noreferrer" className="underline">
                its Astra analysis
              </a>
              , including why it reports both harnesses. Our interest is practical: how much
              better can an agent use the information it has already gathered? That is the
              bit we spend our evenings on.
            </p>
          </div>
          <HarnessGapChart />
        </Section>

        {/* ── practice games: demoted 2026-10-05, see header ─────────────────── */}
        {strip.length > 0 && (
          <Section title="Practice games" note={`${practice.length} playable`}>
            <p className="text-[14px] leading-[1.75] mb-5 max-w-[70ch]" style={{ color: ARC.dim }}>
              Along the way we built our own games in the same format, on the official engine,
              to practise on. They're all playable here: no account, nothing to install. If you
              play one, the box at the end is for telling us what was wrong with it.
            </p>
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(96px,1fr))]">
              {strip.map((g, i) => <Tile key={g.gameId} game={g} alt={i % 2 === 1} />)}
            </div>
            <p className="text-[13px] mt-5 flex flex-wrap gap-x-5">
              <Link href="/play" className="underline" style={{ color: ARC.dim }}>Give me one →</Link>
              <Link href="/arc3/gallery" className="underline" style={{ color: ARC.dim }}>Browse them all →</Link>
            </p>
          </Section>
        )}

        {/* ── come and talk to us ──────────────────────────────────────────── */}
        {/* The placing is NOT repeated here. It appears once, live and dated, in the hero.
            One number, one place, fetched. Do not restate it in prose anywhere. */}
        <Section title="Come and talk to us">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
            <div className="p-6 text-[14px] leading-[1.8]"
                 style={{ background: ARC.cell, border: `1px solid ${ARC.border}`, color: ARC.dim }}>
              <p className="mb-4">
                Everything here is public — the harness we build on, the competition, the
                leaderboard history, the games. If you think we're doing it wrong, you can see
                exactly how we're doing it wrong and say so.
              </p>
              <p className="mb-0">
                If you're on the leaderboard yourself and something here looks off about your
                team, tell us. We'd rather be corrected than quietly wrong.
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
            Anonymous gameplay events are recorded when you play a game — inputs, timings,
            progress. No account, no personal data.
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

        <footer className="pt-2 text-[12px] leading-[2]" style={{ color: ARC.faint }}>
          <Link href="/kaggle-leaderboard" className="underline">Kaggle leaderboard</Link>
          <span className="mx-2 opacity-50">·</span>
          <Link href="/arc3/hypotheses" className="underline">Research: what a model guesses from one frame</Link>
          <span className="mx-2 opacity-50">·</span>
          {/* Labelled as spoilers on purpose: /arc3 names mechanics of official games that
              are playable here, and a blind player must not wander into it. */}
          <Link href="/arc3" className="underline">Reference (spoilers)</Link>
          <span className="mx-2 opacity-50">·</span>
          <Link href="/home" className="underline">Resource Hub</Link>
        </footer>
      </div>
    </div>
  );
}
