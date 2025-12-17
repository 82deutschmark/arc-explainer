/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Model selection table showing W/L ratio vs. TrueSkill rating side-by-side.
 *          Allows selecting a primary model and (optionally) a reference model for comparison.
 *          Uses safe client-side sorting and stable React keys.
 * SRP/DRY check: Pass — single responsibility for model selection UI. Reuses shadcn/ui Table.
 *
 * Touches: WormArenaSkillAnalysis.tsx (parent), shared/types.ts (SnakeBenchTrueSkillLeaderboardEntry)
 */

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, ArrowUp, ArrowDown } from 'lucide-react';

export interface WormArenaSkillSelectorProps {
  models: Array<{
    modelSlug: string;
    mu: number;
    sigma: number;
    exposed: number;
    wins: number;
    losses: number;
    ties: number;
    gamesPlayed: number;
  }>;
  selectedModelSlug: string;
  onSelectModel: (slug: string) => void;

  // Reference model selector
  referenceModelSlug?: string;
  onSelectReference?: (slug: string) => void;
}

type SortColumn = 'trueskill' | 'winrate' | 'games' | 'model';
type SortDirection = 'asc' | 'desc';

/**
 * Renders a sortable table of models with W/L and TrueSkill columns side-by-side.
 *
 * Key feature: Shows the contradiction between W/L ratio and TrueSkill rating,
 * teaching users why TrueSkill accounts for opponent strength.
 *
 * Columns:
 * - Model: slug name
 * - W/L Ratio: "32W–12L (73%)"
 * - TrueSkill: exposed rating (the leaderboard rank)
 * - Games: total games played
 *
 * TODO for next developer:
 * 1. Implement sorting by TrueSkill (default), W/L %, or games
 * 2. Highlight rows where W/L % and TrueSkill contradict (high W/L, low TS or vice versa)
 * 3. Make rows clickable to select a model
 * 4. Add reference model dropdown (top-5 by default)
 * 5. Use table pattern from WormArenaTrueSkillLeaderboard.tsx as reference
 *
 * Reference implementations:
 * - WormArenaTrueSkillLeaderboard.tsx lines 131–303 for table layout and sorting
 * - Look at how WormArenaModelListCard does selection
 */
