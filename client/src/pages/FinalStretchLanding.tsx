/*
Author: Claude Opus 5.5 Medium
Date: 2026-10-16
PURPOSE: The site's front page ("/") for the last weeks of ARC Prize 2026. Boss, 16-Oct-2026:
         "it's not about the synthetic games anymore. We're getting to the last month of the
         competition." The page is about one thing, the race ending:

           1. A live clock to the close, read from the one registry entry (closeAt in
              shared/kaggleCompetitions.ts). Both Kaggle boards share the deadline. Once it
              passes, the clock is replaced by a plain line saying the boards are closed and
              medals come from the private board, so the page never sits at "0 days".
           2. The ARC-AGI-3 medal race, the same live components /kaggle-leaderboard uses
              (HeadlineFacts, MedalRaceChart, StoryGrid), all computed from the half-hourly
              board save.
           3. The newest ARC Daily wire stories, from the same /api/news archive the
              newspaper reads, drawn in this page's own style (the newspaper's stylesheet
              belongs to the newspaper routes).
           4. Our own placing as a small side box (OurStandingCard, compact). The race is the
              story; we are one team in it.

         The previous front page (SyntheticLanding) stays at /synthetic, so the harness essay,
         the Astra harness chart and the practice games keep a home and a link from here.

         RULES CARRIED OVER from SyntheticLanding's header, each one paid for by a page that
         went stale. Read that header before adding a sentence here:
         - No claim about where AI stands, and no frontier score in body prose. A countdown
           hero invites a thesis sentence ("can anyone crack it in time?"); don't write one.
         - Every figure is live and dated, or it's cut. Nothing about the race is typed in.
         - "Public leaderboard", always. Medals are settled on the private board.
         - Contractions, plain spoken sentences, and the subject doesn't recap the paragraph
           above it.
SRP/DRY check: Pass - page composition only. Close time: closeMs/daysToClose in
         shared/kaggleCompetitions.ts (the newspaper masthead and board tiles read the same
         helpers). Board: useKaggleBoard + kaggleLeaderboard components. Wire: useNews,
         sortedWire and filedAt from the news components. Palette: landingTheme.
*/

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'wouter';
import { KAGGLE_COMPETITIONS, closeMs } from '@shared/kaggleCompetitions';
import { competitionName, wirePath, type NewsWireStory } from '@shared/news';
import OurStandingCard from '@/components/arc3/OurStandingCard';
import { ago, useKaggleBoard } from '@/components/kaggleLeaderboard/boardData';
import { MedalRaceChart } from '@/components/kaggleLeaderboard/MedalRaceChart';
import { HeadlineFacts, StoryGrid } from '@/components/kaggleLeaderboard/Storylines';
import { useNews } from '@/components/news/NewsDesk';
import { filedAt, sortedWire } from '@/components/news/NewsWire';
import { ARC, MONO, SANS } from './arc3-community/landingTheme';

/** The official ARC Prize server, the same invite the rest of the site uses. */
const DISCORD = 'https://discord.gg/9b77dPAmcA';
const ARC3 = KAGGLE_COMPETITIONS['arc-3'];
const DAY = 86_400_000;
/** Wire stories filed within this window count as "today"; fewer than MIN_WIRE tops up with older ones. */
const TODAY_MS = DAY;
const MIN_WIRE = 4;
const MAX_WIRE = 6;

/** Same re-pointing SyntheticLanding does: the shared board components draw "us" in --primary. */
const BOARD_SCOPE = { '--primary': ARC.pink, '--foreground': ARC.text, '--muted-foreground': ARC.faint, '--border': ARC.border, '--card': ARC.ground } as CSSProperties;

/** "Monday, November 2 at 11:59 pm" in UTC and in Eastern (the newspaper's zone), plus the bare day. */
function closeWords(close: number): { utc: string; eastern: string; day: string } {
  const say = (timeZone: string) => new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    .format(new Date(close)).replace(' AM', ' am').replace(' PM', ' pm');
  // After the close the sentence is history, so it names the day only ("closed on November 2").
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric' }).format(new Date(close));
  return { utc: say('UTC'), eastern: say('America/New_York'), day };
}

