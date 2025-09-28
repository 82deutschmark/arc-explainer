/**
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-28
 * PURPOSE: PuzzleFeedback page allows users to test their own predicted grid solutions against ARC puzzles.
 * Reuses existing grid visualization and validation components for consistent UX with AI model results.
 * Users can paste grid arrays like [[0,8,8,8,0],[8,0,0,0,8]] and see immediate correct/incorrect feedback.
 * SRP and DRY check: Pass - Reuses existing validation logic, grid visualization, and puzzle lookup patterns.
 * shadcn/ui: Pass - Uses existing shadcn/ui components throughout.
 */

import React, { useState, useMemo } from 'react';
import { useParams, useLocation } from 'wouter';
import { usePuzzle } from '@/hooks/usePuzzle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Grid3X3, CheckCircle, XCircle, Copy, Lightbulb } from 'lucide-react';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import type { ExplanationData } from '@/types/puzzle';

export default function PuzzleFeedback() {
  const { taskId: paramTaskId } = useParams<{ taskId?: string }>();
  const [, setLocation] = useLocation();

  // State for puzzle ID input and grid input
  const [puzzleId, setPuzzleId] = useState(paramTaskId || '');
  const [gridInput, setGridInput] = useState('');
  const [validationError, setValidationError] = useState<string>('');

  // Set page title
  React.useEffect(() => {
    document.title = puzzleId ? `Test Solution - ${puzzleId}` : 'Test Your Solution';
  }, [puzzleId]);

  // Fetch puzzle data when puzzleId changes
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(puzzleId || undefined);

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
      predictionAccuracyScore: isCorrect ? 1.0 : 0.0,
      extractionMethod: 'user_input_direct'
    };
  }, [task, parsedGrid, isValidFormat, puzzleId, isCorrect]);

  // Handle puzzle ID submission
  const handlePuzzleIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (puzzleId.trim()) {
      setLocation(`/feedback/${puzzleId.trim()}`);
    }
  };

  // Copy example grid to clipboard
  const copyExampleGrid = () => {
    const exampleGrid = "[[0,8,8,8,0],[8,0,0,0,8],[0,8,8,8,0],[8,0,0,0,8],[0,8,8,8,0]]";
    navigator.clipboard.writeText(exampleGrid);
  };

  return (
    <div className="container mx-auto p-3 max-w-6xl space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Test Your Solution</h1>
          <p className="text-gray-600">
            Enter a puzzle ID and paste your predicted grid to see if it's correct
          </p>
        </div>
        <Grid3X3 className="h-8 w-8 text-blue-600" />
      </div>

      {/* Puzzle ID Input */}
      <Card>
        <CardHeader>
          <CardTitle>1. Select Puzzle</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePuzzleIdSubmit} className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="puzzleId">Puzzle ID</Label>
              <Input
                id="puzzleId"
                value={puzzleId}
                onChange={(e) => setPuzzleId(e.target.value)}
                placeholder="e.g., 0520fde7"
                className="mt-1"
              />
            </div>
            <Button type="submit" className="mt-6">
              Load Puzzle
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Loading state */}
      {isLoadingTask && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading puzzle...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {taskError && (
        <Alert>
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load puzzle: {taskError.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Show puzzle and solution input when puzzle is loaded */}
      {task && (
        <>
          {/* Puzzle Display */}
          <CollapsibleCard
            title={`Puzzle ${puzzleId} - Question`}
            icon={Grid3X3}
            defaultOpen={true}
            headerDescription={
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-600">Understand the pattern from training examples, then solve the test case</p>
                {task.source && (
                  <Badge variant="outline" className={`${
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
            }
          >
            <div className="space-y-6">
              {/* Training Examples */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  Training Examples
                  <Badge variant="outline">{task.train.length} examples</Badge>
                </h3>
                <div className="space-y-4">
                  {task.train.map((example, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <h4 className="text-sm font-medium mb-2 text-center">Example {index + 1}</h4>
                      <div className="flex items-center justify-center gap-6">
                        <PuzzleGrid
                          grid={example.input}
                          title="Input"
                          showEmojis={false}
                        />
                        <div className="text-3xl text-gray-400">→</div>
                        <PuzzleGrid
                          grid={example.output}
                          title="Output"
                          showEmojis={false}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Test Case Input */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3 text-center">Test Case - What should the output be?</h3>
                <div className="flex justify-center">
                  <PuzzleGrid
                    grid={task.test[0].input}
                    title="Test Input - Solve This!"
                    showEmojis={false}
                    highlight={true}
                  />
                </div>
              </div>
            </div>
          </CollapsibleCard>

          {/* Solution Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                2. Enter Your Solution
                <Lightbulb className="h-5 w-5 text-yellow-500" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="gridInput">Predicted Output Grid (JSON format)</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyExampleGrid}
                    className="flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    Copy Example Format
                  </Button>
                </div>
                <Textarea
                  id="gridInput"
                  value={gridInput}
                  onChange={(e) => setGridInput(e.target.value)}
                  placeholder="[[0,8,8,8,0],[8,0,0,0,8],[0,8,8,8,0],[8,0,0,0,8],[0,8,8,8,0]]"
                  className="font-mono text-sm"
                  rows={6}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter your solution as a 2D array. Numbers must be 0-9. Example: [[0,1],[2,3]] for a 2x2 grid.
                </p>
              </div>

              {/* Validation feedback */}
              {gridInput && (
                <div className="space-y-2">
                  {formatError ? (
                    <Alert>
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>{formatError}</AlertDescription>
                    </Alert>
                  ) : isValidFormat && parsedGrid ? (
                    <div className="space-y-2">
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-700">
                          Valid grid format! Grid size: {parsedGrid.length}×{parsedGrid[0]?.length || 0}
                        </AlertDescription>
                      </Alert>

                      {expectedGrid && !dimensionsMatch && (
                        <Alert>
                          <XCircle className="h-4 w-4" />
                          <AlertDescription>
                            Dimension mismatch! Your grid is {parsedGrid.length}×{parsedGrid[0]?.length || 0},
                            but expected {expectedGrid.length}×{expectedGrid[0]?.length || 0}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Display */}
          {syntheticExplanation && isValidFormat && dimensionsMatch && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Results</h2>
                <div className="flex items-center gap-2">
                  {isCorrect ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Correct!
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800 border-red-200">
                      <XCircle className="h-3 w-3 mr-1" />
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