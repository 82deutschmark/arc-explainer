/**
 * Author: Codex (GPT-5)
 * Date: 2025-12-10
 * PURPOSE: Present Worm Arena reasoning panels with bold typography, color-coded headers,
 *          and emoji score indicators to mirror SnakeBench's three-column layout.
 * SRP/DRY check: Pass - focused solely on rendering a single player's reasoning panel.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Use broadly supported emoji to avoid missing glyphs on older platforms.
const WORM_ICON = '🐍';
const APPLE_ICON = String.fromCodePoint(0x1F34E);

interface WormArenaReasoningProps {
  playerName: string;
  color: 'red' | 'gold';
  reasoning: string;
  score?: number;
  strategyLabel?: string;
}

export default function WormArenaReasoning({
  playerName,
  color,
  reasoning,
  score = 0,
  strategyLabel = 'Strategy',
}: WormArenaReasoningProps) {
  const accentColor = color === 'red' ? '#d84949' : '#e8a11a';
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  const appleIcons = React.useMemo(() => {
    const visible = Math.min(6, safeScore);
    return Array.from({ length: visible }, (_, idx) => idx);
  }, [safeScore]);
  const remainingScore = safeScore - appleIcons.length;

  return (
    <Card className="h-full flex flex-col border-2" style={{ borderColor: accentColor }}>
      <CardHeader className="text-center pb-4">
        <CardTitle
          className={cn(
            'text-lg font-bold flex items-center justify-center gap-2',
            color === 'red' ? 'text-red-600' : 'text-yellow-600'
          )}
        >
          <span role="img" aria-hidden="true">
            {WORM_ICON}
          </span>
          {playerName}
        </CardTitle>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{strategyLabel}</div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="text-base font-medium leading-relaxed whitespace-pre-wrap text-[#2d2416]">
          {reasoning?.trim()?.length ? reasoning : 'No reasoning captured for this moment.'}
        </div>
        <div className="mt-6 pt-4 border-t border-dashed flex flex-col items-center gap-2">
          <div className="flex items-center gap-1 text-xl" aria-label={`Score ${safeScore}`}>
            {appleIcons.map((idx) => (
              <span key={idx} role="img" aria-hidden="true">
                {APPLE_ICON}
              </span>
            ))}
            {remainingScore > 0 && (
              <span className="text-base font-semibold text-muted-foreground">+{remainingScore}</span>
            )}
          </div>
          <div className="text-sm text-muted-foreground font-semibold">Score: {safeScore}</div>
        </div>
      </CardContent>
    </Card>
  );
}