/** Ticks once a second while the page is open. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[44px] sm:text-[64px] font-bold leading-none tabular-nums tracking-[-1px]"
           style={{ color: ARC.text, fontFamily: MONO }}>{String(value).padStart(2, '0')}</div>
      <div className="mt-2 text-[11px] uppercase tracking-[2px]" style={{ color: ARC.faint, fontFamily: MONO }}>{label}</div>
    </div>
  );
}

function Countdown() {
  const now = useNow();
  const close = closeMs(ARC3);
  if (close == null) return null;
  const words = closeWords(close);
  const left = close - now;

  if (left <= 0) {
    return (
      <div className="p-6" style={{ background: ARC.cell, border: `2px solid ${ARC.pink}` }}>
        <div className="mb-3 text-[11px] uppercase tracking-[2px]" style={{ color: ARC.pink, fontFamily: MONO }}>The boards are closed</div>
        <p className="text-[15px] leading-[1.7]" style={{ color: ARC.dim }}>
          Both Kaggle boards closed on {words.day}. The standings below are the public
          board's last save. Medals are decided on the private board, not this one.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6" style={{ background: ARC.cell, border: `2px solid ${ARC.pink}` }}>
      <div className="mb-4 text-[11px] uppercase tracking-[2px]" style={{ color: ARC.pink, fontFamily: MONO }}>Until the close</div>
      <div className="grid grid-cols-4 gap-3" role="timer" aria-live="off">
        <Unit value={Math.floor(left / DAY)} label="days" />
        <Unit value={Math.floor(left / 3_600_000) % 24} label="hours" />
        <Unit value={Math.floor(left / 60_000) % 60} label="min" />
        <Unit value={Math.floor(left / 1000) % 60} label="sec" />
      </div>
      <p className="mt-5 text-[13px] leading-[1.7]" style={{ color: ARC.dim }}>
        Both boards, ARC-AGI-3 and ARC-AGI-2, close {words.utc} UTC
        ({words.eastern} Eastern).
      </p>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mb-14">
      <div className="flex flex-wrap items-baseline gap-x-3 mb-5 pb-2" style={{ borderBottom: `1px solid ${ARC.border}` }}>
        <h2 className="text-[11px] tracking-[2.5px] uppercase" style={{ color: ARC.text, fontFamily: MONO }}>{title}</h2>
        {note && <span className="text-[11px]" style={{ color: ARC.faint, fontFamily: MONO }}>{note}</span>}
      </div>
      {children}
    </section>
  );
}

/** Today's stories, topped up with the newest older ones when the desk has filed few. */
function pickWire(stories: NewsWireStory[], now: number): { stories: NewsWireStory[]; today: boolean } {
  const sorted = sortedWire(stories);
  const today = sorted.filter((s) => now - Date.parse(s.publishedAt) < TODAY_MS);
  return today.length >= MIN_WIRE
    ? { stories: today.slice(0, MAX_WIRE), today: true }
    : { stories: sorted.slice(0, MIN_WIRE), today: false };
}

function WireColumn() {
  const news = useNews();
  if (news.isLoading) return <div className="h-[320px] animate-pulse" style={{ background: ARC.cell }} />;
  const picked = pickWire(news.data?.wire ?? [], Date.now());
  if (!picked.stories.length) return null;
  return (
    <div>
      <div className="mb-3 pb-2 text-[11px] uppercase tracking-[2px]" style={{ color: ARC.pink, fontFamily: MONO, borderBottom: `1px solid ${ARC.border}` }}>
        {picked.today ? 'Today on the wire' : 'Latest from the wire'}
      </div>
      {picked.stories.map((story) => (
        <article key={story.id} className="py-3" style={{ borderBottom: `1px solid ${ARC.border}` }}>
          <div className="text-[10.5px] uppercase tracking-[1px]" style={{ color: ARC.faint, fontFamily: MONO }}>
            <b style={{ color: ARC.text }}>{competitionName(story.competition)}</b> · {filedAt(story.publishedAt)}
          </div>
          <h3 className="mt-1 text-[15px] font-bold leading-[1.3]">
            <Link href={wirePath(story.id)} className="hover:underline" style={{ color: ARC.text }}>{story.headline}</Link>
          </h3>
          {story.sections[0] && (
            <p className="mt-1 text-[13px] leading-[1.55] line-clamp-3" style={{ color: ARC.dim }}>{story.sections[0].text}</p>
          )}
        </article>
      ))}
      <p className="mt-3 text-[13px] flex flex-wrap gap-x-4">
        <Link href="/news/wire" className="underline" style={{ color: ARC.dim }}>The full wire →</Link>
        <Link href="/news" className="underline" style={{ color: ARC.dim }}>The ARC Daily Digest →</Link>
      </p>
    </div>
  );
}

