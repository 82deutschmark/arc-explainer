/*
 * Author: Claude Opus 5
 * Date: 2026-09-18
 * PURPOSE: "The original game" section of a game page, for the games whose featured replay
 *          video was recorded on the ORIGINAL version -- the build ARC Prize later reworked
 *          (vc33, ls20, ft09, sp80). These recordings are the only record of how those games
 *          used to look, so they sit open on the page, not in the collapsed "Replays and
 *          sources" fold-out, with a short original-vs-today table under the video. Renders
 *          nothing unless game.video.originalGame is set.
 * SRP/DRY check: Pass -- presentation of GameVideo.originalGame only. GameSources skips the
 *          video when this section shows it, so it never appears twice. Uses the shadcn Badge
 *          and Button like the rest of the page.
 */

import { Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Arc3GameMetadata } from '@shared/arc3Games';
import { formatDay } from './humanLeaderboard';

export function OriginalGameReplay({ game }: { game: Arc3GameMetadata }) {
  const video = game.video;
  const original = video?.originalGame;
  if (!video || !original) return null;

  return (
    <section className="mb-10 border-l-4 border-amber-500 pl-4 sm:pl-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">The original game</h2>
        <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
          Not today&apos;s version
        </Badge>
      </div>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{original.intro}</p>

      <video
        className="mt-4 w-full max-w-3xl rounded-md border"
        controls
        preload="metadata"
        poster={video.poster}
      >
        <source src={video.src} type="video/mp4" />
        Your browser does not support embedded ARC3 replays.
      </video>
      <div className="mt-2 flex max-w-3xl flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Recorded {formatDay(original.recordedOn)} on <span className="font-mono">{original.build}</span>
          {video.caption ? ` · ${video.caption}` : ''}
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href={video.src} download>
            <Download className="mr-2 h-4 w-4" />
            Download MP4
          </a>
        </Button>
      </div>

      {original.changes.length > 0 && (
        <div className="mt-5 max-w-3xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-medium" />
                <th className="py-2 pr-4 font-medium">Original</th>
                <th className="py-2 font-medium">Today</th>
              </tr>
            </thead>
            <tbody>
              {original.changes.map((change) => (
                <tr key={change.aspect} className="border-b align-top last:border-0">
                  <th scope="row" className="py-2 pr-4 text-left font-medium whitespace-nowrap">
                    {change.aspect}
                  </th>
                  <td className="py-2 pr-4">{change.original}</td>
                  <td className="py-2">{change.today}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
