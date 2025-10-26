/**
 * Author: Claude Code using Sonnet 4, Cascade using Claude Sonnet 4.5
 * Date: 2025-09-28, Updated 2025-10-10
 * PURPOSE: PuzzleFeedback page allows users to test their own predicted grid solutions against ARC puzzles.
 * Reuses existing grid visualization and validation components for consistent UX with AI model results.
 * Users can paste grid arrays like [[0,8,8,8,0],[8,0,0,0,8]] and see immediate correct/incorrect feedback.
 * 
 * MAJOR IMPROVEMENTS (2025-10-10):
 * - MAXIMUM INFORMATION DENSITY: Matrix now shows only active models (filtered out inactive ones)
 * - Per-puzzle difficulty metrics with color-coded success rate badges
 * - Model performance summary columns (✅ correct, ❌ incorrect, % success rate)
 * - Enhanced summary stats: Active Models, Overall Success Rate, Total Attempts, Hard Puzzles count
 * - Uses ClickablePuzzleBadge components for consistent navigation
 * - Compact sticky header with puzzle IDs and success rates
 * - Replaced useless "Perfect Models" stats with actionable metrics
 * - Visual improvements: color-coded cells, minimal "·" for not-attempted
 * 
 * SRP and DRY check: Pass - Reuses existing validation logic, grid visualization, and puzzle lookup patterns.
 * shadcn/ui: Pass - Uses existing shadcn/ui components throughout.
 */

import React, { useState, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { usePuzzle } from '@/hooks/usePuzzle';
import { useSolutions } from '@/hooks/useSolutions';
import { useModels } from '@/hooks/useModels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Grid3X3, CheckCircle, XCircle, Copy, Lightbulb, Users, MessageSquare, Brain, Settings, Database, BarChart3, Search, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { ClickablePuzzleBadge } from '@/components/ui/ClickablePuzzleBadge';
import { usePuzzleListAnalysis } from '@/hooks/usePuzzleListAnalysis';
import type { ExplanationData } from '@/types/puzzle';
import { formatPuzzleDisplay } from '@shared/utils/puzzleNames';
import { Checkbox } from '@/components/ui/checkbox';

const LAST_MODEL_STORAGE_KEY = 'puzzleFeedback:lastModel';
const LAST_CUSTOM_MODEL_STORAGE_KEY = 'puzzleFeedback:lastCustomModel';

export default function PuzzleFeedback() {
  const { taskId: paramTaskId } = useParams<{ taskId?: string }>();
  const [, setLocation] = useLocation();

  // State for puzzle ID input and grid input
  const [puzzleId, setPuzzleId] = useState(paramTaskId || '');
  const [gridInput, setGridInput] = useState('');

  // Structured explanation form state
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(LAST_MODEL_STORAGE_KEY) || 'x-ai/grok-4';
    }
    return 'x-ai/grok-4';
  });

  const [customModelName, setCustomModelName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(LAST_CUSTOM_MODEL_STORAGE_KEY) || '';
    }
    return '';
  });

  const [patternDescription, setPatternDescription] = useState('');
  const [solvingStrategy, setSolvingStrategy] = useState('');
  const [hints, setHints] = useState('');
  const [confidence, setConfidence] = useState<number>(50);

  // Puzzle list analysis state
  const [puzzleListInput, setPuzzleListInput] = useState('');
  const { analyzePuzzleList, data: puzzleAnalysisData, isLoading: isAnalyzing, isError: analysisError, error: analysisErrorDetails } = usePuzzleListAnalysis();

  // Matrix filter state
  const [modelSearchFilter, setModelSearchFilter] = useState('');
  const [showCorrect, setShowCorrect] = useState(true);
  const [showIncorrect, setShowIncorrect] = useState(true);
  const [showNotAttempted, setShowNotAttempted] = useState(true);

