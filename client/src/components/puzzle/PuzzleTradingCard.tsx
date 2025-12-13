/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-14T00:00:00Z / Updated 2025-11-15
 * PURPOSE: Trading card style component for ARC puzzles inspired by 1980s baseball cards.
 * Shows puzzle grid prominently with nickname, official ID, dataset "team", and win/loss record.
 * Expands on click to show detailed stats including which models failed the puzzle.
 * Reuses TinyGrid, Badge components, and lazy loading patterns from PuzzleCard.
 * UPDATED: Made text VIBRANT and COLORFUL for authentic 1980s trading card aesthetic!
 * Uses bright blues, purples, pinks, oranges - NO MORE BORING GRAY!
 *
 * SRP/DRY check: Pass - Single responsibility for trading card display, reuses existing components
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { TinyGrid } from './TinyGrid';
import { Badge } from '@/components/ui/badge';
import { getPuzzleName, hasPuzzleName } from '@shared/utils/puzzleNames';
import { formatPuzzleStats } from '@/utils/puzzleCardHelpers';
import type { PuzzleStatsRecord } from '@/hooks/usePuzzleStats';
import type { ARCTask } from '@shared/types';
import { ChevronDown, ChevronUp, Trophy, Target, Brain } from 'lucide-react';

interface PuzzleTradingCardProps {
  puzzle: PuzzleStatsRecord;
}

