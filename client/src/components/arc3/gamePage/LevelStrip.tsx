/*
 * Author: Claude Opus 5
 * Date: 2026-09-18
 * PURPOSE: The row of level thumbnails near the top of a game page: every level's opening
 *          frame, pixel-sharp, with "L3" and Boss's actions / ARC's baseline for that level
 *          underneath. Sticks under the site header while you scroll; clicking a level jumps to
 *          its section. Scrolls sideways on a phone. This is the band Boss asked for when he
 *          looked at /arc3/games/dc22 on 18-Sep-2026.
 * SRP/DRY check: Pass -- presentation only; levels come from shared/arc3Games/gameLevels.ts and
 *          the per-level run numbers from its runOnLevel().
 */

import { runOnLevel, type GameLevel } from '@shared/arc3Games/gameLevels';
import type { HumanPlayRun } from '@shared/arc3Games/humanDifficulty';

/** Anchor id of a level's section; LevelSection uses the same one. */
export function levelAnchor(level: number): string {
  return `level-${level}`;
}

export function LevelStrip({
  levels,
  headline,
  player,
}: {
  levels: GameLevel[];
  /** The run whose per-level actions are quoted (best win, else furthest run). */
  headline: HumanPlayRun | null;
  player: string;
}) {
  const key = headline
    ? `${player}'s actions on his ${headline.state === 'WIN' ? 'best win' : 'furthest run'} / ARC baseline`
    : `ARC baseline actions (${player} has not played it yet)`;

  return (
    <nav
      aria-label="Levels"
      className="sticky top-12 z-30 -mx-4 mb-8 border-y bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <div className="flex items-end gap-2.5 overflow-x-auto pb-1">
        {levels.map((level) => {
          const thumb = level.images[0];
          const onLevel = headline ? runOnLevel(headline, level.level - 1) : null;
          const bossText = headline ? (onLevel ? String(onLevel.actions) : '—') : null;
          const title =
            `Level ${level.level}` +
            (onLevel ? `: ${player} ${onLevel.actions} actions${onLevel.cleared ? '' : ', stopped here'}` : '') +
            (level.arcBaselineActions !== null ? `, ARC baseline ${level.arcBaselineActions}` : '');
          return (
            <a
              key={level.level}
              href={`#${levelAnchor(level.level)}`}
              title={title}
              className="group flex shrink-0 flex-col items-center gap-0.5 no-underline"
            >
              {thumb ? (
                <img
                  src={thumb.imageUrl}
                  alt={`Level ${level.level}`}
                  className="h-20 w-20 border border-neutral-800 bg-black object-cover group-hover:outline group-hover:outline-2 group-hover:outline-primary sm:h-28 sm:w-28"
                  style={{ imageRendering: 'pixelated' }}
                  width={112}
                  height={112}
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center border border-dashed text-[10px] text-muted-foreground sm:h-28 sm:w-28">
                  no picture
                </div>
              )}
              <span className="font-mono text-xs font-bold">L{level.level}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {bossText !== null && <>{bossText} </>}
                <span className="text-muted-foreground/60">
                  {bossText !== null ? '/ ' : ''}
                  {level.arcBaselineActions ?? '—'}
                </span>
              </span>
            </a>
          );
        })}
      </div>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{key} · click a level to jump</p>
    </nav>
  );
}
