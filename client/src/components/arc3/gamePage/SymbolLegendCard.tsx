/*
 * Author: Claude Opus 5 (moved; original code by Claude Opus 5, 2026-09-17)
 * Date: 2026-09-18
 * PURPOSE: The named-symbol legend (TR87's runes): our name for each symbol with a picture of
 *          every way it can appear.
 *          Moved out of client/src/pages/Arc3GameSpoiler.tsx unchanged when the game page was
 *          rebuilt level by level (docs/plans/2026-09-18-arc3-game-page-glowup-and-dataset-prd.md).
 * SRP/DRY check: Pass -- one component, same code as before the move; rating math stays in
 *          shared/arc3Games/humanDifficulty.ts.
 */

import { Shapes } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { SymbolGlyph } from '@shared/arc3Games';

/**
 * The named-symbol legend. A game whose pieces are abstract shapes is unreadable in prose
 * until the shapes have names, and TR87 turns each one a random quarter-turn, so the picture
 * has to show every turn rather than one. Only rendered for games that list symbols.
 */
export function SymbolLegendCard({ glyphs, note }: { glyphs: SymbolGlyph[] | undefined; note?: string }) {
  if (!glyphs || glyphs.length === 0) return null;
  const groups = glyphs.reduce<Record<string, SymbolGlyph[]>>((acc, glyph) => {
    const key = glyph.group ?? 'Symbols';
    acc[key] = acc[key] ? [...acc[key], glyph] : [glyph];
    return acc;
  }, {});

  return (
    <Card className="mb-12">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          <Shapes className="h-5 w-5" />
          The Runes, Named
        </CardTitle>
        <CardDescription>Our names for the symbols, with every way each one can appear.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(groups).map(([group, entries]) => (
          <div key={group}>
            <p className="text-sm font-semibold mb-3">{group}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3">
              {entries.map((glyph) => (
                <div key={glyph.name} className="flex items-center gap-3">
                  <img
                    src={glyph.imageUrl}
                    alt={`${glyph.name}, in each way it can appear`}
                    className="h-8 w-auto shrink-0 rounded-sm border"
                    style={{ imageRendering: 'pixelated' }}
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">{glyph.name}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{glyph.looksLike}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {note && <p className="text-xs text-muted-foreground italic border-t pt-4">{note}</p>}
      </CardContent>
    </Card>
  );
}
