/*
 * Author: Claude Opus 5
 * Date: 2026-09-18
 * PURPOSE: One level of a game page. Header: "Level N", ARC's baseline actions and Boss's
 *          actions on that level, as plain numbers (no budget, no bar: brief amendment 3).
 *          Left: the engine render of the level's opening frame, then any human captures, each
 *          labelled as what it is. Right: the rules -- all of them on level 1 ("The rules from
 *          the start"), only the new ones after that ("New on level N") -- and that level's
 *          notes from play. Replaces the old Every Mechanic / Level Screenshots / Notes From Play
 *          / How It Works cards, which showed the rules and the pictures in different places.
 * SRP/DRY check: Pass -- layout of one GameLevel from shared/arc3Games/gameLevels.ts; rule and
 *          note rendering are MechanicRow and PlayNote.
 */

import type { LevelScreenshot } from '@shared/arc3Games';
import { screenshotKind, type GameLevel, type LevelRun } from '@shared/arc3Games/gameLevels';
import { levelAnchor } from './LevelStrip';
import { MechanicRow } from './MechanicRow';
import { PlayNote } from './PlayNote';

function LevelImage({ shot, level, build }: { shot: LevelScreenshot; level: number; build: string | null }) {
  const human = screenshotKind(shot) === 'human';
  return (
    <figure className="m-0">
      <img
        src={shot.imageUrl}
        alt={human ? `Level ${level}, captured mid-play` : `Level ${level}, opening frame`}
        className="block w-full border border-neutral-800 bg-black"
        style={{ imageRendering: 'pixelated' }}
        loading="lazy"
        width={256}
        height={256}
      />
      <figcaption className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        <span className="font-semibold text-foreground">{human ? 'Human capture' : 'Engine render'}</span>
        {human
          ? shot.caption && <> · {shot.caption}</>
          : <> · opening frame{build ? `, build ${build}` : ''}{shot.caption ? ` · ${shot.caption}` : ''}</>}
        {shot.notes && <span className="mt-0.5 block italic">{shot.notes}</span>}
      </figcaption>
    </figure>
  );
}

export function LevelSection({
  level,
  headlineOnLevel,
  hasHeadline,
  player,
  build,
}: {
  level: GameLevel;
  /** What the quoted run did here; null when it never got here (or there is no run). */
  headlineOnLevel: LevelRun | null;
  hasHeadline: boolean;
  player: string;
  build: string | null;
}) {
  const first = level.level === 1;
  const ruleCount = level.newRules.length;

  let bossText: string | null = null;
  if (hasHeadline) {
    bossText = headlineOnLevel
      ? `${headlineOnLevel.actions}${headlineOnLevel.cleared ? '' : ', stopped here'}`
      : 'not reached';
  }

  return (
    <section id={levelAnchor(level.level)} className="scroll-mt-60 border-t-2 border-foreground pt-3 mt-10 first:mt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-xl font-bold">Level {level.level}</h2>
        <p className="font-mono text-xs text-muted-foreground">
          {level.arcBaselineActions !== null && (
            <>
              ARC baseline <b className="text-foreground">{level.arcBaselineActions}</b>
            </>
          )}
          {bossText !== null && (
            <>
              {level.arcBaselineActions !== null && ' · '}
              {player} <b className="text-foreground">{bossText}</b>
            </>
          )}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          {level.images.length > 0 ? (
            level.images.map((shot) => (
              <LevelImage key={shot.imageUrl} shot={shot} level={level.level} build={build} />
            ))
          ) : (
            <div className="flex aspect-square items-center justify-center border border-dashed p-6 text-center font-mono text-xs text-muted-foreground">
              No picture of this level yet.
            </div>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <h3 className="text-sm font-semibold">
              {first ? 'The rules from the start' : `New on level ${level.level}`}
              {ruleCount > 0 && (
                <span className="ml-2 font-normal text-muted-foreground">
                  {ruleCount} {ruleCount === 1 ? 'rule' : 'rules'}
                </span>
              )}
            </h3>
            {ruleCount > 0 ? (
              <ul className="mt-1 list-none p-0">
                {level.newRules.map((point, index) => (
                  <MechanicRow key={`${level.level}-${index}`} point={point} />
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {first ? 'No rules written up for this game yet.' : 'Nothing new on this level: the rules from earlier levels still apply.'}
              </p>
            )}
          </div>
          {level.observations.map((note, index) => (
            <PlayNote key={`${note.date}-${index}`} note={note} />
          ))}
        </div>
      </div>
    </section>
  );
}
