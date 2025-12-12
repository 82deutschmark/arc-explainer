import React from 'react';
import type { SnakeBenchArcExplainerStats } from '@shared/types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DataNumber from '@/components/wormArena/DataNumber';

export default function WormArenaGlobalStatsStrip({
  stats,
}: {
  stats: SnakeBenchArcExplainerStats | null | undefined;
}) {
  const cards = React.useMemo(
    () => [
      { key: 'totalGames', label: 'Total matches', value: stats?.totalGames ?? 0 },
      { key: 'activeModels', label: 'Models competing', value: stats?.activeModels ?? 0 },
      { key: 'topApples', label: 'Top apples (single game)', value: stats?.topApples ?? 0 },
      {
        key: 'totalCost',
        label: 'Total testing cost',
        value:
          stats?.totalCost?.toFixed != null
            ? `$${stats.totalCost.toFixed(2)}`
            : `$${stats?.totalCost ?? 0}`,
      },
    ],
    [stats],
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.key} className="worm-card">
          <CardHeader className="py-3">
            <CardTitle className="text-base worm-card-title">{card.label}</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <DataNumber>{card.value}</DataNumber>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
