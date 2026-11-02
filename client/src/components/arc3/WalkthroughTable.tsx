/*
Author: Claude Opus 5.5 High
Date: 2026-11-01
PURPOSE: One row per public ARC-AGI-3 game: the guide to the human reasoning, Boss's own replay
         with how it ended, the game itself, ARC Prize's top human runs, the AI replays and the
         original-build recording. The Boss, 1-Nov-2026: the point of the site is his guide to
         the reasoning and his replay of it, so those two lead every row.
         His replays come from his scorecard runs (humanPlay.generated.json), not the hand-kept
         links in each game file, which only had some of them.
SRP/DRY check: Pass - reads the shared game registry the guide pages read, getOwnerReplays for
         his runs and the mirror the player reads. Rows are derived, so a new run shows up by itself.
*/
import { useMemo } from 'react';
import { Link } from 'wouter';
import { arcPrizeLeaderboardUrl, getAllGames, type Arc3GameMetadata } from '@shared/arc3Games';
import { arcPrizeReplayUrl, getOwnerReplays, type HumanPlayRun } from '@shared/arc3Games/humanDifficulty';
import humanPlay from '@shared/arc3Games/humanPlay.generated.json';
import { useMirrorGames } from '@/components/arc3/SyntheticGames';
import { replayOutcome } from '@/components/arc3/gamePage/BossReplays';
import { ARC, MONO } from '@/pages/arc3-community/landingTheme';

const isAiReplay = (title: string) => /astra|harness/i.test(title);

export interface WalkthroughRow {
  game: Arc3GameMetadata;
  bossBest?: HumanPlayRun;
  bossOtherWins: HumanPlayRun[];
  /** Only for a game outside the scorecard data: AS66, withdrawn before his runs were pulled. */
  listedReplay?: string;
  firstAiReplay?: string;
  originalReplay?: string;
}

function rowFor(game: Arc3GameMetadata): WalkthroughRow {
  const replays = game.resources.filter((r) => r.type === 'replay');
  const [bossBest, ...rest] = getOwnerReplays(game.gameId);
  return {
    game,
    bossBest,
    bossOtherWins: rest.filter((run) => run.state === 'WIN'),
    listedReplay: replays.find((r) => !isAiReplay(r.title) && !r.originalGame)?.url,
    firstAiReplay: replays.find((r) => isAiReplay(r.title))?.url,
    originalReplay: replays.find((r) => r.originalGame)?.url,
  };
}

/** Level one's picture; only a few older games have a separate thumbnail. */
const openingFrame = (game: Arc3GameMetadata) => game.levelScreenshots?.[0]?.imageUrl ?? game.thumbnailUrl;

/** The guide's own count, then the count from ARC Prize's human baselines for games without one. */
const BASELINES: Record<string, { levelCount?: number }> = humanPlay.games;
const levelsOf = (game: Arc3GameMetadata) => game.levelCount ?? BASELINES[game.gameId]?.levelCount;

const Out = ({ href, children }: { href?: string; children: React.ReactNode }) => href
  ? <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 whitespace-nowrap" style={{ color: ARC.text }}>{children}</a>
  : <span style={{ color: ARC.faint }}>—</span>;

function BossReplayCell({ row }: { row: WalkthroughRow }) {
  const { bossBest, bossOtherWins, listedReplay } = row;
  if (!bossBest) return <Out href={listedReplay}>Watch ↗</Out>;
  return (
    <span className="whitespace-nowrap">
      <a href={arcPrizeReplayUrl(bossBest.guid)} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2" style={{ color: ARC.pink }}>Watch ↗</a>
      <span className="ml-2 text-[12px]" style={{ color: ARC.dim }}>{replayOutcome(bossBest)}</span>
      {bossOtherWins.map((run, i) => (
        <a key={run.guid} href={arcPrizeReplayUrl(run.guid)} target="_blank" rel="noreferrer" title={replayOutcome(run)}
           className="ml-2 text-[12px] underline underline-offset-2" style={{ color: ARC.dim }}>
          {bossOtherWins.length > 1 ? `win ${i + 2}` : 'other win'} ↗
        </a>
      ))}
    </span>
  );
}

