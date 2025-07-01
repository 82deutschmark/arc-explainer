import React, { useState } from 'react';
import { useParams } from 'wouter';
import { PuzzleViewer } from '@/components/PuzzleViewer';
import { HintSystem } from '@/components/HintSystem';
import { usePuzzle } from '@/hooks/usePuzzle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function PuzzleSolver() {
  const { taskId } = useParams();
  const [showHints, setShowHints] = useState(false);
  
  const {
    task,
    analysis,
    validation,
    isLoadingTask,
    isLoadingAnalysis,
    isValidating,
    taskError,
    validationError,
    submitSolution,
    resetValidation,
  } = usePuzzle(taskId);

  const handleSolutionSubmit = (solution: number[][]) => {
    submitSolution(solution);
  };

  if (isLoadingTask) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading puzzle...</p>
        </div>
      </div>
    );
  }

  if (taskError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Failed to Load Puzzle</h2>
              <p className="text-gray-600 text-sm">
                {taskError instanceof Error ? taskError.message : 'Unknown error occurred'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-gray-600">No puzzle data available</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold">ARC-AGI Puzzle Solver</h1>
          <p className="text-gray-600">
            Decode alien communication patterns using logical reasoning
          </p>
          {taskId && (
            <p className="text-sm text-gray-500">
              Puzzle ID: {taskId}
            </p>
          )}
        </header>

        {validation && (
          <Alert className={validation.isCorrect ? "border-green-500 bg-green-50" : "border-yellow-500 bg-yellow-50"}>
            <div className="flex items-center gap-2">
              {validation.isCorrect ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-yellow-600" />
              )}
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">
                    {validation.isCorrect ? "Correct!" : `${(validation.accuracy * 100).toFixed(1)}% Correct`}
                  </p>
                  <p className="text-sm">{validation.feedback}</p>
                </div>
              </AlertDescription>
            </div>
          </Alert>
        )}

        {validationError && (
          <Alert className="border-red-500 bg-red-50">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription>
              Failed to validate solution. Please try again.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PuzzleViewer
              task={task}
              onSolutionSubmit={handleSolutionSubmit}
              analysis={analysis}
            />
            
            {isValidating && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span>Validating solution...</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={() => setShowHints(!showHints)}
                variant={showHints ? "default" : "outline"}
                className="flex-1"
              >
                {showHints ? "Hide Hints" : "Show Hints"}
              </Button>
              {validation && (
                <Button
                  onClick={resetValidation}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>

            {isLoadingAnalysis ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-600">AI analyzing puzzle...</p>
                  </div>
                </CardContent>
              </Card>
            ) : showHints && analysis ? (
              <HintSystem hints={analysis.hints} />
            ) : showHints ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-gray-600">
                    No hints available for this puzzle
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