export default function FinalStretchLanding() {
  const board = useKaggleBoard();
  const model = board.model;

  return (
    <div style={{ background: ARC.ground, color: ARC.text, minHeight: '100vh', fontFamily: SANS }}>
      <div className="max-w-[1180px] mx-auto px-4 sm:px-5 py-10 sm:py-12">

        {/* ── hero: the clock ───────────────────────────────────────────────── */}
        <header className="mb-14 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] items-start">
          <div>
            <p className="text-[11px] tracking-[3px] uppercase mb-5" style={{ color: ARC.pink, fontFamily: MONO }}>
              ARC Prize 2026 · the final stretch
            </p>
            {/* No thesis about AI in the headline. See the header comment. */}
            <h1 className="text-[34px] sm:text-[44px] leading-[1.1] font-bold mb-6 tracking-[-0.5px]">
              The last weeks of ARC Prize.
            </h1>
            <div className="text-[15px] leading-[1.75] space-y-4" style={{ color: ARC.dim }}>
              <p>
                Teams on Kaggle are building agents for ARC-AGI-3, little games with no
                instructions, and solvers for ARC-AGI-2's grid puzzles. Both boards close on the
                same night.
              </p>
              <p>
                We save the public leaderboard every half hour and keep score here: who's
                climbing, who's slipping, and where the medal lines sit right now.
              </p>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link href="/kaggle-leaderboard"
                    className="inline-block px-6 h-[42px] leading-[42px] text-[13px] font-semibold tracking-[.5px] rounded-[4px]"
                    style={{ background: ARC.pink, color: '#fff' }}>
                ARC-AGI-3 board →
              </Link>
              <Link href="/kaggle-leaderboard/arc-2" className="text-[13px] underline" style={{ color: ARC.dim }}>ARC-AGI-2 board</Link>
              <Link href="/news" className="text-[13px] underline" style={{ color: ARC.dim }}>The ARC Daily Digest</Link>
            </div>
          </div>
          <Countdown />
        </header>

        {/* ── the race, with the wire and our box beside it ──────────────────── */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
          <main className="min-w-0">
            {model && (
              <Section title="The race for medals" note={`ARC-AGI-3 public board · saved ${ago(model.latest.fetched)}`}>
                <div className="kaggle-lb" style={BOARD_SCOPE}>
                  <HeadlineFacts model={model} />
                  <div className="mt-8 mb-2 text-[13px]" style={{ color: ARC.dim }}>
                    Every team in the contested part of the board, best on the left. Shaded bands
                    are the medal zones right now; hover to see who's where.
                  </div>
                  <MedalRaceChart model={model} />
                  <div className="mt-10"><StoryGrid model={model} /></div>
                  <p className="text-[13px] mt-8">
                    <Link href="/kaggle-leaderboard" className="underline" style={{ color: ARC.dim }}>
                      Every team, the history, and a watch list of your own →
                    </Link>
                  </p>
                </div>
              </Section>
            )}
            {board.isLoading && <div className="mb-14 h-[420px] animate-pulse" style={{ background: ARC.cell }} />}
            {board.error && !model && (
              <p className="mb-14 text-[13px]" style={{ color: ARC.faint }}>
                The leaderboard didn't load just now.{' '}
                <Link href="/kaggle-leaderboard" className="underline">Try the full page</Link>.
              </p>
            )}
          </main>

          <aside className="min-w-0 space-y-8">
            <OurStandingCard model={model} loading={board.isLoading} compact />
            <WireColumn />
          </aside>
        </div>

        {/* ── everything else lives on its own page now ──────────────────────── */}
        <Section title="Also here">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-[13px] leading-[1.7]">
            <Link href="/synthetic" className="block p-4" style={{ background: ARC.cell, border: `1px solid ${ARC.border}`, color: ARC.dim }}>
              <span className="block mb-1" style={{ color: ARC.pink, fontFamily: MONO }}>How we got here</span>
              The harness our entry is built on, and the practice games we made along the way.
            </Link>
            <a href={DISCORD} target="_blank" rel="noreferrer" className="block p-4" style={{ background: ARC.cell, border: `1px solid ${ARC.border}`, color: ARC.dim }}>
              <span className="block mb-1" style={{ color: ARC.pink, fontFamily: MONO }}>Discord ↗</span>
              The official ARC Prize server, with a community call every Sunday. Tell us if
              something here looks wrong about your team.
            </a>
            <Link href="/arc-leaderboards" className="block p-4" style={{ background: ARC.cell, border: `1px solid ${ARC.border}`, color: ARC.dim }}>
              <span className="block mb-1" style={{ color: ARC.pink, fontFamily: MONO }}>Every ARC leaderboard</span>
              Both Kaggle boards and the other public ARC standings, in one place.
            </Link>
          </div>
        </Section>

        <footer className="pt-2 text-[12px] leading-[2]" style={{ color: ARC.faint }}>
          <Link href="/play" className="underline">Play a game</Link>
          <span className="mx-2 opacity-50">·</span>
          <Link href="/arc3/hypotheses" className="underline">Research: what a model guesses from one frame</Link>
          <span className="mx-2 opacity-50">·</span>
          {/* Labelled as spoilers on purpose: /arc3 names mechanics of games playable here. */}
          <Link href="/arc3" className="underline">Reference (spoilers)</Link>
          <span className="mx-2 opacity-50">·</span>
          <Link href="/home" className="underline">Resource Hub</Link>
        </footer>
      </div>
    </div>
  );
}
