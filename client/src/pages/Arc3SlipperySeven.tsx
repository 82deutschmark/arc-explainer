/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Dedicated, dated research index for the Slippery Seven at /arc3/slippery-seven.
 *          Reuses cohort membership and existing official game metadata; links the full
 *          game guides without copying their mechanics or suggesting a current ranking.
 * SRP/DRY check: Pass — shared registries own membership, screenshots and game details.
 */
import { Link } from 'wouter';
import { ArrowRight, BookOpen } from 'lucide-react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { getGameById, type Arc3GameMetadata } from '@shared/arc3Games';
import { SLIPPERY_SEVEN } from '@shared/arc3Games/slipperySeven';

export default function Arc3SlipperySeven() {
  usePageMeta({
    title: 'The Slippery Seven — ARC-AGI-3 game guides',
    description: 'The seven ARC-AGI-3 games that resisted all four passes of the September 16 Qwen 27B run, with screenshots and links to each game guide.',
    canonicalPath: '/arc3/slippery-seven',
  });

  return (
    <div className="mx-auto max-w-6xl space-y-7 px-4 py-7 sm:py-10">
      <header className="max-w-3xl space-y-3">
        <Link href="/arc3/games" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
          <BookOpen className="h-4 w-4" /> All ARC-AGI-3 game guides
        </Link>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">The Slippery Seven</h1>
        <p className="text-lg text-muted-foreground">
          Seven games. Four passes each. No levels cleared.
        </p>
        <p className="leading-relaxed">
          These games earned their nickname in the September 16, 2026 Qwen 27B experiment:
          all 28 attempts ended without clearing a level. The September 17 research notes
          brought them together as the Slippery Seven.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The name records that experiment. Other models have cleared levels on several
          of these games. The earlier Flash-Next “bottom seven” was a separate group;
          only g50t, sk48 and tn36 appear in both.
        </p>
      </header>

      <section aria-label="The seven games" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SLIPPERY_SEVEN.map(({ gameId }) => {
          const game: Arc3GameMetadata = getGameById(gameId);
          const screenshot = [...(game.levelScreenshots ?? [])].sort((a, b) => a.level - b.level)[0];
          return (
            <Link key={gameId} href={`/arc3/games/${gameId}`} className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              {screenshot && (
                <div className="flex h-52 items-center justify-center border-b bg-muted/40 p-3">
                  <img src={screenshot.imageUrl} alt={`${gameId}, level ${screenshot.level}`} loading="lazy" className="h-full w-full object-contain" style={{ imageRendering: 'pixelated' }} />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-mono text-xl font-bold">{gameId}</h2>
                  {typeof game.levelCount === 'number' && <span className="text-xs text-muted-foreground">{game.levelCount} levels</span>}
                </div>
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{game.simpleExplanation}</p>
                <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">Read the game guide <ArrowRight className="h-4 w-4" /></span>
              </div>
            </Link>
          );
        })}
      </section>

      <footer className="max-w-3xl border-t pt-4 text-sm leading-relaxed text-muted-foreground">
        Each guide includes game mechanics and level details, so expect spoilers.
        These seven belong to the public demonstration set; results on them do not
        establish performance on the hidden competition games.
      </footer>
    </div>
  );
}
