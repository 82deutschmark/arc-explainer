import React, { useState } from 'react';
import { PuzzleGrid } from './PuzzleGrid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ARCTask } from '@shared/types';

interface PuzzleViewerProps {
  task: ARCTask;
  onSolutionSubmit?: (solution: number[][]) => void;
  analysis?: {
    patternDescription: string;
    solvingStrategy: string;
    hints: string[];
    confidence: number;
  };
}

export function PuzzleViewer({ task, onSolutionSubmit, analysis }: PuzzleViewerProps) {
  const [userSolution, setUserSolution] = useState<number[][]>(() => {
    // Initialize with the test input as starting point
    if (task.test.length > 0) {
      return task.test[0].input.map(row => [...row]);
    }
    return [];
  });

  const handleCellClick = (row: number, col: number, currentValue: number) => {
    const newSolution = userSolution.map(r => [...r]);
    // Cycle through values 0-9
    newSolution[row][col] = (currentValue + 1) % 10;
    setUserSolution(newSolution);
  };

  const handleSubmitSolution = () => {
    if (onSolutionSubmit) {
      onSolutionSubmit(userSolution);
    }
  };

  const resetSolution = () => {
    if (task.test.length > 0) {
      setUserSolution(task.test[0].input.map(row => [...row]));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Training Examples</CardTitle>
          <p className="text-sm text-gray-600">
            Study these examples to understand the pattern
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {task.train.map((example, index) => (
              <div key={index} className="space-y-2">
                <h4 className="font-medium">Example {index + 1}</h4>
                <div className="flex gap-8 items-start flex-wrap">
                  <PuzzleGrid 
                    grid={example.input} 
                    title="Input"
                    className="flex-shrink-0"
                  />
                  <div className="flex items-center justify-center h-12">
                    <span className="text-2xl">→</span>
                  </div>
                  <PuzzleGrid 
                    grid={example.output} 
                    title="Output"
                    className="flex-shrink-0"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>AI Analysis</CardTitle>
            <p className="text-sm text-gray-600">
              Confidence: {(analysis.confidence * 100).toFixed(1)}%
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="pattern" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="pattern">Pattern</TabsTrigger>
                <TabsTrigger value="strategy">Strategy</TabsTrigger>
                <TabsTrigger value="hints">Hints</TabsTrigger>
              </TabsList>
              <TabsContent value="pattern" className="space-y-2">
                <h4 className="font-medium">Pattern Description</h4>
                <p className="text-sm">{analysis.patternDescription}</p>
              </TabsContent>
              <TabsContent value="strategy" className="space-y-2">
                <h4 className="font-medium">Solving Strategy</h4>
                <p className="text-sm">{analysis.solvingStrategy}</p>
              </TabsContent>
              <TabsContent value="hints" className="space-y-2">
                <h4 className="font-medium">Helpful Hints</h4>
                <ul className="text-sm space-y-1">
                  {analysis.hints.map((hint, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-blue-500 font-bold">•</span>
                      {hint}
                    </li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Test Cases Reference</CardTitle>
          <p className="text-sm text-gray-600">
            Review all test cases to understand the pattern
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {task.test.map((testCase, index) => (
              <div key={index} className="space-y-2">
                <h4 className="font-medium">Test Case {index + 1}</h4>
                <div className="flex gap-8 items-start flex-wrap">
                  <PuzzleGrid
                    grid={testCase.input}
                    title="Input"
                    className="flex-shrink-0"
                  />
                  <div className="flex items-center justify-center h-12">
                    <span className="text-2xl">→</span>
                  </div>
                  <PuzzleGrid
                    grid={testCase.output}
                    title="Expected Output"
                    className="flex-shrink-0"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Solution</CardTitle>
          <p className="text-sm text-gray-600">
            Click on cells to change their values. Solve for the first test case input.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-8 items-start flex-wrap">
              <PuzzleGrid
                grid={task.test[0]?.input || []}
                title="Test Input"
                className="flex-shrink-0"
              />
              <div className="flex items-center justify-center h-12">
                <span className="text-2xl">→</span>
              </div>
              <PuzzleGrid
                grid={userSolution}
                title="Your Solution"
                editable={true}
                onCellClick={handleCellClick}
                className="flex-shrink-0"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmitSolution} className="bg-blue-600 hover:bg-blue-700">
                Submit Solution
              </Button>
              <Button onClick={resetSolution} variant="outline">
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
