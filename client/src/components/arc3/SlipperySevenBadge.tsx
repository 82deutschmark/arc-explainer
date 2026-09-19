/*
 * Author: Claude Opus 5
 * Date: 2026-09-19
 * PURPOSE: Small "Slippery Seven" badge for the seven ARC-AGI-3 games our agents struggle with
 *          most (list in shared/arc3Games/slipperySeven.ts). Renders nothing for any other game,
 *          so callers can drop it in unconditionally. Used on the /arc3/games grid tiles and
 *          entries, and in the game page header beside the difficulty badges.
 * SRP/DRY check: Pass -- one presentational component over the shared list; reuses shadcn Badge.
 */

import { Snowflake } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getSlipperySevenEntry, SLIPPERY_SEVEN_SUMMARY } from '@shared/arc3Games/slipperySeven';

export function SlipperySevenBadge({ gameId, className }: { gameId: string; className?: string }) {
  const entry = getSlipperySevenEntry(gameId);
  if (!entry) return null;

  return (
    <Badge
      variant="outline"
      className={cn('bg-sky-50 text-sky-800 border-sky-300 font-medium', className)}
      title={`${SLIPPERY_SEVEN_SUMMARY} ${entry.reason}`}
    >
      <Snowflake className="h-3 w-3 mr-1" />
      Slippery Seven
    </Badge>
  );
}
