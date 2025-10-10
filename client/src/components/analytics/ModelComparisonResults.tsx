/**
 * Author: Cascade using GPT-4
 * Date: 2025-10-10
 * PURPOSE: Renders the results of a multi-model comparison on a dataset using a matrix table.
 * Inspired by PuzzleFeedback.tsx Model Performance Matrix for consistent UX.
 * SRP and DRY check: Pass - This component has the single responsibility of displaying comparison results.
 * shadcn/ui: Pass - Uses shadcn/ui components (Card) and simple HTML table for matrix.
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
import { ModelComparisonResult } from '@/pages/AnalyticsOverview';
import { Database } from 'lucide-react';

interface ModelComparisonResultsProps {
  result: ModelComparisonResult;
}

export const ModelComparisonResults: React.FC<ModelComparisonResultsProps> = ({ result }) => {
  if (!result) return null;

  const { summary, details } = result;
  const activeModels = [
    { name: summary.model1Name, key: 'model1' },
    { name: summary.model2Name, key: 'model2' },
    ...(summary.model3Name ? [{ name: summary.model3Name, key: 'model3' as const }] : []),
    ...(summary.model4Name ? [{ name: summary.model4Name, key: 'model4' as const }] : []),
  ];

  // Collect unique puzzle IDs
  const puzzleIds = details.map(d => d.puzzleId);

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm flex items-center gap-1">
          <Database className="h-3 w-3" />
          Model Comparison Matrix
        </CardTitle>
        <p className="text-xs text-gray-600">
          ✅ = Correct, ❌ = Incorrect, ⏳ = Not Attempted
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 px-3 font-semibold bg-gray-50 sticky left-0 z-10">Model</th>
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
                <tr key={model.key} className="border-b hover:bg-gray-100 transition-colors">
                  <td className="py-2 px-3 font-medium truncate max-w-[200px] bg-white sticky left-0 z-10 border-r" title={model.name}>
                    <span className="text-sm">{model.name}</span>
                  </td>
                  {details.map((detail) => {
                    const result = model.key === 'model1' ? detail.model1Result
                                 : model.key === 'model2' ? detail.model2Result
                                 : model.key === 'model3' ? detail.model3Result
                                 : detail.model4Result;
                    
                    return (
                      <td key={detail.puzzleId} className="text-center py-2 px-2">
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