export function WalkthroughTable({ filter }: { filter: string }) {
  const mirror = useMirrorGames();
  const rows = useMemo(() => getAllGames().map(rowFor), []);
  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? rows.filter(({ game }) => `${game.gameId} ${game.informalName ?? ''} ${game.officialTitle} guide walkthrough human boss replay`.toLowerCase().includes(needle))
    : rows;
  // The mirror keys official games as "ls20-9607627b"; the withdrawn preview game keeps its bare id.
  const playId = (gameId: string) => mirror.find((g) => g.gameId === gameId || g.gameId.startsWith(`${gameId}-`) && g.category === 'official')?.gameId;
  if (!shown.length) return <p className="py-3 text-[14px]" style={{ color: ARC.faint }}>No game matches that.</p>;

  return (
    <div className="overflow-x-auto" role="region" aria-label="Boss's guide and replay for each public game" tabIndex={0}>
      <table className="w-full min-w-[860px] border-collapse text-[13.5px]">
        <thead>
          <tr className="text-left text-[10.5px] uppercase tracking-[1.2px]" style={{ color: ARC.faint, fontFamily: MONO, borderBottom: `2px solid ${ARC.text}` }}>
            <th scope="col" className="py-2 pr-3 font-normal">Game</th>
            <th scope="col" className="py-2 pr-3 font-normal text-right">Levels</th>
            <th scope="col" className="py-2 pr-3 font-normal">The reasoning</th>
            <th scope="col" className="py-2 pr-3 font-normal">Boss's replay</th>
            <th scope="col" className="py-2 pr-3 font-normal">Play</th>
            <th scope="col" className="py-2 pr-3 font-normal">Top 10 humans</th>
            <th scope="col" className="py-2 pr-3 font-normal">AI replay</th>
            <th scope="col" className="py-2 font-normal">Original build</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => {
            const { game, firstAiReplay, originalReplay } = row;
            const id = playId(game.gameId);
            return (
              <tr key={game.gameId} style={{ borderBottom: `1px solid ${ARC.border}` }}>
                <th scope="row" className="py-[6px] pr-3 text-left font-normal">
                  <Link href={`/arc3/games/${game.gameId}`} className="flex items-center gap-2 hover:underline">
                    {openingFrame(game) && (
                      <img src={openingFrame(game)} alt="" width={32} height={32} loading="lazy" decoding="async"
                           className="block w-8 h-8 shrink-0" style={{ imageRendering: 'pixelated', background: ARC.tile }} />
                    )}
                    <b style={{ fontFamily: MONO }}>{game.gameId.toUpperCase()}</b>
                    <span className="truncate" style={{ color: ARC.dim }}>{game.informalName}</span>
                  </Link>
                </th>
                <td className="py-[6px] pr-3 text-right tabular-nums" style={{ fontFamily: MONO, color: ARC.dim }}>{levelsOf(game) ?? '—'}</td>
                <td className="py-[6px] pr-3">
                  <Link href={`/arc3/games/${game.gameId}`} className="font-semibold underline underline-offset-2 whitespace-nowrap" style={{ color: ARC.pink }}>Read the guide →</Link>
                </td>
                <td className="py-[6px] pr-3"><BossReplayCell row={row} /></td>
                <td className="py-[6px] pr-3">
                  {id
                    ? <Link href={`/arc3/play/${id}`} className="font-semibold whitespace-nowrap hover:underline" style={{ color: ARC.text }}>Play →</Link>
                    : <span style={{ color: ARC.faint }}>—</span>}
                </td>
                <td className="py-[6px] pr-3"><Out href={arcPrizeLeaderboardUrl(game.gameId)}>Board ↗</Out></td>
                <td className="py-[6px] pr-3"><Out href={firstAiReplay}>Watch ↗</Out></td>
                <td className="py-[6px]"><Out href={originalReplay}>Watch ↗</Out></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
