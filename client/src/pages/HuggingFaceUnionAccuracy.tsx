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

  // Auto-select 9th pair if available, otherwise first pair
  useEffect(() => {
    if (!selectedAttemptPair && attemptPairOptions.length > 0) {
      const ninthPair = attemptPairOptions.length >= 9 ? attemptPairOptions[8] : attemptPairOptions[0];
      setSelectedAttemptPair(ninthPair.value);
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
          <AlertDescription className="text-xs text-amber-900 ml-2 space-y-1">
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

        {/* Public vs Semi-Private Explainer - Collapsible */}
        <Card className="shadow-sm border-teal-200 bg-teal-50/80">
          <button
            onClick={() => setShowEvaluationSetDetails(!showEvaluationSetDetails)}
            className="w-full text-left p-3 flex items-center justify-between hover:bg-teal-100/50 transition-colors"
          >
            <h3 className="text-sm font-semibold text-teal-900">
              📚 Learn about the three different datasets
            </h3>
            {showEvaluationSetDetails ? (
              <ChevronUp className="h-4 w-4 text-teal-700" />
            ) : (
              <ChevronDown className="h-4 w-4 text-teal-700" />
            )}
          </button>

          {showEvaluationSetDetails && (
            <CardContent className="p-3 space-y-2 border-t border-teal-200">
              <p className="text-xs text-teal-800 mb-2">
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
                .
              </p>

              <div className="space-y-2 text-xs text-teal-900">
                <div className="bg-white rounded p-2 border border-teal-100">
                  <div className="font-semibold text-teal-700 mb-1">📊 Public Set (This Page)</div>
                  <p className="mb-1 text-teal-900">Everyone can see these puzzles.</p>
                  <ul className="list-disc list-inside space-y-0.5 text-teal-900 text-xs">
                    <li>Shared on GitHub and Hugging Face for anyone to use</li>
                    <li>Major AI companies (like OpenAI, Google, Anthropic, Grok) can study and learn from these puzzles</li>
                    <li>No secrets—everyone knows what they are</li>
                  </ul>
                </div>

                <div className="bg-white rounded p-2 border border-teal-100">
                  <div className="font-semibold text-teal-700 mb-1">🔒 Semi-Private Set (Official Leaderboard)</div>
                  <p className="mb-1 text-teal-900">The ARC team keeps these secret.</p>
                  <ul className="list-disc list-inside space-y-0.5 text-teal-900 text-xs">
                    <li>Not published anywhere—only the ARC team has them</li>
                    <li>Used to rank models fairly on the official leaderboard</li>
                    <li>Models haven't trained on these (hopefully!)</li>
                  </ul>
                </div>

                <div className="bg-white rounded p-2 border border-teal-100">
                  <div className="font-semibold text-teal-700 mb-1">🏆 Private Set (Contest)</div>
                  <p className="mb-1 text-teal-900">Super secret puzzles for the competition.</p>
                  <ul className="list-disc list-inside space-y-0.5 text-teal-900 text-xs">
                    <li>Only used during the ARC Prize contest</li>
                    <li>Completely hidden until after the contest ends</li>
                    <li>No one can study these puzzles beforehand</li>
                  </ul>
                </div>
              </div>

              <div className="bg-white rounded p-2 border border-teal-100 text-xs text-teal-800">
                <p className="mb-1">
                  <strong>Why scores differ:</strong> These two puzzle sets contain <strong>completely different puzzles</strong>. That's why you'll see different scores on this page (public set) compared to the official ARC Prize leaderboard (semi-private set). Sometimes scores are higher here, sometimes lower—it all depends on how well each particular set of puzzles matches the model's strengths.
                </p>
                <p className="text-teal-700 mt-1">
                  💡 The key point: <strong>Different datasets = Different puzzles = Different results</strong>. You can't directly compare scores between these pages because you're looking at two separate evaluation datasets.
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
                      <SelectItem value="no-models" disabled className="text-xs">
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
                {/* Big Number with Puzzle Badges on same line */}
                <div className="flex items-start justify-between mb-2 gap-3">
                  <div>
                    <div className="text-3xl font-bold text-blue-700">
                      {unionMetrics.unionAccuracyPercentage.toFixed(1)}%
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">Score (either attempt correct)</p>
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
                <div className="border-t border-blue-100 pt-2 flex flex-wrap gap-1">
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

          </div>
        )}

        {/* Empty State - Minimal */}
        {!loading && !unionMetrics && !error && (
          <Card className="shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-gray-500">Select a dataset and a model pair above to see their performance on the public evaluation set. By default, it has been set to Claude Sonnet 4.5 with maximum thinking enabled. That was the same model who coded this page and put a little smiley face 😊.</p>
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
              <div className="text-sm font-semibold text-purple-700">🔬 How the Official Testing Harness Works</div>
            </div>
            {showHarnessDetails ? (
              <ChevronUp className="h-4 w-4 text-purple-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-purple-600" />
            )}
          </div>

          {showHarnessDetails && (
            <CardContent className="p-3 border-t border-purple-100 text-xs text-gray-700 leading-relaxed space-y-2">
              <div className="bg-purple-50 p-2 rounded">
                <strong className="text-purple-900">1️⃣ The System Prompt</strong>
                <p className="text-gray-700 mt-1">
                  Every model receives the same instructions: <em>"You are participating in a puzzle solving competition. You are an expert at solving puzzles."</em>
                  Then: <em>"Below is a list of input and output pairs with a pattern. Your goal is to identify the pattern or transformation in the training examples that maps the input to the output, then apply that pattern to the test input to give a final output."</em>
                  The prompt also says: <em>"Respond in the format of the training output examples."</em> This tells the model exactly what it needs to do and how to format its answer.
                </p>
              </div>

              <div className="bg-purple-50 p-2 rounded">
                <strong className="text-purple-900">2️⃣ Training Examples</strong>
                <p className="text-gray-700 mt-1">
                  Next, the harness sends the model several training examples. Each example shows:
                </p>
                <ul className="list-disc list-inside text-gray-700 ml-1 mt-1">
                  <li>An <strong>input</strong> grid of numbers</li>
                  <li>The corresponding <strong>output</strong> grid</li>
                </ul>
                <p className="text-gray-700 mt-1">
                  Both are formatted as <strong>raw JSON arrays</strong> (structured data). The numbers are integers, and the model receives them purely as data. For example, a 3×3 grid looks like: <code className="bg-white px-1 py-0.5 rounded border border-gray-300">{`[[0, 1, 2], [3, 4, 5], [6, 7, 8]]`}</code>
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
                  Everything — the initial prompt, all training examples, and the test input — is packaged into <strong>one single message</strong> sent to the model.
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
                <ul className="list-disc list-inside text-gray-700 ml-1 mt-1">
                  <li>Does the model's <strong>attempt 1 output exactly match</strong> the ground truth? ✓</li>
                  <li>Does the model's <strong>attempt 2 output exactly match</strong> the ground truth? ✓</li>
                </ul>
                <p className="text-gray-700 mt-1">
                  <strong>The puzzle is marked correct if EITHER attempt is correct.</strong> This is the union accuracy you see on this page.
                  This scoring method is fair because it shows what a model can achieve when given multiple chances — realistic for many real-world applications.
                </p>
              </div>

              <div className="border-t border-purple-200 pt-2 mt-2">
                <p className="text-gray-600 text-xs">
                  <strong>Bottom line:</strong> The official evaluation harness is a simple, fair system: it gives each model the same puzzle, the same training examples,
                  and two independent attempts to solve it. This process repeats for every puzzle in the dataset, and the results shown on this page are exactly
                  what the ARC Prize team posted on Hugging Face — no modifications or custom scoring.
                </p>
              </div>

              <div className="border-t border-purple-200 pt-2 mt-2 text-xs text-gray-500">
                <p>
                  <strong>About this explanation:</strong> All text on this page was written by either Claude Sonnet 4.5 or Haiku 4.5 after researching the actual Arc-AGI-Benchmarking source code, reading system prompts, and analyzing the implementation. The content was refined through iterative feedback with an actual human familiar with ARC, and several corrections were made along the way to ensure accuracy.
                </p>
                <p className="mt-2 text-gray-600">
                  <strong>Note on data leakage:</strong> This AI was trained on public ARC-AGI materials and learned that the numbers in ARC tasks represent colors (0=black, 1=blue, 2=red, etc.). However, this information is NOT documented in the official evaluation harness code—the harness is completely agnostic to what the integers mean. This is an example of how information about the structure of ARC tasks has leaked into public training data, which is precisely why the semi-private and fully-private evaluation sets exist and remain secret.
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
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