export default function WormArenaSkillSelector({
  models,
  selectedModelSlug,
  onSelectModel,
  referenceModelSlug,
  onSelectReference,
}: WormArenaSkillSelectorProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('trueskill');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedModels = useMemo(() => {
    return [...models].sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortColumn) {
        case 'trueskill':
          aVal = a.exposed;
          bVal = b.exposed;
          break;
        case 'winrate':
          aVal = a.gamesPlayed > 0 ? a.wins / a.gamesPlayed : 0;
          bVal = b.gamesPlayed > 0 ? b.wins / b.gamesPlayed : 0;
          break;
        case 'games':
          aVal = a.gamesPlayed;
          bVal = b.gamesPlayed;
          break;
        case 'model':
        default:
          return a.modelSlug.localeCompare(b.modelSlug);
      }

      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [models, sortColumn, sortDirection]);

  const topModels = useMemo(() => {
    return [...models].sort((a, b) => b.exposed - a.exposed).slice(0, 5);
  }, [models]);

  // Calculate median exposed rating to detect contradictions
  const medianExposed = useMemo(() => {
    const sorted = [...models].map((m) => m.exposed).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] || 0;
  }, [models]);

  // Detect contradiction: high W/L but low TrueSkill or vice versa
  const hasContradiction = (model: (typeof models)[0]): boolean => {
    const winRate = model.gamesPlayed > 0 ? model.wins / model.gamesPlayed : 0;
    const isHighWinRate = winRate > 0.65;
    const isLowTrueSkill = model.exposed < medianExposed - 5; // More than 5 below median
    const isLowWinRate = winRate < 0.45;
    const isHighTrueSkill = model.exposed > medianExposed + 5; // More than 5 above median

    return (isHighWinRate && isLowTrueSkill) || (isLowWinRate && isHighTrueSkill);
  };

  return (
    <div className="space-y-4">
      {/* Reference Model Selector */}
      {onSelectReference && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-worm-ink">Compare to:</label>
          <Select value={referenceModelSlug || ''} onValueChange={onSelectReference}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select reference model" />
            </SelectTrigger>
            <SelectContent>
              {topModels.map((model) => (
                <SelectItem key={model.modelSlug} value={model.modelSlug}>
                  {model.modelSlug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Model Table */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-worm-track/30 sticky top-0">
              <TableHead
                className="cursor-pointer hover:bg-worm-track/50 transition-colors"
                onClick={() => handleSort('model')}
              >
                <div className="flex items-center gap-1">
                  <span>Model</span>
                  {sortColumn === 'model' && (
                    sortDirection === 'desc' ? (
                      <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUp className="w-3 h-3" />
                    )
                  )}
                </div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-worm-track/50 transition-colors">
                <div
                  className="flex items-center gap-1"
                  onClick={() => handleSort('winrate')}
                >
                  <span>W/L Ratio</span>
                  {sortColumn === 'winrate' && (
                    sortDirection === 'desc' ? (
                      <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUp className="w-3 h-3" />
                    )
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-worm-muted cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-xs">
                      Win/Loss ratio shows how often this model wins, but doesn't account for opponent strength.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-worm-track/50 transition-colors"
                onClick={() => handleSort('trueskill')}
              >
                <div className="flex items-center gap-1">
                  <span>TrueSkill Rating</span>
                  {sortColumn === 'trueskill' && (
                    sortDirection === 'desc' ? (
                      <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUp className="w-3 h-3" />
                    )
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3 h-3 text-worm-muted cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-xs">
                      TrueSkill adjusts for opponent strength. Higher rating = better skill against stronger opponents.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-worm-track/50 transition-colors"
                onClick={() => handleSort('games')}
              >
                <div className="flex items-center gap-1">
                  <span>Games</span>
                  {sortColumn === 'games' && (
                    sortDirection === 'desc' ? (
                      <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUp className="w-3 h-3" />
                    )
                  )}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedModels.map((model) => {
              const winRate = model.gamesPlayed > 0 ? (model.wins / model.gamesPlayed) * 100 : 0;
              const isSelected = model.modelSlug === selectedModelSlug;
              const contradiction = hasContradiction(model);

              const contradictionTooltip = contradiction
                ? winRate > 65
                  ? 'High win rate but lower TrueSkill—likely plays weaker opponents'
                  : 'Lower win rate but higher TrueSkill—wins against stronger opponents'
                : undefined;

              return (
                <Tooltip key={model.modelSlug}>
                  <TooltipTrigger asChild>
                    <TableRow
                      onClick={() => onSelectModel(model.modelSlug)}
                      className={`cursor-pointer hover:bg-worm-track/20 transition-colors ${
                        isSelected ? 'bg-worm-green/10 border-l-2 border-l-worm-green' : ''
                      } ${contradiction ? 'bg-amber-50 border-l-2 border-l-amber-400' : ''}`}
                    >
                      <TableCell className="font-mono font-semibold text-worm-ink">
                        {model.modelSlug}
                      </TableCell>
                      <TableCell className="font-mono">
                        {model.wins}W–{model.losses}L ({winRate.toFixed(1)}%)
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-worm-green">
                        {model.exposed.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-worm-muted">{model.gamesPlayed}</TableCell>
                    </TableRow>
                  </TooltipTrigger>
                  {contradictionTooltip && (
                    <TooltipContent side="left" className="text-xs max-w-xs">
                      {contradictionTooltip}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Educational callout */}
      <div className="text-xs text-worm-muted bg-blue-50 p-2.5 rounded border border-blue-100">
        <strong className="text-worm-ink">Why the difference?</strong> TrueSkill accounts for opponent strength.
        A model with lower W/L% might have higher TrueSkill if it played stronger opponents.
      </div>
    </div>
  );
}
