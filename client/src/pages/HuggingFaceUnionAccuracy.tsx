/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-11-24T00:00:00Z
 * PURPOSE: Visualization page for official ARC Prize team evaluation harness results (posted on Hugging Face).
 * Clarifies that ARC Explainer is a visualization tool for raw JSON data on the public evaluation set (not semi-private).
 * Explains official scoring: models tested twice per puzzle, puzzle solved if either attempt correct = best-case performance.
 * Reuses: computeAttemptUnionAccuracy(), parseAttemptModelName(), /api/metrics/compare endpoint.
 * Prominent attribution: Hugging Face link, ARC Prize team credit, clarification this is not a personal evaluation tool.
 * SRP/DRY check: Pass - Composes existing utilities; no duplication.
 * shadcn/ui: Pass - Uses Card, Select, Badge, Progress, Alert, Button.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart3, ExternalLink, AlertCircle, Zap, AlertTriangle } from 'lucide-react';
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
import { useAvailableModels } from '@/hooks/useModelDatasetPerformance';
import { usePageMeta } from '@/hooks/usePageMeta';
import { computeAttemptUnionAccuracy, parseAttemptModelName } from '@/utils/modelComparison';
import { ModelComparisonResult } from './AnalyticsOverview';

const DATASET_DISPLAY_NAME_MAP: Record<string, string> = {
  evaluation: 'ARC1-Eval',
  training: 'ARC1-Train',
  evaluation2: 'ARC2-Eval',
  training2: 'ARC2-Train',
};

interface AttemptGroup {
  baseModelName: string;
  attempts: Array<{
    modelName: string;
    attemptNumber: number;
  }>;
}

interface AttemptPairOption {
  label: string;
  value: string;
  baseModelName: string;
  modelNames: string[];
}

interface UnionMetrics {
  baseModelName: string;
  attemptModelNames: string[];
  unionAccuracyPercentage: number;
  unionCorrectCount: number;
  totalPuzzles: number;
}

