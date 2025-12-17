/**
 * Author: GPT-5.2-Medium-Reasoning
 * Date: 2025-12-17
 * PURPOSE: Worm Arena model snapshot card. Displays a model's TrueSkill parameters and
 *          basic match stats in a compact, reusable card.
 *          When `onModelSlugClick` is provided, the model slug in the header becomes a
 *          clickable control (used by Skill Analysis to let the user change the baseline).
 *          Supports role-based color coordination (compare=blue, baseline=red) so the
 *          Skill Analysis page stays visually consistent.
 * SRP/DRY check: Pass — presentation-only; the parent owns selection state.
 */

import React from 'react';
import type { SnakeBenchModelRating } from '@shared/types';

import { InlineMath } from 'react-katex';

import { Badge, badgeVariants } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import DataNumber from '@/components/wormArena/DataNumber';
import type { WormArenaModelRole } from '@/utils/wormArenaRoleColors';
import { getWormArenaRoleColors } from '@/utils/wormArenaRoleColors';

export default function WormArenaModelSnapshotCard({
  rating,
  isLoading,
  error,
  onModelSlugClick,
  role = 'neutral',
}: {
  rating: SnakeBenchModelRating | null | undefined;
  isLoading: boolean;
  error: string | null;
  onModelSlugClick?: (modelSlug: string) => void;
  role?: WormArenaModelRole;
}) {
  const roleColors = getWormArenaRoleColors(role);
  const dataTone: 'blue' | 'red' | 'neutral' = role === 'compare' ? 'blue' : role === 'baseline' ? 'red' : 'neutral';

  const pessimisticEquation = React.useMemo(() => {
    if (!rating) return null;
    const mu = rating.mu.toFixed(2);
    const sigma = rating.sigma.toFixed(2);
    const exposed = rating.exposed.toFixed(2);
    return `\\mu - 3\\sigma = ${mu} - 3 \\times ${sigma} \\approx ${exposed}`;
  }, [rating]);

  return (
    <Card className="worm-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold flex items-center justify-between">
          <span>Model snapshot</span>
          {rating?.modelSlug && (
            <>
              {/* If a parent provides an action, treat the slug as a compact button (baseline picker). */}
              {onModelSlugClick ? (
                <button
                  type="button"
                  onClick={() => onModelSlugClick(rating.modelSlug)}
                  className={cn(
                    badgeVariants({ variant: 'outline' }),
                    'text-xs font-mono cursor-pointer hover:bg-worm-card',
                  )}
                  style={{ borderColor: roleColors.accent, color: roleColors.accent }}
                  title="Change baseline model"
                >
                  {rating.modelSlug}
                </button>
              ) : (
                <Badge
                  variant="outline"
                  className="text-xs font-mono"
                  style={{ borderColor: roleColors.accent, color: roleColors.accent }}
                >
                  {rating.modelSlug}
                </Badge>
              )}
            </>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        {isLoading && <div className="text-sm font-semibold worm-muted">Loading rating…</div>}
        {error && <div className="text-sm font-semibold text-red-700">{error}</div>}
        {!isLoading && !rating && !error && (
          <div className="text-sm font-semibold worm-muted">
            Select a model in the list to see its rating details.
          </div>
        )}

        {rating && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-bold flex items-center gap-2">
                  <span>Skill estimate</span>
                  <InlineMath math="\\mu" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-4 h-4 cursor-help worm-muted" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Higher is better. This is the center of the model's estimated skill distribution.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <DataNumber tone={dataTone}>{rating.mu.toFixed(2)}</DataNumber>
                <div className="text-xs font-mono mt-1">
                  <InlineMath math="\\mu" /> is the centre of the model skill distribution.
                </div>
              </div>

              <div>
                <div className="text-sm font-bold flex items-center gap-2">
                  <span>Uncertainty</span>
                  <InlineMath math="\\sigma" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-4 h-4 cursor-help worm-muted" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Bigger σ = less certain about skill. Smaller is better.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <DataNumber tone={dataTone}>{rating.sigma.toFixed(2)}</DataNumber>
                <div className="text-xs font-mono mt-1">
                  Most skill lies in <InlineMath math="\\mu \\pm 3\\sigma" />.
                </div>
              </div>

              <div>
                <div className="text-sm font-bold flex items-center gap-2">
                  <span>Pessimistic rating</span>
                  <InlineMath math="\\mu - 3\\sigma" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-4 h-4 cursor-help worm-muted" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Conservative lower bound we use as the pessimistic rating.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <DataNumber tone={dataTone}>{rating.exposed.toFixed(2)}</DataNumber>
                {pessimisticEquation && (
                  <div className="text-xs font-mono mt-1">
                    <InlineMath math={pessimisticEquation} />
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-bold flex items-center gap-2">
                  <span>Leaderboard score</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-4 h-4 cursor-help worm-muted" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Display ranking (scaled from μ ≈ 0–50). Higher scores rank higher.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <DataNumber tone={dataTone}>{rating.displayScore.toFixed(0)}</DataNumber>
                <div className="text-xs font-mono mt-1">
                  Scaled from TrueSkill rating for display.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-3 text-sm mt-2">
              <div>
                <div className="font-bold">Games</div>
                <DataNumber size="lg" tone={dataTone}>
                  {rating.gamesPlayed}
                </DataNumber>
              </div>
              <div>
                <div className="font-bold">Wins</div>
                <DataNumber size="lg" tone={dataTone}>
                  {rating.wins}
                </DataNumber>
              </div>
              <div>
                <div className="font-bold">Losses</div>
                <DataNumber size="lg" tone={dataTone}>
                  {rating.losses}
                </DataNumber>
              </div>
              <div>
                <div className="font-bold">Ties</div>
                <DataNumber size="lg" tone={dataTone}>
                  {rating.ties}
                </DataNumber>
              </div>
              <div>
                <div className="font-bold flex items-center gap-1">
                  <span>Testing cost</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-4 h-4 cursor-help worm-muted" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs">
                      Total USD spent testing this model via LLM API calls.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="worm-pill-neutral px-2.5 py-0.5 text-sm">
                  ${rating.totalCost.toFixed(4)}
                </span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-md border bg-white/80 text-xs worm-border">
              <div className="font-semibold mb-1">TrueSkill legend</div>
              <div className="space-y-1">
                <div>
                  <InlineMath math="\\mu" /> : skill estimate.
                </div>
                <div>
                  <InlineMath math="\\sigma" /> : uncertainty (spread of the estimate).
                </div>
                <div>
                  <InlineMath math="\\mu - 3\\sigma" /> : conservative lower bound.
                </div>
                <div>
                  Numbers shown in the colored pill highlight are live metrics pulled directly from Worm Arena games.
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
