/**
 * Author: Codex (GPT-5)
 * Date: 2025-12-19
 * PURPOSE: Present tall, fixed-height Worm Arena reasoning panels with scrollable content so
 *          columns stay aligned with the live board while preserving player colors/icons
 *          (includes the proper worm emoji requested by the user).
 * SRP/DRY check: Pass - handles rendering for a single player's reasoning only.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Use broadly supported emoji to avoid missing glyphs on older platforms.
const WORM_ICON = '🐛';
const APPLE_ICON = String.fromCodePoint(0x1F34E);
const PANEL_HEIGHT_REM = 46;

interface WormArenaReasoningProps {
  playerName: string;
  color: 'green' | 'blue';
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
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;

  // Limit the number of rendered apple emojis to keep layout tidy while hinting at overflow.
  const appleIcons = React.useMemo(() => {
    const visible = Math.min(6, safeScore);
    return Array.from({ length: visible }, (_, idx) => idx);
  }, [safeScore]);
  const remainingScore = safeScore - appleIcons.length;

  return (
    <Card
      className={cn(
        'flex flex-col border-2 overflow-hidden',
        color === 'green' ? 'border-green-600' : 'border-blue-600',
      )}
      style={{ height: `${PANEL_HEIGHT_REM}rem` }}
    >
      <CardHeader className="text-center pb-4">
        <CardTitle
          className={cn(
            'text-lg font-bold flex items-center justify-center gap-2',
            color === 'green' ? 'text-green-600' : 'text-blue-600',
          )}
        >
          <span role="img" aria-hidden="true">
            {WORM_ICON}
          </span>
          {playerName}
        </CardTitle>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{strategyLabel}</div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 text-base font-medium leading-relaxed whitespace-pre-wrap text-worm-ink">
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