// Set page title
  React.useEffect(() => {
    document.title = puzzleId ? `Test Solution - ${formatPuzzleDisplay(puzzleId)}` : 'Test Your Solution';
  }, [puzzleId]);

  // Fetch puzzle data when puzzleId changes
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(puzzleId || undefined);

  // Fetch community solutions and available models
  const { solutions, submitSolutionAsync, isSubmitting } = useSolutions(puzzleId || '');
  const { data: models } = useModels();

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (selectedModel) {
      localStorage.setItem(LAST_MODEL_STORAGE_KEY, selectedModel);
    }
  }, [selectedModel]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const trimmedName = customModelName.trim();
    if (trimmedName) {
      localStorage.setItem(LAST_CUSTOM_MODEL_STORAGE_KEY, trimmedName);
    } else {
      localStorage.removeItem(LAST_CUSTOM_MODEL_STORAGE_KEY);
    }
  }, [customModelName]);

  React.useEffect(() => {
    if (!models || models.length === 0) {
      return;
    }

    const isValidSelection =
      selectedModel === 'custom' ||
      selectedModel === 'Human User' ||
      models.some((model) => model.key === selectedModel);

    if (!isValidSelection) {
      const grokModel = models.find((model) => model.key === 'x-ai/grok-4');
      const fallbackModel = grokModel?.key || models[0]?.key || 'Human User';
      setSelectedModel(fallbackModel);
    }
  }, [models, selectedModel]);

  // Parse and validate user grid input
  const { parsedGrid, isValidFormat, formatError } = useMemo(() => {
    if (!gridInput.trim()) {
      return { parsedGrid: null, isValidFormat: false, formatError: '' };
    }

    try {
      // Clean the input - remove extra whitespace and normalize
      const cleanInput = gridInput
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/,\s*]/g, ']')
        .replace(/,\s*,/g, ',')
        .replace(/\[\s+/g, '[')
        .replace(/\s+\]/g, ']');

      // Parse as JSON
      const parsed = JSON.parse(cleanInput);

      // Validate it's a 2D array of integers 0-9
      if (!Array.isArray(parsed)) {
        return { parsedGrid: null, isValidFormat: false, formatError: 'Input must be a 2D array like [[0,1,2],[3,4,5]]' };
      }

      for (let i = 0; i < parsed.length; i++) {
        const row = parsed[i];
        if (!Array.isArray(row)) {
          return { parsedGrid: null, isValidFormat: false, formatError: `Row ${i + 1} is not an array` };
        }
        for (let j = 0; j < row.length; j++) {
          const cell = row[j];
          if (!Number.isInteger(cell) || cell < 0 || cell > 9) {
            return { parsedGrid: null, isValidFormat: false, formatError: `Invalid cell value ${cell} at row ${i + 1}, column ${j + 1}. Must be integers 0-9.` };
          }
        }
      }

      // Check if all rows have the same length
      if (parsed.length > 0) {
        const expectedRowLength = parsed[0].length;
        for (let i = 1; i < parsed.length; i++) {
          if (parsed[i].length !== expectedRowLength) {
            return { parsedGrid: null, isValidFormat: false, formatError: `Row ${i + 1} has ${parsed[i].length} cells, but row 1 has ${expectedRowLength} cells. All rows must have the same length.` };
          }
        }
      }

      return { parsedGrid: parsed as number[][], isValidFormat: true, formatError: '' };
    } catch (error) {
      return { parsedGrid: null, isValidFormat: false, formatError: `Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }, [gridInput]);

  // Check if parsed grid matches expected output dimensions and calculate correctness
  const { dimensionsMatch, isCorrect, expectedGrid } = useMemo(() => {
    if (!task || !parsedGrid || task.test.length === 0) {
      return { dimensionsMatch: false, isCorrect: false, expectedGrid: null };
    }

    const expected = task.test[0].output; // Use first test case for now
    const dimensionsMatch = parsedGrid.length === expected.length &&
                          parsedGrid.every((row, i) => row.length === expected[i].length);

    let isCorrect = false;
    if (dimensionsMatch) {
      isCorrect = parsedGrid.every((row, i) =>
        row.every((cell, j) => cell === expected[i][j])
      );
    }

    return { dimensionsMatch, isCorrect, expectedGrid: expected };
  }, [task, parsedGrid]);

  // Create synthetic ExplanationData for AnalysisResultCard
  const syntheticExplanation: ExplanationData | null = useMemo(() => {
    if (!task || !parsedGrid || !isValidFormat) {
      return null;
    }

    return {
      id: -1,
      puzzleId: puzzleId,
      modelName: 'User Input',
      patternDescription: 'User-submitted solution',
      solvingStrategy: 'Manual solution provided by user',
      hints: ['User provided their own solution'],
      alienMeaning: 'Human intelligence applied to puzzle solving',
      confidence: isCorrect ? 100 : 0,
      helpfulVotes: null,
      notHelpfulVotes: null,
      createdAt: new Date().toISOString(),
      predictedOutputGrid: parsedGrid,
      isPredictionCorrect: isCorrect,
      trustworthinessScore: isCorrect ? 1.0 : 0.0,
      extractionMethod: 'user_input_direct'
    };
  }, [task, parsedGrid, isValidFormat, puzzleId, isCorrect]);

  // Handle puzzle ID submission
  const handlePuzzleIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (puzzleId.trim()) {
      setLocation(`/test-solution/${puzzleId.trim()}`);
    }
  };

  // Copy example grid to clipboard
  const copyExampleGrid = () => {
    const exampleGrid = "[[0,8,8,8,0],[8,0,0,0,8],[0,8,8,8,0],[8,0,0,0,8],[0,8,8,8,0]]";
    navigator.clipboard.writeText(exampleGrid);
  };

  // Handle structured explanation submission (like LLM analysis)
  const handleSubmitExplanation = async () => {
    if (
      !puzzleId.trim() ||
      !parsedGrid ||
      !isValidFormat ||
      !patternDescription.trim() ||
      !solvingStrategy.trim()
    ) {
      return;
    }

    try {
      const resolvedModelName =
        selectedModel === 'custom'
          ? customModelName.trim() || 'Custom Model'
          : selectedModel || 'Human User';

      const hintsArray = hints.trim()
        ? hints.split('\n').map((hint) => hint.trim()).filter((hint) => hint.length > 0)
        : [];

      const formattedHints =
        hintsArray.length > 0 ? hintsArray.map((hint) => `- ${hint}`) : ['- None provided'];

      const formattedGrid = parsedGrid.map((row) => `  ${JSON.stringify(row)}`);

      const solutionComment = [
        `Puzzle ID: ${puzzleId.trim()}`,
        `Model: ${resolvedModelName}`,
        `Confidence: ${confidence}%`,
        '',
        'Pattern Description:',
        patternDescription.trim(),
        '',
        'Solving Strategy:',
        solvingStrategy.trim(),
        '',
        'Hints:',
        ...formattedHints,
        '',
        'Predicted Output Grid:',
        ...formattedGrid,
      ].join('\n');

      await submitSolutionAsync({ comment: solutionComment });

      setGridInput('');
      setPatternDescription('');
      setSolvingStrategy('');
      setHints('');
      setConfidence(50);
    } catch (error) {
      console.error('Failed to submit solution explanation:', error);
    }
  };

  // Handle puzzle list analysis
  const handleAnalyzePuzzleList = () => {
    if (!puzzleListInput.trim()) {
      return;
    }

    // Parse puzzle IDs from input - handle multiple formats:
    // - 'id1', 'id2', 'id3' (quoted, comma-separated)
    // - id1,id2,id3 (unquoted, comma-separated)
    // - id1\nid2\nid3 (newline-separated)
    // - Mixed formats
    const puzzleIds = puzzleListInput
      .split(/[,\n]/)
      .map(id => {
        // Remove quotes and trim whitespace
        return id.trim().replace(/^['"`]|['"`]$/g, '');
      })
      .filter(id => id.length > 0);

    if (puzzleIds.length === 0) {
      return;
    }

    analyzePuzzleList(puzzleIds);
  };

  // Copy example puzzle list to clipboard
  const copyExamplePuzzleList = () => {
    const exampleList = "'9aec4887', 'b782dc8a', '4258a5f9', '810b9b61', '06df4c85'";
    navigator.clipboard.writeText(exampleList);
  };


  return (
    <div className="container mx-auto p-1 max-w-7xl space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-lg font-semibold">Puzzle Analysis & Testing</h1>
          <p className="text-xs text-gray-600">
            Analyze multiple puzzles or test individual solutions
          </p>
        </div>
        <Grid3X3 className="h-4 w-4 text-blue-600" />
      </div>

      {/* Puzzle List Analysis Section */}
      <Card className="mb-1">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm flex items-center gap-1">
            <BarChart3 className="h-3 w-3 text-blue-500" />
            Analyze Multiple Puzzles
          </CardTitle>
          <p className="text-xs text-gray-600">
            Enter puzzle IDs to see which models solved them and get performance insights
          </p>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <Label htmlFor="puzzleListInput" className="text-xs font-medium">Puzzle IDs</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={copyExamplePuzzleList}
                className="flex items-center gap-1 h-5 px-1 text-xs"
              >
                <Copy className="h-2 w-2" />
                Example
              </Button>
            </div>
            <Textarea
              id="puzzleListInput"
              value={puzzleListInput}
              onChange={(e) => setPuzzleListInput(e.target.value)}
              placeholder="'9aec4887', 'b782dc8a', '4258a5f9'&#10;Or unquoted: 9aec4887,b782dc8a,4258a5f9&#10;Or one per line:&#10;9aec4887&#10;b782dc8a"
              className="font-mono text-xs h-12"
            />
            <p className="text-xs text-gray-500 mt-0.5">
              Comma or newline separated puzzle IDs
            </p>
          </div>

          <Button
            onClick={handleAnalyzePuzzleList}
            disabled={!puzzleListInput.trim() || isAnalyzing}
            className="w-full h-6"
            size="sm"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-2 w-2 mr-1 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Database className="h-2 w-2 mr-1" />
                Check Puzzles
              </>
            )}
          </Button>

          {/* Analysis Results */}
          {analysisError && (
            <Alert className="py-1">
              <XCircle className="h-3 w-3" />
              <AlertDescription className="text-xs">
                Error: {analysisErrorDetails?.message || 'Failed to analyze puzzles'}
              </AlertDescription>
            </Alert>
          )}

          {puzzleAnalysisData && (() => {
            // Filter active models (models that attempted at least 1 puzzle)
            const activeModels = puzzleAnalysisData.modelPuzzleMatrix.filter(model => 
              model.puzzleStatuses.some(status => status.status !== 'not_attempted')
            );

            // Apply filters to get filtered models count
            const filteredModels = activeModels.filter((model) => {
              // Filter by model name search
              if (modelSearchFilter && !model.modelName.toLowerCase().includes(modelSearchFilter.toLowerCase())) {
                return false;
              }
              
              // Filter by status visibility
              const hasCorrect = model.puzzleStatuses.some(p => p.status === 'correct');
              const hasIncorrect = model.puzzleStatuses.some(p => p.status === 'incorrect');
              const hasNotAttempted = model.puzzleStatuses.some(p => p.status === 'not_attempted');
              
              // Show model if it has at least one status that's enabled
              return (showCorrect && hasCorrect) || 
                     (showIncorrect && hasIncorrect) || 
                     (showNotAttempted && hasNotAttempted);
            });

            // Calculate per-puzzle metrics
            const puzzleMetrics = puzzleAnalysisData.puzzleResults.map(puzzle => {
              const totalModels = activeModels.length;
              const correctCount = puzzle.correct_models.length;
              const successRate = totalModels > 0 ? (correctCount / totalModels) * 100 : 0;
              
              // Difficulty tier based on success rate
              let difficulty: 'trivial' | 'easy' | 'medium' | 'hard' | 'extreme';
              let difficultyColor: string;
              if (successRate >= 75) {
                difficulty = 'trivial';
                difficultyColor = 'bg-green-100 text-green-700';
              } else if (successRate >= 50) {
                difficulty = 'easy';
                difficultyColor = 'bg-blue-100 text-blue-700';
              } else if (successRate >= 25) {
                difficulty = 'medium';
                difficultyColor = 'bg-yellow-100 text-yellow-700';
              } else if (successRate >= 10) {
                difficulty = 'hard';
                difficultyColor = 'bg-orange-100 text-orange-700';
              } else {
                difficulty = 'extreme';
                difficultyColor = 'bg-red-100 text-red-700';
              }

              return {
                puzzleId: puzzle.puzzle_id,
                correctCount,
                totalAttempts: puzzle.total_attempts,
                successRate,
                difficulty,
                difficultyColor
              };
            });

            // Calculate aggregate stats
            const totalAttempts = puzzleMetrics.reduce((sum, p) => sum + p.totalAttempts, 0);
            const totalCorrect = puzzleMetrics.reduce((sum, p) => sum + p.correctCount, 0);
            const overallSuccessRate = totalAttempts > 0 ? (totalCorrect / activeModels.length / puzzleAnalysisData.puzzleResults.length * 100) : 0;

            return (
            <div className="space-y-2 mt-2">
              {/* Enhanced Summary Stats - Per-Puzzle Insights */}
              <div className="grid grid-cols-4 gap-2">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-2">
                    <div className="text-2xl font-bold text-blue-700">{activeModels.length}</div>
                    <div className="text-xs text-blue-600 font-medium">Active Models</div>
                    <div className="text-xs text-blue-500">Attempted puzzles</div>
                  </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-2">
                    <div className="text-2xl font-bold text-green-700">{overallSuccessRate.toFixed(1)}%</div>
                    <div className="text-xs text-green-600 font-medium">Success Rate</div>
                    <div className="text-xs text-green-500">{totalCorrect} solves total</div>
                  </CardContent>
                </Card>

                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="p-2">
                    <div className="text-2xl font-bold text-purple-700">{totalAttempts}</div>
                    <div className="text-xs text-purple-600 font-medium">Total Attempts</div>
                    <div className="text-xs text-purple-500">{(totalAttempts / puzzleAnalysisData.puzzleResults.length).toFixed(1)} avg/puzzle</div>
                  </CardContent>
                </Card>

                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="p-2">
                    <div className="text-2xl font-bold text-orange-700">
                      {puzzleMetrics.filter(p => p.difficulty === 'hard' || p.difficulty === 'extreme').length}
                    </div>
                    <div className="text-xs text-orange-600 font-medium">Hard Puzzles</div>
                    <div className="text-xs text-orange-500">&lt;25% solve rate</div>
                  </CardContent>
                </Card>
              </div>

              {/* Enhanced Model vs Puzzle Matrix Table */}
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Database className="h-3 w-3" />
                    Model Performance Matrix
                    <Badge variant="outline" className="text-xs">
                      {filteredModels.length} shown / {activeModels.length} active / {puzzleAnalysisData.summary.totalModels} total
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-gray-600">
                    ✅ = Correct, ❌ = Incorrect • Showing only models that attempted puzzles
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Filter Controls */}
                  <div className="mb-3 space-y-2 border-b pb-3">
                    <div className="flex items-center gap-2">
                      <Search className="h-3 w-3 text-gray-500" />
                      <Input
                        placeholder="Search models..."
                        value={modelSearchFilter}
                        onChange={(e) => setModelSearchFilter(e.target.value)}
                        className="h-7 text-xs flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setModelSearchFilter('');
                          setShowCorrect(true);
                          setShowIncorrect(true);
                          setShowNotAttempted(true);
                        }}
                        className="h-7 px-2 text-xs"
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Filter className="h-3 w-3 text-gray-500" />
                        <span className="text-xs text-gray-600 font-medium">Show:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="showCorrect"
                          checked={showCorrect}
                          onCheckedChange={(checked: boolean) => setShowCorrect(checked === true)}
                        />
                        <label htmlFor="showCorrect" className="text-xs cursor-pointer flex items-center gap-1">
                          <span className="text-green-600">✅</span> Correct
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="showIncorrect"
                          checked={showIncorrect}
                          onCheckedChange={(checked: boolean) => setShowIncorrect(checked === true)}
                        />
                        <label htmlFor="showIncorrect" className="text-xs cursor-pointer flex items-center gap-1">
                          <span className="text-red-600">❌</span> Incorrect
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="showNotAttempted"
                          checked={showNotAttempted}
                          onCheckedChange={(checked: boolean) => setShowNotAttempted(checked === true)}
                        />
                        <label htmlFor="showNotAttempted" className="text-xs cursor-pointer flex items-center gap-1">
                          <span className="text-gray-300">·</span> Not Attempted
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b-2">
                          <th className="text-left py-2 px-2 font-semibold sticky left-0 bg-white z-10">Model</th>
                          <th className="text-center py-2 px-2 font-semibold bg-green-50">✅</th>
                          <th className="text-center py-2 px-2 font-semibold bg-red-50">❌</th>
                          <th className="text-center py-2 px-2 font-semibold bg-blue-50">%</th>
                          {puzzleMetrics.map((metric) => (
                            <th key={metric.puzzleId} className="text-center py-2 px-1 font-medium min-w-20">
                              <div className="flex flex-col items-center gap-1">
                                <ClickablePuzzleBadge puzzleId={metric.puzzleId} showName={false} className="text-[10px] px-1" />
                                <Badge variant="outline" className={`text-[9px] px-1 py-0 ${metric.difficultyColor}`}>
                                  {metric.successRate.toFixed(0)}%
                                </Badge>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredModels.length === 0 ? (
                          <tr>
                            <td colSpan={4 + puzzleMetrics.length} className="text-center py-6 text-gray-500">
                              <div className="flex flex-col items-center gap-2">
                                <Filter className="h-8 w-8 text-gray-300" />
                                <p className="text-sm">No models match the current filters</p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setModelSearchFilter('');
                                    setShowCorrect(true);
                                    setShowIncorrect(true);
                                    setShowNotAttempted(true);
                                  }}
                                  className="text-xs"
                                >
                                  Clear Filters
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredModels.map((model) => {
                          const correctCount = model.puzzleStatuses.filter(p => p.status === 'correct').length;
                          const incorrectCount = model.puzzleStatuses.filter(p => p.status === 'incorrect').length;
                          const attemptedCount = correctCount + incorrectCount;
                          const successRate = attemptedCount > 0 ? (correctCount / attemptedCount * 100).toFixed(0) : '0';

                          return (
                            <tr key={model.modelName} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-2 font-medium truncate max-w-48 sticky left-0 bg-white" title={model.modelName}>
                                {model.modelName}
                              </td>
                              <td className="text-center py-2 px-2 bg-green-50 font-semibold text-green-700">{correctCount}</td>
                              <td className="text-center py-2 px-2 bg-red-50 font-semibold text-red-700">{incorrectCount}</td>
                              <td className="text-center py-2 px-2 bg-blue-50 font-semibold text-blue-700">{successRate}%</td>
                              {model.puzzleStatuses.map((puzzle) => (
                                <td key={puzzle.puzzleId} className="text-center py-2 px-1">
                                  {puzzle.status === 'correct' && <span className="text-green-600 text-base">✅</span>}
                                  {puzzle.status === 'incorrect' && <span className="text-red-600 text-base">❌</span>}
                                  {puzzle.status === 'not_attempted' && <span className="text-gray-300 text-xs">·</span>}
                                </td>
                              ))}
                            </tr>
                          );
                        })
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Individual Puzzle Testing Section */}
      <div className="border-t border-gray-200 pt-2">
        <h2 className="text-sm font-semibold mb-1 flex items-center gap-1">
          <Lightbulb className="h-3 w-3 text-yellow-500" />
          Test Individual Solution
        </h2>
        <p className="text-xs text-gray-600 mb-2">
          Load a specific puzzle and test your solution
        </p>
      </div>

      {/* Puzzle ID Input */}
      <Card className="mb-1">
        <CardContent className="p-2">
          <form onSubmit={handlePuzzleIdSubmit} className="flex gap-1 items-end">
            <div className="flex-1">
              <Label htmlFor="puzzleId" className="text-xs font-medium">Puzzle ID</Label>
              <Input
                id="puzzleId"
                value={puzzleId}
                onChange={(e) => setPuzzleId(e.target.value)}
                placeholder="e.g., 0520fde7"
                className="mt-0.5 h-6 text-sm"
              />
            </div>
            <Button type="submit" size="sm" className="h-6 px-2 text-xs">
              Load Puzzle
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Loading state */}
      {isLoadingTask && (
        <Card>
          <CardContent className="p-2">
            <div className="flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              <span className="text-sm">Loading puzzle...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {taskError && (
        <Alert className="py-1">
          <XCircle className="h-3 w-3" />
          <AlertDescription className="text-xs">
            Failed to load puzzle: {taskError.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Show puzzle and solution input when puzzle is loaded */}
      {task && (
        <>
          {/* Solution Input Section - Now at top */}
          <Card className="mb-1">
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-1">
                  <Lightbulb className="h-3 w-3 text-yellow-500" />
                  Enter Your Solution
                </CardTitle>
                {task.source && (
                  <Badge variant="outline" className={`text-xs ${
                    task.source === 'ARC1' ? 'bg-blue-50 text-blue-700' :
                    task.source === 'ARC1-Eval' ? 'bg-cyan-50 text-cyan-700 font-semibold' :
                    task.source === 'ARC2' ? 'bg-purple-50 text-purple-700' :
                    task.source === 'ARC2-Eval' ? 'bg-green-50 text-green-700 font-bold' :
                    'bg-gray-50 text-gray-700'
                  }`}>
                    {task.source}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <Label htmlFor="gridInput" className="text-xs font-medium">Predicted Output Grid</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyExampleGrid}
                    className="flex items-center gap-1 h-5 px-1 text-xs"
                  >
                    <Copy className="h-2 w-2" />
                    Example
                  </Button>
                </div>
                <Textarea
                  id="gridInput"
                  value={gridInput}
                  onChange={(e) => setGridInput(e.target.value)}
                  placeholder="[[0,8,8,8,0],[8,0,0,0,8],[0,8,8,8,0],[8,0,0,0,8],[0,8,8,8,0]]"
                  className="font-mono text-xs h-12"
                />
                <p className="text-xs text-gray-500 mt-0.5">
                  2D array, numbers 0-9
                </p>
              </div>

              {/* Validation feedback and grid preview */}
              {gridInput && (
                <div className="space-y-1">
                  {formatError ? (
                    <Alert className="py-1">
                      <XCircle className="h-3 w-3" />
                      <AlertDescription className="text-xs">{formatError}</AlertDescription>
                    </Alert>
                  ) : isValidFormat && parsedGrid ? (
                    <div className="space-y-1">
                      <Alert className="border-green-200 bg-green-50 py-1">
                        <CheckCircle className="h-3 w-3 text-green-600" />
                        <AlertDescription className="text-green-700 text-xs">
                          Valid! {parsedGrid.length}×{parsedGrid[0]?.length || 0}
                        </AlertDescription>
                      </Alert>

                      {/* Show the parsed grid visually */}
                      <div className="border border-gray-200 rounded p-2 bg-gray-50">
                        <h4 className="text-xs font-medium mb-1 text-center">Your Grid</h4>
                        <div className="flex justify-center">
                          <PuzzleGrid
                            grid={parsedGrid}
                            title=""
                            showEmojis={false}
                          />
                        </div>
                      </div>

                      {expectedGrid && !dimensionsMatch && (
                        <Alert className="py-1">
                          <XCircle className="h-3 w-3" />
                          <AlertDescription className="text-xs">
                            Wrong size! Expected {expectedGrid.length}×{expectedGrid[0]?.length || 0}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Structured explanation submission form */}
                      {dimensionsMatch && (
                        <CollapsibleCard
                          title="Submit Analysis"
                          icon={Brain}
                          defaultOpen={true}
                          className="border-blue-200 bg-blue-50"
                          headerDescription={
                            <p className="text-xs text-gray-600">Structured analysis</p>
                          }
                        >
                          <div className="space-y-2">
                            {/* Model Selection */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label htmlFor="modelSelect" className="text-xs">Model</Label>
                                <Select value={selectedModel} onValueChange={setSelectedModel}>
                                  <SelectTrigger className="mt-0.5 h-6">
                                    <SelectValue placeholder="Select model" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Human User">Human</SelectItem>
                                    <SelectItem value="custom">Custom</SelectItem>
                                    {models?.map((model) => (
                                      <SelectItem key={model.key} value={model.key}>
                                        {model.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {selectedModel === 'custom' && (
                                <div>
                                  <Label htmlFor="customModel" className="text-xs">Custom Name</Label>
                                  <Input
                                    id="customModel"
                                    value={customModelName}
                                    onChange={(e) => setCustomModelName(e.target.value)}
                                    placeholder="Model name"
                                    className="mt-0.5 h-6 text-xs"
                                  />
                                </div>
                              )}
                            </div>

                            {/* Pattern & Strategy side by side */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label htmlFor="patternDescription" className="text-xs">Pattern *</Label>
                                <Textarea
                                  id="patternDescription"
                                  value={patternDescription}
                                  onChange={(e) => setPatternDescription(e.target.value)}
                                  placeholder="Pattern description..."
                                  className="mt-0.5 text-xs h-12"
                                  required
                                />
                              </div>
                              <div>
                                <Label htmlFor="solvingStrategy" className="text-xs">Strategy *</Label>
                                <Textarea
                                  id="solvingStrategy"
                                  value={solvingStrategy}
                                  onChange={(e) => setSolvingStrategy(e.target.value)}
                                  placeholder="Solving strategy..."
                                  className="mt-0.5 text-xs h-12"
                                  required
                                />
                              </div>
                            </div>

                            {/* Hints & Confidence */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label htmlFor="hints" className="text-xs">Hints</Label>
                                <Textarea
                                  id="hints"
                                  value={hints}
                                  onChange={(e) => setHints(e.target.value)}
                                  placeholder="One per line..."
                                  className="mt-0.5 text-xs h-8"
                                />
                              </div>
                              <div>
                                <Label htmlFor="confidence" className="text-xs">Confidence: {confidence}%</Label>
                                <input
                                  type="range"
                                  id="confidence"
                                  min="0"
                                  max="100"
                                  value={confidence}
                                  onChange={(e) => setConfidence(parseInt(e.target.value))}
                                  className="w-full mt-0.5"
                                />
                              </div>
                            </div>

                            <Button
                              onClick={handleSubmitExplanation}
                              disabled={isSubmitting || !patternDescription.trim() || !solvingStrategy.trim()}
                              className="w-full h-6"
                              size="sm"
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="h-2 w-2 mr-1 animate-spin" />
                                  Submitting...
                                </>
                              ) : (
                                <>
                                  <Brain className="h-2 w-2 mr-1" />
                                  Submit Analysis
                                </>
                              )}
                            </Button>
                          </div>
                        </CollapsibleCard>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Compact Puzzle Display - Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* Training Examples - Left Side */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm flex items-center gap-1">
                  <Settings className="h-3 w-3" />
                  Training Examples
                  <Badge variant="outline" className="text-xs">{task.train.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                {task.train.map((example, index) => (
                  <div key={index} className="border border-gray-200 rounded p-1">
                    <h4 className="text-xs font-medium mb-1 text-center">Ex {index + 1}</h4>
                    <div className="flex items-center justify-center gap-2">
                      <PuzzleGrid
                        grid={example.input}
                        title=""
                        showEmojis={false}
                      />
                      <div className="text-sm text-gray-400">→</div>
                      <PuzzleGrid
                        grid={example.output}
                        title=""
                        showEmojis={false}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Test Case - Right Side */}
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm flex items-center gap-1">
                  <Grid3X3 className="h-3 w-3" />
                  Test Case
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="border border-gray-200 rounded p-2 bg-yellow-50">
                  <h4 className="text-xs font-medium mb-1 text-center">Solve This!</h4>
                  <div className="flex justify-center">
                    <PuzzleGrid
                      grid={task.test[0].input}
                      title=""
                      showEmojis={false}
                      highlight={true}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>


          {/* Results Display */}
          {syntheticExplanation && isValidFormat && dimensionsMatch && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Results</h2>
                <div className="flex items-center gap-1">
                  {isCorrect ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                      <CheckCircle className="h-2 w-2 mr-1" />
                      Correct!
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                      <XCircle className="h-2 w-2 mr-1" />
                      Incorrect
                    </Badge>
                  )}
                </div>
              </div>

              <AnalysisResultCard
                modelKey="user-input"
                result={syntheticExplanation}
                testCases={task.test}
              />
            </div>
          )}

          {/* Community Solutions Display */}
          {solutions.length > 0 && (
            <CollapsibleCard
              title={`Community Solutions (${solutions.length})`}
              icon={Users}
              defaultOpen={false}
              headerDescription={
                <p className="text-xs text-gray-600">Community solutions</p>
              }
            >
              <div className="space-y-2">
                {solutions.map((solution) => (
                  <div key={solution.id} className="border border-gray-200 rounded p-2">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3 text-gray-500" />
                        <span className="text-xs text-gray-500">
                          {new Date(solution.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {solution.helpful_count !== undefined && (
                          <Badge variant="outline" className="text-xs h-4">
                            👍 {solution.helpful_count}
                          </Badge>
                        )}
                        {solution.not_helpful_count !== undefined && solution.not_helpful_count > 0 && (
                          <Badge variant="outline" className="text-xs h-4">
                            👎 {solution.not_helpful_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-700 whitespace-pre-wrap">
                      {solution.comment}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleCard>
          )}
        </>
      )}

      {/* Help text when no puzzle is loaded */}
      {!puzzleId && (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            <Grid3X3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">Get Started</h3>
            <p className="mb-4">Enter a puzzle ID above to load an ARC puzzle and test your solution</p>
            <p className="text-sm">
              You can find puzzle IDs by browsing the <a href="/" className="text-blue-600 hover:underline">puzzle browser</a>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}