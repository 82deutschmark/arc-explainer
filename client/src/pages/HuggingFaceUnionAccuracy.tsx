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
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart3, ExternalLink, AlertCircle, Zap, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
import { useAvailableModels } from '@/hooks/useModelDatasetPerformance';
import { usePageMeta } from '@/hooks/usePageMeta';
import { computeAttemptUnionAccuracy, parseAttemptModelName } from '@/utils/modelComparison';
import { ModelComparisonResult } from './AnalyticsOverview';
import { TinyGrid } from '@/components/puzzle/TinyGrid';

const SYSTEM_PROMPT_SOURCES = [
  {
    key: 'gemini',
    label: 'Gemini 2.5 Pro (Apr 18, 2025)',
    url: 'https://raw.githubusercontent.com/elder-plinius/CL4R1T4S/main/GOOGLE/Gemini-2.5-Pro-04-18-2025.md',
  },
  {
    key: 'anthropic',
    label: 'Claude Sonnet 4.5 (Sep 29, 2025)',
    url: 'https://raw.githubusercontent.com/elder-plinius/CL4R1T4S/main/ANTHROPIC/Claude_Sonnet-4.5_Sep-29-2025.txt',
  },
  {
    key: 'openai',
    label: 'OpenAI ChatGPT5 (Aug 7, 2025)',
    url: 'https://raw.githubusercontent.com/elder-plinius/CL4R1T4S/main/OPENAI/ChatGPT5-08-07-2025.mkd',
  },
  {
    key: 'grok',
    label: 'Grok 4.1 (Nov 17, 2025)',
    url: 'https://raw.githubusercontent.com/elder-plinius/CL4R1T4S/main/XAI/GROK-4.1_Nov-17-2025.txt',
  },
];

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
    canonicalPath: '/scoring',
  });

  const [selectedDataset, setSelectedDataset] = useState<string>('evaluation2'); // Default to ARC2-Eval
  const [selectedAttemptPair, setSelectedAttemptPair] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unionMetrics, setUnionMetrics] = useState<UnionMetrics | null>(null);
  const [unionPuzzleIds, setUnionPuzzleIds] = useState<string[]>([]);
  const [showHarnessDetails, setShowHarnessDetails] = useState(true);
  const [showEvaluationSetDetails, setShowEvaluationSetDetails] = useState(false);
  const [systemPromptsVisible, setSystemPromptsVisible] = useState(false);
  const [systemPromptsLoading, setSystemPromptsLoading] = useState(false);
  const [systemPromptsError, setSystemPromptsError] = useState<string | null>(null);
  const [systemPromptsData, setSystemPromptsData] = useState<Record<string, string>>({});

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
    const preferredDefaultBaseModels = [
      'gpt-5-2-2025-12-11-thinking-high',
    ];

    const options = attemptGroups
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

  // Auto-select first pair (which is ordered to prefer GPT-5.2 High)
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

  // Auto-fetch results when default model is selected
  useEffect(() => {
    if (selectedDataset && selectedAttemptPair && !unionMetrics && !loading) {
      handleFetchUnionAccuracy();
    }
  }, [selectedAttemptPair, selectedDataset]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleFetchSystemPrompts = async () => {
    setSystemPromptsError(null);
    setSystemPromptsLoading(true);
    try {
      const entries = await Promise.all(
        SYSTEM_PROMPT_SOURCES.map(async (src) => {
          const resp = await fetch(src.url);
          if (!resp.ok) {
            throw new Error(`Failed to fetch ${src.label}`);
          }
          const text = await resp.text();
          return [src.key, text] as const;
        })
      );
      setSystemPromptsData(Object.fromEntries(entries));
      setSystemPromptsVisible(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load system prompts';
      setSystemPromptsError(message);
    } finally {
      setSystemPromptsLoading(false);
    }
  };

  useEffect(() => {
    handleFetchSystemPrompts();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="max-w-7xl mx-auto space-y-2">
        {/* Header - Compact */}
        <div className="bg-blue-50 border-l-4 border-blue-600 p-3 rounded">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Official Scoring: Public Evaluation
          </h1>
          <p className="text-base text-gray-600 mt-1">
            A community authored guide to the official results from the ARC Prize evaluation harness on the public evaluation set
          </p>
        </div>

        {/* Important Disclaimer */}
        <Alert className="border-amber-300 bg-amber-50 p-2 border-l-4 border-l-amber-600">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-xl text-amber-900 ml-2 space-y-1">
            <div>
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
            </div>
            <div>
              ⚠️ <strong>Key difference:</strong> Scores here are from the <strong>public evaluation set</strong> and will <strong>NOT match the official{' '}
              <a
                href="https://arcprize.org/leaderboard"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-amber-700 underline hover:text-amber-800"
              >
                ARC Prize leaderboard
                <ExternalLink className="inline h-3 w-3 ml-0.5" />
              </a>
              </strong>, which uses the semi-private evaluation set. The two datasets contain different puzzles, so models score differently on each.
            </div>
            <div>
              ARC Explainer is simply a visualization tool that makes this official raw data more human-readable, searchable, and visual. All credits and data ownership belong to the{' '}
              <a
                href="https://arcprize.org"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-amber-700 underline hover:text-amber-800"
              >
                ARC Prize team
                <ExternalLink className="inline h-3 w-3 ml-0.5" />
              </a>
              .
            </div>
          </AlertDescription>
        </Alert>

        {/* What This Page Shows */}
        <Alert className="border-blue-200 bg-blue-50/80 p-2">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-xl text-blue-900 ml-2">
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

        {/* Public vs Semi-Private Explainer - Collapsible */}
        <Card className="shadow-sm border-teal-200 bg-teal-50/80">
          <button
            onClick={() => setShowEvaluationSetDetails(!showEvaluationSetDetails)}
            className="w-full p-3 flex items-center justify-center gap-2 text-center hover:bg-teal-100/50 transition-colors"
          >
            <h3 className="text-base font-semibold text-teal-900">
              📚 Click here to learn about the three different datasets
            </h3>
            {showEvaluationSetDetails ? (
              <ChevronUp className="h-4 w-4 text-teal-700" />
            ) : (
              <ChevronDown className="h-4 w-4 text-teal-700" />
            )}
          </button>

          {showEvaluationSetDetails && (
            <CardContent className="p-3 space-y-2 border-t border-teal-200">
              <p className="text-base text-teal-800 mb-2">
                This is a <strong>friendly, simple explanation</strong>. For the official details, see the{' '}
                <a
                  href="https://arcprize.org/policy"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-teal-700 underline hover:text-teal-800"
                >
                  official ARC Prize policy
                  <ExternalLink className="inline h-3 w-3 ml-0.5" />
                </a>
                {' '}and the{' '}
                <a
                  href="https://arxiv.org/html/2412.04604v2"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-teal-700 underline hover:text-teal-800"
                >
                  ARC Prize 2025 evaluation overview (arXiv)
                  <ExternalLink className="inline h-3 w-3 ml-0.5" />
                </a>
                .
              </p>

              <div className="space-y-2 text-base text-teal-900">
                <div className="bg-white rounded p-2 border border-teal-100">
                  <div className="font-semibold text-teal-700 mb-1">📊 Public Set (This Page)</div>
                  <p className="mb-1 text-teal-900">Everyone can see these puzzles.</p>
                  <ul className="list-disc list-inside space-y-0.5 text-teal-900 text-base">
                    <li>Shared on GitHub and Hugging Face for anyone to use</li>
                    <li>Major AI companies (like OpenAI, Google, Anthropic, Grok) can study and learn from these puzzles</li>
                    <li>No secrets—everyone knows what they are</li>
                  </ul>
                </div>

                <div className="bg-white rounded p-2 border border-teal-100">
                  <div className="font-semibold text-teal-700 mb-1">🔒 Semi-Private Set (Official Leaderboard - Used for testing closed source models like OpenAI, Gemini, Anthropic, etc)</div>
                  <p className="mb-1 text-teal-900">The ARC team keeps these secret.</p>
                  <ul className="list-disc list-inside space-y-0.5 text-teal-900 text-base">
                    <li>Not published anywhere—only the ARC team has them</li>
                    <li>Used to rank models fairly on the official leaderboard</li>
                    <li>These are intended for testing remotely-hosted commercial models with low leakage probability. They are calibrated to the same human difficulty as public eval.</li>
                  </ul>
                </div>

                <div className="bg-white rounded p-2 border border-teal-100">
                  <div className="font-semibold text-teal-700 mb-1">🏆 Private Set (Contest)</div>
                  <p className="mb-1 text-teal-900">Super secret puzzles for the competition.</p>
                  <ul className="list-disc list-inside space-y-0.5 text-teal-900 text-base">
                    <li>Only used during the ARC Prize contest</li>
                    <li>Intended for testing self-contained models during the competition with “near-zero leakage probability”</li>
                    <li>No one can study these puzzles beforehand</li>
                  </ul>
                </div>
              </div>

              <div className="bg-white rounded p-2 border border-teal-100 text-base text-teal-800">
                <p className="mb-1">
                  <strong>Why scores differ:</strong> These two puzzle sets contain <strong>completely different puzzles</strong>. That's why you'll see different scores on this page (public set) compared to the official ARC Prize leaderboard (semi-private set). Sometimes scores are higher here, sometimes lower—it all depends on how well each particular set of puzzles matches the model's strengths.
                </p>
                <p className="text-teal-700 mt-1">
                  💡 The key point: 
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Controls - Compact */}
        <Card className="shadow-sm">
          <CardContent className="p-3 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="text-base font-semibold mb-1 block text-gray-700">Dataset:</label>
                <Select value={selectedDataset} onValueChange={setSelectedDataset} disabled={loading}>
                  <SelectTrigger className="h-8 text-base">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    {['evaluation2', 'evaluation', 'training2', 'training'].map((key) => (
                      <SelectItem key={key} value={key} className="text-base">
                        {DATASET_DISPLAY_NAME_MAP[key] || key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-base font-semibold mb-1 block text-gray-700">Model (Attempt 1 + 2):</label>
                <Select value={selectedAttemptPair || ''} onValueChange={setSelectedAttemptPair} disabled={loading}>
                  <SelectTrigger className="h-8 text-base">
                    <SelectValue placeholder={loadingModels ? 'Loading...' : 'Choose...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {attemptPairOptions.length === 0 ? (
                      <SelectItem value="no-models" disabled className="text-base">
                        No models with 2+ attempts
                      </SelectItem>
                    ) : (
                      attemptPairOptions.map((pair) => (
                        <SelectItem key={pair.value} value={pair.value} className="text-base">
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
                  className="w-full h-8 text-base"
                >
                  {loading ? 'Computing...' : 'Calculate'}
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="p-2">
                <AlertCircle className="h-3 w-3" />
                <AlertDescription className="text-base ml-2">{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

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
            {/* Main Result Card - Compact */}
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-50/50 shadow-sm">
              <CardContent className="p-3">
                {/* Big Number with Puzzle Badges on same line */}
                <div className="flex items-start justify-between mb-2 gap-3">
                  <div>
                    <div className="text-4xl font-bold text-blue-700">
                      {unionMetrics.unionAccuracyPercentage.toFixed(1)}%
                    </div>
                    <p className="text-base text-gray-600 mt-0.5">Score (either attempt correct)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    {unionPuzzleIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 max-w-xs justify-end">
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
                    )}
                    <Zap className="h-6 w-6 text-blue-500 flex-shrink-0" />
                  </div>
                </div>

                {/* The Equation - Shown Clearly */}
                <div className="bg-white rounded p-2 mb-2 border border-blue-100 text-base space-y-1">
                  <div className="text-gray-700">
                    <span className="font-bold">Best-Case Score</span> = (Puzzles correct in attempt 1 <strong>or</strong> attempt 2) ÷ Total puzzles
                  </div>
                  <div className="text-gray-600">
                    = <span className="font-semibold">{unionMetrics.unionCorrectCount} puzzles</span> ÷ <span className="font-semibold">{unionMetrics.totalPuzzles} total</span>
                  </div>
                  <div className="text-blue-700 font-bold">
                    = <span className="text-xl">{unionMetrics.unionAccuracyPercentage.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Quick Progress Bar */}
                <Progress
                  value={(unionMetrics.unionCorrectCount / unionMetrics.totalPuzzles) * 100}
                  className="h-2 mb-1"
                />
                <p className="text-base text-gray-700">
                  <strong>{unionMetrics.unionCorrectCount}</strong> of <strong>{unionMetrics.totalPuzzles}</strong> puzzles solved
                </p>

                {/* Model Names */}
                <div className="border-t border-blue-100 pt-2 flex flex-wrap gap-1">
                  {unionMetrics.attemptModelNames.map((name) => (
                    <Badge key={name} variant="outline" className="text-base py-0.5">
                      {name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Explanation in Simple Terms */}
            <Card className="shadow-sm">
              <CardContent className="p-2">
                <div className="text-base text-gray-700 leading-relaxed space-y-1">
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

        {/* How the Testing Harness Works - Expandable (Always visible) */}
        <Card className="shadow-sm border-purple-100">
          <div
            onClick={() => setShowHarnessDetails(!showHarnessDetails)}
            className="p-2 cursor-pointer hover:bg-purple-50 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <div className="text-base font-semibold text-purple-700">🔬 How the Official Testing Harness Works</div>
            </div>
            {showHarnessDetails ? (
              <ChevronUp className="h-4 w-4 text-purple-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-purple-600" />
            )}
          </div>

          {showHarnessDetails && (
            <CardContent className="p-3 border-t border-purple-100 text-base text-gray-700 leading-relaxed space-y-2">
              <div className="bg-purple-50 p-2 rounded">
                <strong className="text-purple-900">1️⃣ The User Message (No Explicit System Prompt)</strong>
                <p className="text-gray-700 mt-1">
                  <strong>Critical distinction:</strong> The harness does NOT send a separate system prompt. Instead, all instructions are embedded in the USER message. The model uses whatever DEFAULT system prompt the provider (OpenAI, Google, Anthropic, etc.) has configured. ({' '}
                  <a href="#provider-system-prompts" className="text-purple-600 underline hover:text-purple-700 font-medium">
                    view provider system prompts
                  </a>
                  {' '})
                </p>
                <p className="text-gray-700 mt-1">
                  The user message begins with: <em>"You are participating in a puzzle solving competition. You are an expert at solving puzzles."</em>
                  Then: <em>"Below is a list of input and output pairs with a pattern. Your goal is to identify the pattern or transformation in the training examples that maps the input to the output, then apply that pattern to the test input to give a final output."</em>
                  And: <em>"Respond in the format of the training output examples."</em> These instructions are part of the USER message, not a system prompt, which means they carry less weight than if they were sent as a system-level instruction. This is important for reproducibility: researchers replicating this harness with a different system prompt may see different results.
                </p>
              </div>

              <div className="bg-purple-50 p-2 rounded">
                <strong className="text-purple-900">2️⃣ Training Examples</strong>
                <p className="text-gray-700 mt-1">
                  Next, the harness sends the model several training examples. Each example shows:
                </p>
                <ul className="list-disc list-inside text-gray-700 ml-1 mt-1 text-base">
                  <li>An <strong>input</strong> grid of numbers</li>
                  <li>The corresponding <strong>output</strong> grid</li>
                </ul>
                <p className="text-gray-700 mt-1">
                  Both are formatted as <strong>raw JSON arrays</strong> (structured data). The numbers are integers, and the model receives them purely as data. For example, a 3×3 grid looks like: <code className="bg-white px-1 py-0.5 rounded border border-gray-300">{`[[0, 1, 2], [3, 4, 5], [6, 7, 8]]`}</code>
                </p>

                {/* Visual vs Text Representation */}
                <div className="bg-white rounded p-2 border border-purple-200 mt-2">
                  <div className="text-base text-gray-600 font-semibold mb-2">What humans see vs what the model sees:</div>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Human View */}
                    <div>
                      <div className="text-base font-semibold text-gray-700 mb-1">👁️ What YOU see (colored grid):</div>
                      <div style={{ maxWidth: '120px', margin: '0 auto' }}>
                        <TinyGrid grid={[[0, 1, 2], [3, 4, 5], [6, 7, 8]]} />
                      </div>
                    </div>

                    {/* Model View */}
                    <div>
                      <div className="text-base font-semibold text-gray-700 mb-1">🤖 What the MODEL sees (text):</div>
                      <code className="block bg-gray-900 text-green-400 p-2 rounded text-base font-mono overflow-x-auto">
                        {`[[0, 1, 2],
 [3, 4, 5],
 [6, 7, 8]]`}
                      </code>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2 text-base text-amber-900">
                    <strong>⚠️ Critical insight:</strong> While humans interpret this colored grid intuitively, the model sees <strong>only plain text</strong>—numbers in brackets. 
                  </div>

                  <div className="mt-2 text-base text-gray-700 leading-relaxed">
                    <p><strong>What information does the model actually receive?</strong></p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>The user message tells it there's a "pattern" to find</li>
                      <li>It sees training input/output pairs as JSON arrays</li>
                      <li>It sees a test input without an answer</li>
                      <li>That's <strong>it</strong>. No information about colors, no hints about geometry, no explanation of what the numbers represent.</li>
                    </ul>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2 text-base text-blue-900">
                    <strong>💡 Why this matters:</strong> This is the sort of thing we discuss in our Discord server. Please come visit us at {' '}
                    <a
                      href="https://discord.gg/9b77dPAmcA"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-blue-700 underline hover:text-blue-800"
                    >
                      The Offical ARC-AGI Prize Discord server
                    </a>
                    .
                  </div>
                </div>

                <p className="text-gray-700 mt-2">
                  Each training example shows the model how inputs map to outputs.
                </p>
              </div>

              <div className="bg-purple-50 p-2 rounded">
                <strong className="text-purple-900">3️⃣ The Test Input</strong>
                <p className="text-gray-700 mt-1">
                  After showing the training examples, the harness presents a <strong>test input</strong> — a single grid (also in JSON format) with no answer attached.
                  The model must look at the training examples and predict what the output grid should be.
                </p>
              </div>

              <div className="bg-purple-50 p-2 rounded">
                <strong className="text-purple-900">4️⃣ How the Message is Sent</strong>
                <p className="text-gray-700 mt-1">
                  Everything — the instructions, all training examples, and the test input — is packaged into <strong>one single USER message</strong> sent to the model.
                  <strong> No system prompt is sent.</strong> The model uses the provider's default system prompt (if any) plus the user message. This is a critical distinction because instructions in a user message have less influence than the same instructions in a system prompt. Researchers replicating this harness might see different results if they add or change the system prompt.
                </p>
                <p className="text-gray-700 mt-1">
                  The model receives this complete context in one go and must respond with its predicted output grid. This happens twice per puzzle (attempt 1 and attempt 2)
                  with fresh, independent runs so the model can try different reasoning strategies.
                </p>
              </div>

              <div className="bg-purple-50 p-2 rounded">
                <strong className="text-purple-900">5️⃣ The Model's Response</strong>
                <p className="text-gray-700 mt-1">
                  The model generates its predicted output as a grid in JSON format. The harness then <strong>extracts this grid answer</strong> from the model's response
                  and compares it exactly to the ground truth answer for that puzzle.
                </p>
              </div>

              <div className="bg-purple-50 p-2 rounded">
                <strong className="text-purple-900">6️⃣ Scoring: Did the Model Get It Right?</strong>
                <p className="text-gray-700 mt-1">
                  For each puzzle, the harness checks:
                </p>
                <ul className="list-disc list-inside text-gray-700 ml-1 mt-1 text-base">
                  <li>Does the model's <strong>attempt 1 output exactly match</strong> the ground truth? ✓</li>
                  <li>Does the model's <strong>attempt 2 output exactly match</strong> the ground truth? ✓</li>
                </ul>
                <p className="text-gray-700 mt-1">
                  <strong>The puzzle is then recorded as correct if EITHER attempt is correct.</strong> 
                </p>
              </div>

              <div className="border-t border-purple-200 pt-2 mt-2 bg-gray-50 rounded p-2">
                <div className="text-base space-y-2">
                  <strong className="text-gray-900 block">📋 TL;DR: How It Actually Works (For Developers)</strong>
                  <div className="bg-white rounded p-1.5 border border-gray-200 font-mono text-gray-700 text-base space-y-1">
                    <div><span className="text-blue-600">1.</span> <span className="font-semibold">Load data:</span> Read training pairs & test input from task JSON</div>
                    <div><span className="text-blue-600">2.</span> <span className="font-semibold">Convert grids:</span> Turn each grid into JSON array via json.dumps()</div>
                    <div><span className="text-blue-600">3.</span> <span className="font-semibold">Build user message:</span> Substitute arrays + instructions into template → ONE text string</div>
                    <div><span className="text-blue-600">4.</span> <span className="font-semibold">Send to API:</span> messages=[{'{role: "user", content: prompt}'}] ← NO system prompt sent; model uses provider's default system prompt + user message</div>
                    <div><span className="text-blue-600">5.</span> <span className="font-semibold">Get response:</span> Model returns text (usually containing JSON array)</div>
                    <div><span className="text-blue-600">6.</span> <span className="font-semibold">Extract answer:</span> Parse JSON from response text</div>
                    <div><span className="text-blue-606">7.</span> <span className="font-semibold">Compare:</span> Check if extracted array exactly matches ground truth</div>
                  </div>
                  <div className="text-gray-600 text-base italic mt-1">
                    <strong>Critical distinction:</strong> NO system prompt is sent to the API. Instructions are embedded in the USER message, so they compete with the provider's default system prompt. This affects reproducibility—researchers adding their own system prompt may get different results.
                  </div>
                </div>
              </div>

              <div className="border-t border-purple-200 pt-2 mt-2">
                <p className="text-gray-600 text-base">
                  <strong>Bottom line:</strong> The official evaluation harness is a simple, fair system: it gives each model the same puzzle, the same training examples,
                  and two independent attempts to solve it. This process repeats for every puzzle in the dataset, and the results shown on this page are exactly
                  what the ARC Prize team posted on Hugging Face — no modifications or custom scoring.
                </p>
              </div>

              <div className="border-t border-purple-200 pt-2 mt-2 text-base text-gray-500">
                <p>
                  <strong>About this explanation:</strong> Most text this page was written by Claude Haiku 4.5 after A lot of back-and-forth with the human who maintains this project.  It involved researching the actual ARC-AGI-Benchmarking source code, reading system prompts, and analyzing the implementation. The content was refined through iterative feedback and several corrections were made along the way to ensure accuracy.
                </p>
                <p className="mt-2 text-gray-600">
                  <strong>Note on data leakage from human reviewer:</strong> The AI used to generate this page and these explanations was trained on public ARC-AGI materials and learned that the numbers in ARC tasks represent colors (0=black, 1=blue, 2=red, etc.). However, this information is NOT documented in the official evaluation harness code—the harness is completely agnostic to what the integers mean. I had to personally review every word written on this page and request changes multiple times to correct inaccuracies that my large-language model coding assistant was inferring from its training data. This is an example of how information about the structure of ARC tasks has leaked into public training data, which is precisely why the semi-private and fully-private evaluation sets exist and remain secret. 
                </p>
                <p className="mt-2">
                  If you find any errors or missing information, please report them on our{' '}
                  <a
                    href="https://discord.gg/9b77dPAmcA"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-purple-600 underline hover:text-purple-700"
                  >
                    Discord server
                  </a>
                  .
                </p>

                <div id="provider-system-prompts" className="border-t border-purple-200 pt-3 mt-3 space-y-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-base font-semibold text-gray-800">Provider system prompts (developer note)</span>
                    <span className="text-base text-gray-600">
                      All major provider system prompts can be read at{' '}
                      <a
                        className="text-purple-700 underline font-semibold"
                        href="https://github.com/elder-plinius/CL4R1T4S/tree/main"
                        target="_blank"
                        rel="noreferrer"
                      >
                        github.com/elder-plinius/CL4R1T4S
                      </a>
                      . These are the defaults providers may apply when no custom system prompt is supplied. Grok notes that system messages take precedence over user messages; the impact on ARC harness testing is unknown.
                    </span>
                  </div>

                  {systemPromptsError && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                      {systemPromptsError}
                    </div>
                  )}

                  {systemPromptsLoading && !systemPromptsVisible && (
                    <div className="text-xs text-gray-600">Loading latest provider prompts…</div>
                  )}

                  {systemPromptsVisible && (
                    <div className="grid gap-2 md:grid-cols-2">
                      {SYSTEM_PROMPT_SOURCES.map((src) => {
                        const content = systemPromptsData[src.key] || 'Not loaded';
                        return (
                          <div key={src.key} className="border border-gray-200 rounded p-2 bg-white">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-base font-semibold text-gray-800">{src.label}</span>
                              <a
                                href={src.url.replace('raw.githubusercontent.com', 'github.com').replace('/main/', '/blob/main/')}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-purple-700 underline"
                              >
                                View on GitHub
                              </a>
                            </div>
                            <pre className="text-xs text-gray-700 bg-gray-50 rounded p-2 overflow-x-auto max-h-52 whitespace-pre-wrap">
                              {content}
                            </pre>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
