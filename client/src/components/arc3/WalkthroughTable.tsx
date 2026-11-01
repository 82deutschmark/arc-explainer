/*
Author: Claude Opus 5.5 High
Date: 2026-11-01
PURPOSE: One row per public ARC-AGI-3 game with everything we hold on it: the level-by-level
         walkthrough, a human winning replay, the AI replays, the original-build recording, and
         a Play button that opens the game on this site. The Boss, 1-Nov-2026: the human
         walkthroughs of all the games are the best thing we have and nobody can find them.
SRP/DRY check: Pass - reads the shared game registry the guide pages read and the mirror the
         player reads. Rows are derived, so a new replay or game shows up by itself.
*/
import { useMemo } from 'react';
import { Link } from 'wouter';
import { arcPrizeLeaderboardUrl, getAllGames, type Arc3GameMetadata } from '@shared/arc3Games';
import humanPlay from '@shared/arc3Games/humanPlay.generated.json';
import { useMirrorGames } from '@/components/arc3/SyntheticGames';
import { ARC, MONO } from '@/pages/arc3-community/landingTheme';

const isAiReplay = (title: string) => /astra|harness/i.test(title);

export interface WalkthroughRow {
  game: Arc3GameMetadata;
  humanReplay?: string;
  aiReplays: number;
  firstAiReplay?: string;
  originalReplay?: string;
}

function rowFor(game: Arc3GameMetadata): WalkthroughRow {
  const replays = game.resources.filter((r) => r.type === 'replay');
  const ai = replays.filter((r) => isAiReplay(r.title));
  const original = replays.find((r) => r.originalGame);
  const human = replays.find((r) => !isAiReplay(r.title) && !r.originalGame && /human|boss|mark/i.test(r.title))
    ?? replays.find((r) => !isAiReplay(r.title) && !r.originalGame);
  return { game, humanReplay: human?.url, aiReplays: ai.length, firstAiReplay: ai[0]?.url, originalReplay: original?.url };
}

/** Level one's picture; only a few older games have a separate thumbnail. */
const openingFrame = (game: Arc3GameMetadata) => game.levelScreenshots?.[0]?.imageUrl ?? game.thumbnailUrl;

/** The guide's own count, then the count from ARC Prize's human baselines for games without one. */
const BASELINES: Record<string, { levelCount?: number }> = humanPlay.games;
const levelsOf = (game: Arc3GameMetadata) => game.levelCount ?? BASELINES[game.gameId]?.levelCount;

const Out = ({ href, children }: { href?: string; children: React.ReactNode }) => href
  ? <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 whitespace-nowrap" style={{ color: ARC.text }}>{children}</a>
  : <span style={{ color: ARC.faint }}>—</span>;

export function WalkthroughTable({ filter }: { filter: string }) {
  const mirror = useMirrorGames();
  const rows = useMemo(() => getAllGames().map(rowFor), []);
  const needle = filter.trim().toLowerCase();
  const shown = needle
    ? rows.filter(({ game }) => `${game.gameId} ${game.informalName ?? ''} ${game.officialTitle} walkthrough human replay`.toLowerCase().includes(needle))
    : rows;
  // The mirror keys official games as "ls20-9607627b"; the withdrawn preview game keeps its bare id.
  const playId = (gameId: string) => mirror.find((g) => g.gameId === gameId || g.gameId.startsWith(`${gameId}-`) && g.category === 'official')?.gameId;
  if (!shown.length) return <p className="py-3 text-[14px]" style={{ color: ARC.faint }}>No game matches that.</p>;

  return (
    <div className="overflow-x-auto" role="region" aria-label="Walkthroughs of the public games" tabIndex={0}>
      <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
        <thead>
          <tr className="text-left text-[10.5px] uppercase tracking-[1.2px]" style={{ color: ARC.faint, fontFamily: MONO, borderBottom: `2px solid ${ARC.text}` }}>
            <th scope="col" className="py-2 pr-3 font-normal">Game</th>
            <th scope="col" className="py-2 pr-3 font-normal text-right">Levels</th>
            <th scope="col" className="py-2 pr-3 font-normal">Walkthrough</th>
            <th scope="col" className="py-2 pr-3 font-normal">Human win</th>
            <th scope="col" className="py-2 pr-3 font-normal">AI replay</th>
            <th scope="col" className="py-2 pr-3 font-normal">Original build</th>
            <th scope="col" className="py-2 font-normal">Play</th>
          </tr>
        </thead>
        <tbody>
          {shown.map(({ game, humanReplay, firstAiReplay, originalReplay }) => {
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
                  <Link href={`/arc3/games/${game.gameId}`} className="font-semibold underline underline-offset-2 whitespace-nowrap" style={{ color: ARC.pink }}>Read it →</Link>
                </td>
                {/* Not every win has a replay link in our notes; ARC Prize's per-game human board always does. */}
                <td className="py-[6px] pr-3">
                  {humanReplay
                    ? <Out href={humanReplay}>Watch ↗</Out>
                    : <Out href={arcPrizeLeaderboardUrl(game.gameId)}>Top 10 ↗</Out>}
                </td>
                <td className="py-[6px] pr-3"><Out href={firstAiReplay}>Watch ↗</Out></td>
                <td className="py-[6px] pr-3"><Out href={originalReplay}>Watch ↗</Out></td>
                <td className="py-[6px]">
                  {id
                    ? <Link href={`/arc3/play/${id}`} className="font-semibold whitespace-nowrap hover:underline" style={{ color: ARC.text }}>Play →</Link>
                    : <span style={{ color: ARC.faint }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
