/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-12-19
 * PURPOSE: Reusable player rating card for Worm Arena matches.
 *          Displays TrueSkill rating, win/loss record, and placement status.
 * SRP/DRY check: Pass - single responsibility display component.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SnakeBenchModelRating } from '@shared/types.ts';
import type { WormArenaPlacementSummary } from '@shared/utils/wormArenaPlacement.ts';

export interface WormArenaPlayerRatingCardProps {
  /** Model slug/name to display */
  model: string;
  /** TrueSkill rating data (null/undefined = don't render) */
  rating: SnakeBenchModelRating | null | undefined;
  /** Placement summary (optional) */
  placement?: WormArenaPlacementSummary | null;
}

/**
 * Card displaying a player's TrueSkill rating and placement status.
 */
export function WormArenaPlayerRatingCard({
  model,
  rating,
  placement,
}: WormArenaPlayerRatingCardProps): React.ReactElement | null {
  // Don't render if no rating data
  if (!rating) return null;

  return (
    <Card className="worm-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-worm-ink">
          {model}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-worm-ink">
        {/* Pessimistic rating */}
        <div className="flex items-center justify-between">
          <span className="font-semibold">Pessimistic rating</span>
          <span className="worm-pill-green px-2 py-0.5 text-base">
            {rating.exposed.toFixed(1)}
          </span>
        </div>

        {/* Win/Loss/Tie record */}
        <div className="flex flex-wrap gap-3 text-xs">
          <span>Games: {rating.gamesPlayed}</span>
          <span>W {rating.wins}</span>
          <span>L {rating.losses}</span>
          <span>T {rating.ties}</span>
        </div>

        {/* Placement status */}
        {placement && (
          <div className="flex items-center justify-between text-xs">
            <span>{placement.label}</span>
            <Badge variant="outline" className="text-[11px] font-semibold">
              {placement.gamesPlayed}/{placement.maxGames} games
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default WormArenaPlayerRatingCard;
