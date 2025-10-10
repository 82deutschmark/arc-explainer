/**
 * Author: Cascade
 * Date: 2025-10-10T19:00:00-04:00 (Updated for maximum density)
 * PURPOSE: Renders a CORRECT and EFFICIENT matrix for model comparison results with maximum information density.
 * This component replaces the flawed ModelComparisonResults.tsx.
 * 
 * FIXES:
 * - Correctly maps puzzles to columns and models to rows.
 * - Uses a Map for efficient O(1) lookup of puzzle results, fixing the nested loop issue.
 * - Ensures the table body cells align perfectly with the header columns.
 * 
 * DENSITY IMPROVEMENTS (2025-10-10):
 * - Reduced padding: CardHeader to pt-2 px-2 pb-1, CardContent to px-2 pb-2
 * - Reduced font sizes: text-sm→text-xs for title, text-xs→text-[10px] for legend
 * 
 * SRP and DRY check: Pass - Single responsibility is to render the comparison matrix.
 * shadcn/ui: Pass - Uses shadcn/ui components and follows project styling.
 */

import React, { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
import { ModelComparisonResult, PuzzleComparisonDetail } from '@/pages/AnalyticsOverview';
import { Database } from 'lucide-react';

interface NewModelComparisonResultsProps {
  result: ModelComparisonResult;
}

export const NewModelComparisonResults: React.FC<NewModelComparisonResultsProps> = ({ result }) => {
  if (!result) return null;

  const { summary, details } = result;
  const activeModels = [
    { name: summary.model1Name, key: 'model1Result' as const },
    { name: summary.model2Name, key: 'model2Result' as const },
    ...(summary.model3Name ? [{ name: summary.model3Name, key: 'model3Result' as const }] : []),
    ...(summary.model4Name ? [{ name: summary.model4Name, key: 'model4Result' as const }] : []),
  ].filter(m => m.name);

  const puzzleIds = useMemo(() => details.map(d => d.puzzleId), [details]);

  const detailsMap = useMemo(() => {
    return new Map<string, PuzzleComparisonDetail>(details.map(d => [d.puzzleId, d]));
  }, [details]);

  return (
    <Card>
      <CardHeader className="pb-1 pt-2 px-2">
        <CardTitle className="text-xs flex items-center gap-1">
          <Database className="h-3 w-3" />
          Model Comparison Matrix
        </CardTitle>
        <p className="text-[10px] text-gray-600">
          ✅ = Correct, ❌ = Incorrect, ⏳ = Not Attempted
        </p>
      </CardHeader>
      <CardContent className="pt-0 px-2 pb-2">
        <div className="overflow-x-auto relative">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 px-3 font-semibold bg-gray-100 sticky left-0 z-20 border-r">Model</th>
                {puzzleIds.map((puzzleId) => (
                  <th key={puzzleId} className="text-center py-2 px-2 font-medium min-w-[80px] bg-gray-50">
                    <ClickablePuzzleBadge 
                      puzzleId={puzzleId} 
                      clickable={true} 
                      showName={true}
                      className="text-xs font-mono"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeModels.map((model) => (
                <tr key={model.name} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="py-2 px-3 font-medium truncate max-w-[200px] bg-white sticky left-0 z-10 border-r" title={model.name}>
                    <span className="text-sm">{model.name}</span>
                  </td>
                  {/* CORRECT IMPLEMENTATION: Iterate over puzzleIds to ensure column alignment */}
                  {puzzleIds.map((puzzleId) => {
                    const detail = detailsMap.get(puzzleId);
                    const result = detail ? detail[model.key] : 'not_attempted';
                    
                    return (
                      <td key={`${model.name}-${puzzleId}`} className="text-center py-2 px-2 border-l">
                        <span className="text-lg" title={result}>
                          {result === 'correct' && '✅'}
                          {result === 'incorrect' && '❌'}
                          {result === 'not_attempted' && '⏳'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