export const PuzzleTradingCard: React.FC<PuzzleTradingCardProps> = ({ puzzle }) => {
  const [taskData, setTaskData] = useState<ARCTask | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const puzzleName = getPuzzleName(puzzle.id);
  const hasName = hasPuzzleName(puzzle.id);
  const stats = formatPuzzleStats(puzzle);

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!cardRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '200px' }
    );

    observer.observe(cardRef.current);

    return () => observer.disconnect();
  }, []);

  // Load puzzle data when visible
  useEffect(() => {
    if (!isVisible || taskData) return;

    fetch(`/api/puzzle/task/${puzzle.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTaskData(data.data);
        }
      })
      .catch(() => {
        // Silent fail - just don't show grid
      });
  }, [isVisible, puzzle.id, taskData]);

  const firstTrainingExample = taskData?.train?.[0];

  return (
    <div ref={cardRef} className="w-full">
      {/* Card Container with Team Color Border */}
      <div
        className={`relative rounded-2xl bg-gradient-to-br ${stats.colors.borderGradient} p-1 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl`}
      >
        {/* Card Inner */}
        <div
          className={`relative rounded-xl bg-gradient-to-br ${stats.colors.backgroundGradient} overflow-hidden`}
        >
          {/* Card Front */}
          <div className="p-6 space-y-4">
            {/* Header: Team Name Badge */}
            <div className="flex items-start justify-between">
              <Badge
                className={`${stats.colors.accentColor} text-white font-bold uppercase text-xs tracking-wider px-3 py-1`}
              >
                {stats.teamName}
              </Badge>
              <Link href={`/puzzle/${puzzle.id}`}>
                <a
                  className="text-xs text-blue-600 hover:text-purple-600 underline font-bold"
                  onClick={(e) => e.stopPropagation()}
                >
                  View Details →
                </a>
              </Link>
            </div>

            {/* Puzzle Grid - Prominently Displayed */}
            {firstTrainingExample ? (
              <div className="bg-white rounded-xl p-4 shadow-md border-2 border-white">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-32 h-32 flex items-center justify-center">
                    <TinyGrid grid={firstTrainingExample.input} />
                  </div>
                  <div className="text-orange-500">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <div className="w-32 h-32 flex items-center justify-center">
                    <TinyGrid grid={firstTrainingExample.output} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl p-4 shadow-md border-2 border-white h-40 flex items-center justify-center">
                <div className="text-purple-600 text-sm font-bold animate-pulse">Loading puzzle...</div>
              </div>
            )}

            {/* Puzzle Name (Large, Bold) */}
            {hasName && puzzleName ? (
              <div className="text-center space-y-1">
                <h3 className="text-3xl font-black uppercase tracking-tight bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {puzzleName}
                </h3>
                <code className="text-xs font-mono text-purple-600 font-bold">{puzzle.id}</code>
              </div>
            ) : (
              <div className="text-center">
                <code className="text-xl font-mono font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{puzzle.id}</code>
              </div>
            )}

            {/* Win/Loss Record - Baseball Card Style */}
            <div className="bg-white rounded-lg p-4 shadow-sm border-2 border-purple-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className={`h-5 w-5 ${stats.wins > stats.losses ? 'text-yellow-500' : 'text-orange-500'}`} />
                  <span className="text-sm font-bold text-blue-600">Record vs. LLMs</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black text-purple-700 font-mono">
                    {stats.record}
                  </span>
                  <Badge variant={stats.badgeVariant} className="font-semibold">
                    {stats.performanceDesc}
                  </Badge>
                </div>
              </div>

              {/* Quick Stats Row */}
              <div className="mt-3 pt-3 border-t border-purple-200 flex items-center justify-around text-center">
                <div>
                  <div className="text-xs text-emerald-600 uppercase tracking-wide font-bold">Wins</div>
                  <div className="text-lg font-black text-green-600">{stats.wins}</div>
                </div>
                <div>
                  <div className="text-xs text-rose-600 uppercase tracking-wide font-bold">Losses</div>
                  <div className="text-lg font-black text-red-600">{stats.losses}</div>
                </div>
                <div>
                  <div className="text-xs text-sky-600 uppercase tracking-wide font-bold">Attempts</div>
                  <div className="text-lg font-black text-blue-600">{stats.totalAttempts}</div>
                </div>
              </div>
            </div>

            {/* Expand Button */}
            {stats.totalAttempts > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-colors ${
                  isExpanded
                    ? 'bg-purple-200 text-purple-700 hover:bg-purple-300'
                    : `bg-gradient-to-r ${stats.colors.borderGradient} text-white hover:opacity-90`
                }`}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide Detailed Stats
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Show Detailed Stats
                  </>
                )}
              </button>
            )}
          </div>

          {/* Expanded Details - Card Back */}
          {isExpanded && stats.totalAttempts > 0 && (
            <div className="border-t-2 border-white bg-white/50 p-6 space-y-4 backdrop-blur-sm">
              <h4 className="text-lg font-black text-purple-700 flex items-center gap-2">
                <Brain className="h-5 w-5 text-pink-600" />
                Detailed Performance Stats
              </h4>

              {/* Performance Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3 shadow-sm border-2 border-blue-200">
                  <div className="text-xs text-sky-600 uppercase tracking-wide mb-1 font-black">Avg Accuracy</div>
                  <div className="text-2xl font-black text-blue-600">
                    {(stats.avgAccuracy * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 shadow-sm border-2 border-purple-200">
                  <div className="text-xs text-fuchsia-600 uppercase tracking-wide mb-1 font-black">Total Models</div>
                  <div className="text-2xl font-black text-purple-600">
                    {stats.modelsAttemptedCount}
                  </div>
                </div>
              </div>

              {/* Models Attempted Count - Optimized to show count instead of individual badges */}
              {stats.modelsAttemptedCount > 0 && (
                <div className="bg-white rounded-lg p-4 shadow-sm border-2 border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-orange-600" />
                    <h5 className="text-sm font-black text-orange-600 uppercase tracking-wide">
                      Models Attempted
                    </h5>
                  </div>
                  <div className="text-2xl font-black text-purple-600">
                    {stats.modelsAttemptedCount} unique models tested
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    View puzzle details for full model list
                  </div>
                </div>
              )}

              {/* Cost & Resources Block */}
              {puzzle.performanceData && stats.totalAttempts > 0 && (
                puzzle.performanceData.avgCost != null ||
                puzzle.performanceData.avgTotalTokens != null ||
                puzzle.performanceData.avgProcessingTime != null
              ) && (
                <div className="bg-white rounded-lg p-4 shadow-sm border-2 border-green-200">
                  <h5 className="text-sm font-black text-emerald-600 uppercase tracking-wide mb-3">
                    💰 Cost & Resources
                  </h5>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {/* Total Spend Approx */}
                    {puzzle.performanceData.avgCost != null && puzzle.performanceData.avgCost > 0 && (
                      <div className="bg-green-50 rounded-lg p-2">
                        <div className="text-xs text-emerald-600 font-bold mb-0.5">Total Spend</div>
                        <div className="text-lg font-black text-green-700">
                          ${(puzzle.performanceData.avgCost * stats.totalAttempts).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">≈ {stats.totalAttempts} attempts</div>
                      </div>
                    )}
                    {/* Avg Cost per Attempt */}
                    {puzzle.performanceData.avgCost != null && puzzle.performanceData.avgCost > 0 && (
                      <div className="bg-blue-50 rounded-lg p-2">
                        <div className="text-xs text-blue-600 font-bold mb-0.5">Avg Cost</div>
                        <div className="text-lg font-black text-blue-700">
                          ${puzzle.performanceData.avgCost.toFixed(3)}
                        </div>
                        <div className="text-xs text-gray-500">per attempt</div>
                      </div>
                    )}
                    {/* Avg Total Tokens per Attempt */}
                    {puzzle.performanceData.avgTotalTokens != null && puzzle.performanceData.avgTotalTokens > 0 && (
                      <div className="bg-indigo-50 rounded-lg p-2">
                        <div className="text-xs text-indigo-600 font-bold mb-0.5">Avg Tokens</div>
                        <div className="text-lg font-black text-indigo-700">
                          {puzzle.performanceData.avgTotalTokens >= 1000
                            ? `${(puzzle.performanceData.avgTotalTokens / 1000).toFixed(1)}K`
                            : Math.round(puzzle.performanceData.avgTotalTokens)}
                        </div>
                        <div className="text-xs text-gray-500">per attempt</div>
                      </div>
                    )}
                    {/* Avg Processing Time */}
                    {puzzle.performanceData.avgProcessingTime != null && puzzle.performanceData.avgProcessingTime > 0 && (
                      <div className="bg-violet-50 rounded-lg p-2">
                        <div className="text-xs text-violet-600 font-bold mb-0.5">Avg Time</div>
                        <div className="text-lg font-black text-violet-700">
                          {puzzle.performanceData.avgProcessingTime >= 1000
                            ? `${(puzzle.performanceData.avgProcessingTime / 1000).toFixed(1)}s`
                            : `${Math.round(puzzle.performanceData.avgProcessingTime)}ms`}
                        </div>
                        <div className="text-xs text-gray-500">per attempt</div>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-gray-500 text-center">
                    Resource usage metrics · Not difficulty scores
                  </div>
                </div>
              )}

              {/* Additional Metrics if Available */}
              {puzzle.performanceData && (
                <div className="bg-white rounded-lg p-4 shadow-sm border-2 border-pink-200">
                  <h5 className="text-sm font-black text-pink-600 uppercase tracking-wide mb-3">
                    Additional Metrics
                  </h5>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {puzzle.performanceData.avgConfidence !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-blue-600 font-bold">Avg Confidence:</span>
                        <span className="font-black text-purple-700">
                          {puzzle.performanceData.avgConfidence.toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {puzzle.performanceData.negativeFeedback !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-blue-600 font-bold">Negative Feedback:</span>
                        <span className="font-black text-purple-700">{puzzle.performanceData.negativeFeedback}</span>
                      </div>
                    )}
                    {puzzle.performanceData.compositeScore !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-blue-600 font-bold">Difficulty Score:</span>
                        <span className="font-black text-purple-700">
                          {puzzle.performanceData.compositeScore.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
