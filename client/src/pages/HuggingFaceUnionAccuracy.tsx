/**
 * Author: Cascade
 * Date: 2025-12-16 (updated 2025-12-17)
 * PURPOSE: Visualization page for official ARC Prize team evaluation harness results (posted on Hugging Face).
 * Clarifies that ARC Explainer is a visualization tool for raw JSON data on the public evaluation set (not semi-private).
 * Explains union scoring at user level: two independent attempts per puzzle; for each test pair, either attempt being correct
 * counts the pair as solved; each puzzle score is the fraction of its test pairs solved; dataset score is the average of puzzle
 * scores (each puzzle weighted equally). Also explains why the "Test Pairs" metric differs and why users see numbers like
 * 117 solved test pairs out of 166 total.
 * Reuses: parseAttemptModelName(), compareService + useAttemptUnionComparison().
 * Prominent attribution: Hugging Face link, ARC Prize team credit, clarification this is not a personal evaluation tool.
 * SRP/DRY check: Pass - Orchestrates focused components/hooks; avoids duplicated request-building and UI blocks.
 * shadcn/ui: Pass - Uses Card, Select, Badge, Progress, Alert, Button, Table.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

import { useAvailableModels, useModelDatasetMetrics } from '@/hooks/useModelDatasetPerformance';
import { usePageMeta } from '@/hooks/usePageMeta';
import { parseAttemptModelName } from '@/utils/modelComparison';
import { useAttemptUnionComparison } from '@/hooks/useAttemptUnionComparison';
import { AttemptUnionStats } from './AnalyticsOverview';
import { UnionAccuracyHeader } from '@/components/huggingFaceUnionAccuracy/UnionAccuracyHeader';
import { UnionAccuracyControls, AttemptPairOption } from '@/components/huggingFaceUnionAccuracy/UnionAccuracyControls';
import { UnionAccuracyExplainers } from '@/components/huggingFaceUnionAccuracy/UnionAccuracyExplainers';
import { HarnessDetailsAccordion } from '@/components/huggingFaceUnionAccuracy/HarnessDetailsAccordion';
import { AttemptUnionCard } from '@/components/analytics/AttemptUnionCard';

interface AttemptGroup {
  baseModelName: string;
  attempts: Array<{
    modelName: string;
    attemptNumber: number;
  }>;
}

export default function HuggingFaceUnionAccuracy() {
  usePageMeta({
    title: 'Official Results: Multiple Attempts – ARC Explainer',
    description:
      'Official Hugging Face test results showing model performance with 2 independent attempts per puzzle. View best-case accuracy across ARC-AGI evaluation datasets.',
    canonicalPath: '/scoring',
  });

  const [selectedDataset, setSelectedDataset] = useState<string>('evaluation2'); // Default to ARC2-Eval
  const [selectedAttemptPair, setSelectedAttemptPair] = useState<string | null>(null);
  const [showEvaluationSetDetails, setShowEvaluationSetDetails] = useState(false);

  const { models: availableModels, loading: loadingModels } = useAvailableModels();

  // Filter to HF official models only (those with -attempt1, -attempt2 pattern)
  const hfModels = useMemo(() => {
    return availableModels.filter(
      (modelName) => modelName.endsWith('-attempt1') || modelName.endsWith('-attempt2')
    );
  }, [availableModels]);

  // Group HF models by base name
  const attemptGroups = useMemo(() => {
    const groups = new Map<string, AttemptGroup>();

    hfModels.forEach((modelName) => {
      const parsed = parseAttemptModelName(modelName);
      if (parsed) {
        if (!groups.has(parsed.baseModelName)) {
          groups.set(parsed.baseModelName, {
            baseModelName: parsed.baseModelName,
            attempts: [],
          });
        }
        groups.get(parsed.baseModelName)!.attempts.push({
          modelName,
          attemptNumber: parsed.attemptNumber,
        });
      }
    });

    return Array.from(groups.values());
  }, [hfModels]);

  // Create attempt pair options (only groups with 2+ attempts)
  const attemptPairOptions: AttemptPairOption[] = useMemo(() => {
    const preferredDefaultBaseModels = [
      'gpt-5-2-2025-12-11-thinking-high',
    ];

    const options: AttemptPairOption[] = attemptGroups
      .filter((group) => group.attempts.length >= 2)
      .map((group) => {
        const sorted = [...group.attempts].sort((a, b) => a.attemptNumber - b.attemptNumber);
        const modelNames = sorted.map((a) => a.modelName);
        return {
          label: `${group.baseModelName} (Attempt 1 + 2)`,
          value: group.baseModelName,
          baseModelName: group.baseModelName,
          modelNames,
        };
      });

    options.sort((a, b) => {
      const prefA = preferredDefaultBaseModels.indexOf(a.baseModelName);
      const prefB = preferredDefaultBaseModels.indexOf(b.baseModelName);

      const rankA = prefA === -1 ? Number.POSITIVE_INFINITY : prefA;
      const rankB = prefB === -1 ? Number.POSITIVE_INFINITY : prefB;

      if (rankA !== rankB) return rankA - rankB;
      return a.baseModelName.localeCompare(b.baseModelName);
    });

    return options;
  }, [attemptGroups]);

  // Get cost metrics for selected model
  const selectedModelName = useMemo(() => {
    if (!selectedAttemptPair) return null;
    const selectedPair = attemptPairOptions.find((opt) => opt.value === selectedAttemptPair);
    return selectedPair?.modelNames[0] || null;
  }, [selectedAttemptPair, attemptPairOptions]);

  const { metrics: costMetrics } = useModelDatasetMetrics(selectedModelName, selectedDataset);

  // Auto-select first pair (which is ordered to prefer GPT-5.2 High)
  useEffect(() => {
    if (!selectedAttemptPair && attemptPairOptions.length > 0) {
      setSelectedAttemptPair(attemptPairOptions[0].value);
    }
  }, [attemptPairOptions, selectedAttemptPair]);

  const selectedAttemptModelNames = useMemo((): [string, string] | null => {
    if (!selectedAttemptPair) return null;
    const selectedPair = attemptPairOptions.find((opt) => opt.value === selectedAttemptPair);
    if (!selectedPair || selectedPair.modelNames.length < 2) return null;
    return [selectedPair.modelNames[0], selectedPair.modelNames[1]];
  }, [attemptPairOptions, selectedAttemptPair]);

  const {
    unionMetrics,
    unionPuzzleIds,
    loading,
    error,
  } = useAttemptUnionComparison({
    dataset: selectedDataset,
    attemptModelNames: selectedAttemptModelNames,
  });

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="max-w-7xl mx-auto space-y-2">
        <UnionAccuracyHeader
          showEvaluationSetDetails={showEvaluationSetDetails}
          onToggleEvaluationSetDetails={() => setShowEvaluationSetDetails(!showEvaluationSetDetails)}
        />

        <UnionAccuracyControls
          selectedDataset={selectedDataset}
          onDatasetChange={setSelectedDataset}
          selectedAttemptPair={selectedAttemptPair}
          onAttemptPairChange={setSelectedAttemptPair}
          attemptPairOptions={attemptPairOptions}
          loadingModels={loadingModels}
          disabled={loading}
        />

        {error && (
          <Alert variant="destructive" className="p-2">
            <AlertCircle className="h-3 w-3" />
            <AlertDescription className="text-base ml-2">{error}</AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {loading && (
          <Card className="shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-base text-gray-600 mt-2">Computing...</p>
            </CardContent>
          </Card>
        )}

        {unionMetrics && !loading && (
          <div className="space-y-2">
            <AttemptUnionCard
              metrics={unionMetrics as unknown as AttemptUnionStats}
              variant="detailed"
              unionPuzzleIds={unionPuzzleIds}
            />

            <UnionAccuracyExplainers
              unionMetrics={unionMetrics as unknown as AttemptUnionStats}
              totalPairsForDisplay={
                (unionMetrics.datasetTotalTestPairs ??
                  unionMetrics.totalTestPairs ??
                  unionMetrics.datasetTotalPuzzles ??
                  unionMetrics.totalPuzzles) as number
              }
            />

            {/* Cost & Performance Metrics */}
            {costMetrics && (
              <Card className="shadow-sm border-green-200 bg-green-50/30">
                <CardContent className="p-3">
                  {/* Keep existing layout by reusing the original cost block semantics */}
                  <div className="text-base font-semibold text-gray-900 mb-2">Cost & Performance Metrics</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white rounded p-2 border border-green-100">
                      <div className="text-xs text-gray-600 mb-1">Total Cost</div>
                      <div className="text-lg font-bold text-gray-900">
                        ${costMetrics.overall.totalCost.toFixed(4)}
                      </div>
                    </div>
                    <div className="bg-white rounded p-2 border border-green-100">
                      <div className="text-xs text-gray-600 mb-1">Cost per Puzzle</div>
                      <div className="text-lg font-bold text-gray-900">
                        ${costMetrics.overall.avgCost.toFixed(4)}
                      </div>
                    </div>
                    <div className="bg-white rounded p-2 border border-green-100">
                      <div className="text-xs text-gray-600 mb-1">Cost per Correct</div>
                      <div className="text-lg font-bold text-green-700">
                        ${costMetrics.correct.avgCost.toFixed(4)}
                      </div>
                    </div>
                    <div className="bg-white rounded p-2 border border-green-100">
                      <div className="text-xs text-gray-600 mb-1">Avg Time</div>
                      <div className="text-lg font-bold text-gray-900">
                        {(costMetrics.overall.avgTime / 1000).toFixed(2)}s
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Empty State - Minimal */}
        {!loading && !unionMetrics && !error && (
          <Card className="shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-base text-gray-500">Select a dataset and a model pair above to see their performance on the public evaluation set. By default, it has been set to Claude Haiku 4.5 with maximum thinking enabled. That was the same model who coded this page. (With a LOT of human oversight!)</p>
            </CardContent>
          </Card>
        )}
        <HarnessDetailsAccordion />
      </div>
    </div>
  );
}
