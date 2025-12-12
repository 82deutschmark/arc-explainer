import React from 'react';

import { InlineMath } from 'react-katex';

import type { WormArenaPlacementSummary } from '@shared/utils/wormArenaPlacement';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function WormArenaPlacementCard({
  placement,
}: {
  placement: WormArenaPlacementSummary | null;
}) {
  const placementEquation = React.useMemo(() => {
    if (!placement) return null;
    const progressPercent = Math.round(placement.progress * 100);
    return `\\text{progress} = \\frac{${placement.gamesPlayed}}{${placement.maxGames}} \\approx ${progressPercent}\\%`;
  }, [placement]);

  const barClassName = React.useMemo(() => {
    if (!placement) return '';
    if (placement.phase === 'complete' || placement.phase === 'effectively_complete') {
      return 'bg-worm-green';
    }
    return 'bg-worm-red';
  }, [placement]);

  return (
    <Card className="worm-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold">Placement status</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {placement ? (
          <>
            <div className="flex items-center justify-between text-sm font-bold">
              <span>{placement.label}</span>
              <Badge variant="outline" className="text-xs font-bold">
                {placement.gamesPlayed}/{placement.maxGames} games
              </Badge>
            </div>

            <div className="w-full h-3 rounded-full bg-worm-track overflow-hidden">
              <div
                className={`h-full rounded-full ${barClassName}`}
                style={{ width: `${Math.round(placement.progress * 100)}%` }}
              />
            </div>

            <div className="text-sm font-semibold worm-muted">{placement.description}</div>

            {placementEquation && (
              <div className="text-xs font-mono">
                <InlineMath math={placementEquation} />
              </div>
            )}

            <div className="text-xs font-semibold worm-muted">
              We aim for roughly nine good games per model; we can stop earlier if sigma is already low, or keep playing for more precision.
            </div>
          </>
        ) : (
          <div className="text-sm font-semibold worm-muted">
            Select a model to see placement progress.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