export default function HuggingFaceUnionAccuracy() {
  usePageMeta({
    title: 'Official Results: Multiple Attempts – ARC Explainer',
    description:
      'Official Hugging Face test results showing model performance with 2 independent attempts per puzzle. View best-case accuracy across ARC-AGI evaluation datasets.',
    canonicalPath: '/hf-union-accuracy',
  });

  const [selectedDataset, setSelectedDataset] = useState<string>('evaluation2'); // Default to ARC2-Eval
  const [selectedAttemptPair, setSelectedAttemptPair] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unionMetrics, setUnionMetrics] = useState<UnionMetrics | null>(null);
  const [unionPuzzleIds, setUnionPuzzleIds] = useState<string[]>([]);

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
  const attemptPairOptions = useMemo(() => {
    return attemptGroups
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
  }, [attemptGroups]);

  // Auto-select first pair if available
  useEffect(() => {
    if (!selectedAttemptPair && attemptPairOptions.length > 0) {
      setSelectedAttemptPair(attemptPairOptions[0].value);
    }
  }, [attemptPairOptions, selectedAttemptPair]);

  // Fetch comparison data
  const handleFetchUnionAccuracy = async () => {
    if (!selectedDataset || !selectedAttemptPair) {
      setError('Please select both a dataset and attempt pair');
      return;
    }

    setLoading(true);
    setError(null);
    setUnionMetrics(null);
    setUnionPuzzleIds([]);

    try {
      const selectedPair = attemptPairOptions.find((opt) => opt.value === selectedAttemptPair);
      if (!selectedPair) {
        throw new Error('Selected attempt pair not found');
      }

      const params = new URLSearchParams({
        model1: selectedPair.modelNames[0],
        model2: selectedPair.modelNames[1],
        dataset: selectedDataset,
      });

      const response = await fetch(`/api/metrics/compare?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to fetch comparison data');
      }

      const result = await response.json();
      if (!result.data) {
        throw new Error('No data received from server');
      }

      const comparisonData: ModelComparisonResult = result.data;
      const metrics = computeAttemptUnionAccuracy(comparisonData, [0, 1]);

      // Extract puzzle IDs for union
      const unionIds: string[] = [];
      if (comparisonData.details) {
        comparisonData.details.forEach((detail) => {
          if (detail.model1Result === 'correct' || detail.model2Result === 'correct') {
            unionIds.push(detail.puzzleId);
          }
        });
      }

      setUnionMetrics({
        baseModelName: selectedPair.baseModelName,
        attemptModelNames: selectedPair.modelNames,
        ...metrics,
      });
      setUnionPuzzleIds(unionIds);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch union accuracy data';
      setError(message);
      console.error('Union accuracy fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="max-w-7xl mx-auto space-y-2">
        {/* Header - Compact */}
        <div className="bg-blue-50 border-l-4 border-blue-600 p-3 rounded">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Official Scoring: Public Evaluation
          </h1>
          <p className="text-xs text-gray-600 mt-1">
            Official results from the ARC Prize evaluation harness on the public evaluation set (not semi-private)
          </p>
        </div>

        {/* Important Disclaimer */}
        <Alert className="border-amber-300 bg-amber-50 p-2 border-l-4 border-l-amber-600">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-xs text-amber-900 ml-2">
            <strong>📢 Important:</strong> These are <strong>OFFICIAL results from the ARC Prize team's evaluation harness</strong> — not personal evaluations.
            The ARC Prize team conducted these official tests and posted the results on{' '}
            <a
              href="https://huggingface.co/datasets/arcprize/arc_agi_v2_public_eval"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-amber-700 underline hover:text-amber-800"
            >
              Hugging Face
              <ExternalLink className="inline h-3 w-3 ml-0.5" />
            </a>
            {' '}in raw JSON format.
            ARC Explainer is simply a visualization tool that makes this official raw data more human-readable, searchable, and visual. All credits and data ownership belong to the ARC Prize team.
          </AlertDescription>
        </Alert>

        {/* What This Page Shows */}
        <Alert className="border-blue-200 bg-blue-50/80 p-2">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-xs text-blue-900 ml-2">
            <strong>What is this page?</strong> This page visualizes official test results from the ARC Prize team's evaluation harness using the <strong>public</strong> evaluation set
            (different from the semi-private set used on the official ARC Prize website). Each model was run twice per puzzle.
            This shows the <strong>best-case score</strong>: how many puzzles each model solves <strong>if we count a puzzle correct whenever either attempt was correct</strong>.
            {' '}
            <a
              href="https://huggingface.co/datasets/arcprize/arc_agi_v2_public_eval/tree/main"
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 underline font-medium"
            >
              View raw data on Hugging Face
              <ExternalLink className="inline h-3 w-3 ml-0.5" />
            </a>
          </AlertDescription>
        </Alert>

        {/* Controls - Compact */}
        <Card className="shadow-sm">
          <CardContent className="p-3 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-semibold mb-1 block text-gray-700">Dataset:</label>
                <Select value={selectedDataset} onValueChange={setSelectedDataset} disabled={loading}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    {['evaluation2', 'evaluation', 'training2', 'training'].map((key) => (
                      <SelectItem key={key} value={key} className="text-xs">
                        {DATASET_DISPLAY_NAME_MAP[key] || key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold mb-1 block text-gray-700">Model (Attempt 1 + 2):</label>
                <Select value={selectedAttemptPair || ''} onValueChange={setSelectedAttemptPair} disabled={loading}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={loadingModels ? 'Loading...' : 'Choose...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {attemptPairOptions.length === 0 ? (
                      <SelectItem value="" disabled className="text-xs">
                        No models with 2+ attempts
                      </SelectItem>
                    ) : (
                      attemptPairOptions.map((pair) => (
                        <SelectItem key={pair.value} value={pair.value} className="text-xs">
                          {pair.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={handleFetchUnionAccuracy}
                  disabled={!selectedDataset || !selectedAttemptPair || loading || attemptPairOptions.length === 0}
                  size="sm"
                  className="w-full h-8 text-xs"
                >
                  {loading ? 'Computing...' : 'Calculate'}
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="p-2">
                <AlertCircle className="h-3 w-3" />
                <AlertDescription className="text-xs ml-2">{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {loading && (
          <Card className="shadow-sm">
            <CardContent className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-xs text-gray-600 mt-2">Computing...</p>
            </CardContent>
          </Card>
        )}

        {unionMetrics && !loading && (
          <div className="space-y-2">
            {/* Main Result Card - Compact */}
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50/50 shadow-sm">
              <CardContent className="p-3">
                {/* Big Number */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-3xl font-bold text-blue-700">
                      {unionMetrics.unionAccuracyPercentage.toFixed(1)}%
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">Score (either attempt correct)</p>
                  </div>
                  <Zap className="h-6 w-6 text-blue-500" />
                </div>

                {/* The Equation - Shown Clearly */}
                <div className="bg-white rounded p-2 mb-2 border border-blue-100 text-xs space-y-1">
                  <div className="text-gray-700">
                    <span className="font-bold">Best-Case Score</span> = (Puzzles correct in attempt 1 <strong>or</strong> attempt 2) ÷ Total puzzles
                  </div>
                  <div className="text-gray-600">
                    = <span className="font-semibold">{unionMetrics.unionCorrectCount} puzzles</span> ÷ <span className="font-semibold">{unionMetrics.totalPuzzles} total</span>
                  </div>
                  <div className="text-blue-700 font-bold">
                    = <span className="text-lg">{unionMetrics.unionAccuracyPercentage.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Quick Progress Bar */}
                <Progress
                  value={(unionMetrics.unionCorrectCount / unionMetrics.totalPuzzles) * 100}
                  className="h-2 mb-1"
                />
                <p className="text-xs text-gray-700">
                  <strong>{unionMetrics.unionCorrectCount}</strong> of <strong>{unionMetrics.totalPuzzles}</strong> puzzles solved
                </p>

                {/* Model Names */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {unionMetrics.attemptModelNames.map((name) => (
                    <Badge key={name} variant="outline" className="text-xs py-0.5">
                      {name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Explanation in Simple Terms */}
            <Card className="shadow-sm">
              <CardContent className="p-2">
                <div className="text-xs text-gray-700 leading-relaxed space-y-1">
                  <div>
                    <strong>📊 Official Scoring Method:</strong>
                  </div>
                  <div>
                    The ARC Prize team's evaluation harness tests each model <strong>twice independently</strong> on each puzzle.
                    For each puzzle, if <strong>either</strong> attempt 1 <strong>or</strong> attempt 2 produces the correct answer, that puzzle counts as solved.
                    This is the official scoring method used to evaluate all models.
                  </div>
                  <div>
                    <strong>⚠️ Important:</strong> These results are from the <strong>public evaluation set</strong>, which is different from the semi-private evaluation set
                    used on the official ARC Prize website. Models typically score differently on these two datasets, so don't expect the numbers to match the official leaderboard.
                  </div>
                  <div className="text-gray-600">
                    <strong>💡 Why 2 attempts?</strong> This shows the model's potential when given multiple chances. One wrong answer doesn't mean the model can't solve the puzzle—
                    with a second try, it might succeed. This scoring method reveals the model's true capability.
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Puzzle List - Dense Grid */}
            {unionPuzzleIds.length > 0 && (
              <Card className="shadow-sm">
                <CardContent className="p-2">
                  <p className="text-xs font-semibold text-gray-700 mb-1">
                    ✓ Solved {unionPuzzleIds.length} puzzles (click to inspect):
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {unionPuzzleIds.map((puzzleId) => (
                      <ClickablePuzzleBadge
                        key={puzzleId}
                        puzzleId={puzzleId}
                        variant="success"
                        showName={true}
                        openInNewTab={true}
                      />
                    ))}
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
              <p className="text-xs text-gray-500">Select a dataset and model pair above to calculate union accuracy</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
