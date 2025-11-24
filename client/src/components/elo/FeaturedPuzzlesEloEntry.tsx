/**
 * Author: Cascade
 * Date: 2025-11-23
 * PURPOSE: ELO helper component that surfaces the ten curated featured puzzles
 *          as quick entry points into the comparison arena.
 *          Uses the shared featuredPuzzles source-of-truth to avoid duplication.
 * SRP/DRY check: Pass — UI-only wrapper around shared featured puzzle metadata.
 */

import React from 'react';
import { Link } from 'wouter';
import { Star, ListChecks } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FEATURED_PUZZLES } from '@shared/featuredPuzzles';

export const FeaturedPuzzlesEloEntry: React.FC = () => {
  const [open, setOpen] = React.useState(false);

  const toggleOpen = () => setOpen((prev) => !prev);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="flex items-center gap-1"
        onClick={toggleOpen}
      >
        <Star className="h-4 w-4 text-yellow-500" />
        Featured 10
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 z-30">
          <Card className="shadow-lg border-blue-200">
            <CardHeader className="py-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-blue-600" />
                Review featured puzzles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 py-2 max-h-80 overflow-y-auto">
              {FEATURED_PUZZLES.map((puzzle) => (
                <Link key={puzzle.id} href={`/elo/${puzzle.id}`}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 px-2 py-1 h-auto text-left"
                    onClick={() => setOpen(false)}
                  >
                    <span className="font-mono text-[11px] font-semibold">
                      {puzzle.id}
                    </span>
                    {puzzle.note && (
                      <span className="text-[11px] text-slate-600 truncate">
                        {puzzle.note}
                      </span>
                    )}
                  </Button>
                </Link>
              ))}
              <p className="mt-1 text-[10px] text-slate-500">
                These puzzles match the curated featured set used in the main Puzzle Browser.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
