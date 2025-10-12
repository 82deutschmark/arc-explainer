/**
 * IterationDataTable.tsx
 *
 * Author: Cascade using Sonnet 4.5
 * Date: 2025-10-11
 * PURPOSE: Professional data table for progressive reasoning iterations.
 * Clean, tabular interface showing iteration metrics at a glance.
 * Similar to financial terminals, research notebooks, analytics dashboards.
 * 
 * SRP/DRY check: Pass - Displays iteration data in table format
 * shadcn/ui: Pass - Uses shadcn/ui Table, Badge components
 */

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import type { ExplanationData } from '@/types/puzzle';
import type { ARCExample, ModelConfig } from '@shared/types';

interface IterationRow {
  id: string;
  iterationNumber: number; // This should be 1-indexed display number
  content: ExplanationData;
  timestamp: string;
}

interface IterationDataTableProps {
  iterations: IterationRow[];
  testCases: ARCExample[];
  models?: ModelConfig[];
}

export const IterationDataTable: React.FC<IterationDataTableProps> = ({
  iterations,
  testCases,
  models
}) => {
  const [expandedRow, setExpandedRow] = React.useState<string | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 border-b border-gray-200">
            <TableHead className="w-12 px-2"></TableHead>
            <TableHead className="w-24 px-3 font-semibold text-left">Iter #</TableHead>
            <TableHead className="w-32 px-3 font-semibold text-left">Model</TableHead>
            <TableHead className="w-28 px-3 font-semibold text-center">Result</TableHead>
            <TableHead className="w-24 px-3 font-semibold text-center">Confidence</TableHead>
            <TableHead className="w-28 px-3 font-semibold text-right">Reasoning</TableHead>
            <TableHead className="px-3 font-semibold text-left">Pattern Summary</TableHead>
            <TableHead className="w-36 px-3 font-semibold text-right">Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {iterations.map((iteration) => {
            const isExpanded = expandedRow === iteration.id;
            const isCorrect = iteration.content.hasMultiplePredictions
              ? iteration.content.multiTestAllCorrect === true
              : iteration.content.isPredictionCorrect === true;

            const patternSummary = iteration.content.patternDescription
              ? (iteration.content.patternDescription.length > 100
                ? iteration.content.patternDescription.substring(0, 100) + '...'
                : iteration.content.patternDescription)
              : 'No pattern';

            return (
              <React.Fragment key={iteration.id}>
                {/* Main Row */}
                <TableRow className={`${isCorrect ? 'bg-green-50/30' : 'bg-red-50/30'} hover:bg-gray-50 border-b border-gray-200`}>
                  <TableCell className="px-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRow(iteration.id)}
                      className="h-6 w-6 p-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  
                  <TableCell className="px-3 font-mono text-sm font-medium">
                    #{iteration.iterationNumber}
                  </TableCell>
                  
                  <TableCell className="px-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      {iteration.content.modelName}
                    </Badge>
                  </TableCell>
                  
                  <TableCell className="px-3">
                    <div className="flex justify-center">
                      {isCorrect ? (
                        <Badge className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Correct
                        </Badge>
                      ) : (
                        <Badge className="bg-red-600">
                          <XCircle className="h-3 w-3 mr-1" />
                          Incorrect
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell className="px-3 text-center">
                    <span className="font-mono text-sm">
                      {iteration.content.confidence || 0}%
                    </span>
                  </TableCell>
                  
                  <TableCell className="px-3 text-right">
                    {iteration.content.reasoningTokens ? (
                      <span className="font-mono text-sm text-purple-700">
                        {iteration.content.reasoningTokens.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </TableCell>
                  
                  <TableCell className="px-3 text-sm text-gray-700">
                    {patternSummary}
                  </TableCell>
                  
                  <TableCell className="px-3 text-right text-xs text-gray-500">
                    {new Date(iteration.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </TableCell>
                </TableRow>

                {/* Expanded Details Row */}
                {isExpanded && (
                  <TableRow className="border-b border-gray-200">
                    <TableCell colSpan={8} className="bg-gray-50 p-6">
                      <AnalysisResultCard
                        result={iteration.content}
                        modelKey={iteration.content.modelName}
                        model={models?.find(m => m.key === iteration.content.modelName)}
                        testCases={testCases}
                        eloMode={false}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
