/*
 * Author: Claude Opus 5
 * Date: 2026-09-18
 * PURPOSE: The "Replays, sources and correction history" fold-out of a game page: the featured
 *          replay video, replay links, other resources, screenshots from older builds (levels
 *          the live build does not have, like ft09's preview-era 8 and 9), tags, and the game
 *          file's notes, which hold its dated corrections. Everything the old page showed in
 *          full-width cards under the write-up, kept, just folded away.
 * SRP/DRY check: Pass -- presentation of fields already on Arc3GameMetadata; the older-build
 *          screenshots are picked out by shared/arc3Games/gameLevels.ts.
 */

import { Download, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Arc3GameMetadata, GameResource, LevelScreenshot } from '@shared/arc3Games';

function ResourceLink({ resource }: { resource: GameResource }) {
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-md border px-3 py-2.5 hover:bg-muted/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary">{resource.title}</p>
          {resource.description && <p className="mt-0.5 text-xs text-muted-foreground">{resource.description}</p>}
        </div>
        <Badge variant="outline" className="shrink-0 capitalize">
          {resource.type}
          <ExternalLink className="ml-1 h-3 w-3" />
        </Badge>
      </div>
    </a>
  );
}

/** One line for the collapsed fold-out. */
export function gameSourcesSummary(game: Arc3GameMetadata): string {
  const replays = game.resources.filter((r) => r.type === 'replay').length;
  const parts = [
    `${replays} ${replays === 1 ? 'replay' : 'replays'}`,
    `${game.resources.length - replays} other ${game.resources.length - replays === 1 ? 'link' : 'links'}`,
  ];
  if (game.video) parts.unshift('replay video');
  if (game.notes) parts.push('correction history');
  return parts.join(', ');
}

export function GameSources({
  game,
  olderScreenshots,
}: {
  game: Arc3GameMetadata;
  olderScreenshots: LevelScreenshot[];
}) {
  const replays = game.resources.filter((r) => r.type === 'replay');
  const others = game.resources.filter((r) => r.type !== 'replay');

  return (
    <div className="space-y-6">
      {game.video && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Featured replay</h4>
          <video className="w-full rounded-md border" controls preload="metadata" poster={game.video.poster}>
            <source src={game.video.src} type="video/mp4" />
            Your browser does not support embedded ARC3 replays.
          </video>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{game.video.caption || 'Recorded run.'}</p>
            <Button variant="outline" size="sm" asChild>
              <a href={game.video.src} download>
                <Download className="mr-2 h-4 w-4" />
                Download MP4
              </a>
            </Button>
          </div>
        </div>
      )}

      {replays.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Replays</h4>
          {replays.map((r, i) => (
            <ResourceLink key={`${r.url}-${i}`} resource={r} />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Other sources</h4>
          {others.map((r, i) => (
            <ResourceLink key={`${r.url}-${i}`} resource={r} />
          ))}
        </div>
      )}

      {olderScreenshots.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Screenshots from an older build</h4>
          <p className="text-xs text-muted-foreground">
            Levels the current version of this game does not have. Kept for their own sake.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {olderScreenshots.map((shot) => (
              <figure key={shot.imageUrl} className="m-0">
                <img
                  src={shot.imageUrl}
                  alt={`Level ${shot.level}, older build`}
                  className="block w-full border border-neutral-800 bg-black"
                  style={{ imageRendering: 'pixelated' }}
                  loading="lazy"
                />
                <figcaption className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  <span className="font-semibold text-foreground">Level {shot.level}</span>
                  {shot.caption && <> · {shot.caption}</>}
                  {shot.notes && <span className="block italic">{shot.notes}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {game.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {game.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {game.notes && (
        <div className="space-y-1">
          <h4 className="text-sm font-semibold">Notes and corrections</h4>
          <p className="text-xs leading-relaxed text-muted-foreground">{game.notes}</p>
        </div>
      )}
    </div>
  );
}
