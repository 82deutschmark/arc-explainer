/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-14T00:00:00Z
 * PURPOSE: Trading card style component for ARC puzzles inspired by 1980s baseball cards.
 * Shows puzzle grid prominently with nickname, official ID, dataset "team", and win/loss record.
 * Expands on click to show detailed stats including which models failed the puzzle.
 * Reuses TinyGrid, Badge components, and lazy loading patterns from PuzzleCard.
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
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
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
                  <div className="text-gray-400">
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
                <div className="text-gray-400 text-sm">Loading puzzle...</div>
              </div>
            )}

            {/* Puzzle Name (Large, Bold) */}
            {hasName && puzzleName ? (
              <div className="text-center space-y-1">
                <h3 className="text-3xl font-black uppercase tracking-tight text-gray-900">
                  {puzzleName}
                </h3>
                <code className="text-xs font-mono text-gray-500">#{puzzle.id}</code>
              </div>
            ) : (
              <div className="text-center">
                <code className="text-xl font-mono font-bold text-gray-900">#{puzzle.id}</code>
              </div>
            )}

            {/* Win/Loss Record - Baseball Card Style */}
            <div className="bg-white rounded-lg p-4 shadow-sm border-2 border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className={`h-5 w-5 ${stats.wins > stats.losses ? 'text-yellow-500' : 'text-gray-400'}`} />
                  <span className="text-sm font-semibold text-gray-600">Record vs. LLMs</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black text-gray-900 font-mono">
                    {stats.record}
                  </span>
                  <Badge variant={stats.badgeVariant} className="font-semibold">
                    {stats.performanceDesc}
                  </Badge>
                </div>
              </div>

              {/* Quick Stats Row */}
              <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-around text-center">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Wins</div>
                  <div className="text-lg font-bold text-green-600">{stats.wins}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Losses</div>
                  <div className="text-lg font-bold text-red-600">{stats.losses}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Attempts</div>
                  <div className="text-lg font-bold text-blue-600">{stats.totalAttempts}</div>
                </div>
              </div>
            </div>

            {/* Expand Button */}
            {stats.totalAttempts > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition-colors ${
                  isExpanded
                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
              <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                Detailed Performance Stats
              </h4>

              {/* Performance Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg Accuracy</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {(stats.avgAccuracy * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Models</div>
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.modelsAttempted.length}
                  </div>
                </div>
              </div>

              {/* Models That Failed */}
              {stats.modelsAttempted.length > 0 && (
                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-red-500" />
                    <h5 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      Models Attempted ({stats.modelsAttempted.length})
                    </h5>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {stats.modelsAttempted.map((modelName, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {modelName}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Metrics if Available */}
              {puzzle.performanceData && (
                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                  <h5 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                    Additional Metrics
                  </h5>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {puzzle.performanceData.avgConfidence !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Avg Confidence:</span>
                        <span className="font-semibold">
                          {puzzle.performanceData.avgConfidence.toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {puzzle.performanceData.negativeFeedback !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Negative Feedback:</span>
                        <span className="font-semibold">{puzzle.performanceData.negativeFeedback}</span>
                      </div>
                    )}
                    {puzzle.performanceData.compositeScore !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Difficulty Score:</span>
                        <span className="font-semibold">
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
