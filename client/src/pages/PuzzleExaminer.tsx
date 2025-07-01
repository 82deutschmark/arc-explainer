import React, { useState } from 'react';
import { useParams } from 'wouter';
import { usePuzzle } from '@/hooks/usePuzzle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, Hash, ArrowLeft, Brain } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { getSpaceEmoji } from '@/lib/spaceEmojis';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';

function GridCell({ 
  value, 
  showEmojis, 
  size = "normal" 
}: { 
  value: number; 
  showEmojis: boolean; 
  size?: "small" | "normal" | "large";
}) {
  const sizeClasses = {
    small: "w-4 h-4 text-xs",
    normal: "w-6 h-6 text-sm", 
    large: "w-8 h-8 text-base"
  };

  const colors = [
    '#000000', '#0074D9', '#FF4136', '#2ECC40', '#FFDC00',
    '#AAAAAA', '#F012BE', '#FF851B', '#7FDBFF', '#870C25'
  ];

  return (
    <div
      className={`${sizeClasses[size]} border border-gray-300 flex items-center justify-center font-mono`}
      style={{ 
        backgroundColor: showEmojis ? 'white' : (colors[value] || '#FFFFFF'),
        color: showEmojis ? '#000' : '#FFF'
      }}
    >
      {showEmojis ? getSpaceEmoji(value) : value}
    </div>
  );
}

function PuzzleGrid({ 
  grid, 
  title, 
  showEmojis,
  highlight = false 
}: { 
  grid: number[][]; 
  title: string; 
  showEmojis: boolean;
  highlight?: boolean;
}) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const maxDim = Math.max(rows, cols);
  
  // Better size calculation
  const size = maxDim <= 5 ? "large" : maxDim <= 10 ? "normal" : "small";
  
  return (
    <div className={`text-center space-y-2 ${highlight ? 'bg-green-50 p-4 rounded-lg border-2 border-green-300' : ''}`}>
      <div className="flex items-center justify-center gap-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <Badge variant="outline" className="text-xs">{rows}×{cols}</Badge>
      </div>
      <div className="inline-block border-2 border-gray-400 rounded">
        {grid.map((row, rowIndex) => (
          <div key={rowIndex} className="flex">
            {row.map((cell, colIndex) => (
              <GridCell 
                key={colIndex}
                value={cell} 
                showEmojis={showEmojis}
                size={size}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PuzzleExaminer() {
  const { taskId } = useParams();
  const [showEmojis, setShowEmojis] = useState(true);
  const [analysisResults, setAnalysisResults] = useState<Record<string, any>>({});

  const {
    task,
    isLoading: isLoadingTask,
    taskError,
  } = usePuzzle(taskId);

  // Available OpenAI models - EXACT models requested
  const models = [
    { key: 'gpt-4.1-nano-2025-04-14', name: 'GPT-4.1 Nano', color: 'bg-blue-500' },
    { key: 'o1-mini-2025-04-16', name: 'o1-mini 2025', color: 'bg-green-500' },
    { key: 'gpt-4.1-mini-2025-04-14', name: 'GPT-4.1 Mini', color: 'bg-purple-500' },
    { key: 'gpt-4o-mini-2024-07-18', name: 'GPT-4o Mini', color: 'bg-orange-500' }
  ];

  // Test specific model
  const testModelMutation = useMutation({
    mutationFn: async (modelKey: string) => {
      const response = await apiRequest('POST', `/api/puzzle/analyze/${taskId}/${modelKey}`, {});
      return response.json();
    },
    onSuccess: (data, modelKey) => {
      setAnalysisResults(prev => ({ ...prev, [modelKey]: data }));
    }
  });

  if (isLoadingTask) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading alien communication pattern...</span>
          </div>
        </div>
      </div>
    );
  }

  if (taskError || !task) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Alert>
          <AlertDescription>
            Failed to load puzzle: {taskError || 'Puzzle not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/puzzle-browser">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Browser
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Puzzle {taskId}</h1>
            <p className="text-gray-600">Examining alien communication pattern</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={showEmojis ? "default" : "outline"}
            size="sm"
            onClick={() => setShowEmojis(!showEmojis)}
          >
            {showEmojis ? <Eye className="h-4 w-4 mr-2" /> : <Hash className="h-4 w-4 mr-2" />}
            {showEmojis ? 'Alien Symbols' : 'Show Numbers'}
          </Button>
        </div>
      </div>

      {/* All Examples in One View */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Puzzle Pattern</CardTitle>
          <p className="text-sm text-gray-600">Training examples show the pattern, test case shows the question and correct answer</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {/* Training Examples in a Row */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                Training Examples 
                <Badge variant="outline">{task.train.length} examples</Badge>
              </h3>
              <div className="space-y-6">
                {task.train.map((example, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium mb-3 text-center">Example {index + 1}</h4>
                    <div className="flex items-center justify-center gap-8">
                      <PuzzleGrid 
                        grid={example.input}
                        title="Input"  
                        showEmojis={showEmojis}
                      />
                      <div className="text-3xl text-gray-400">→</div>
                      <PuzzleGrid 
                        grid={example.output}
                        title="Output"
                        showEmojis={showEmojis}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Case */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-center">Test Case & Correct Answer</h3>
              {task.test.map((testCase, index) => (
                <div key={index} className="flex items-center justify-center gap-8">
                  <PuzzleGrid 
                    grid={testCase.input}
                    title="Test Question"
                    showEmojis={showEmojis}
                  />
                  <div className="text-3xl text-green-600">→</div>
                  <PuzzleGrid 
                    grid={testCase.output}
                    title="Correct Answer"
                    showEmojis={showEmojis}
                    highlight={true}
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Model Testing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Model Analysis
          </CardTitle>
          <p className="text-sm text-gray-600">
            Test how different AI models explain why this solution is correct and what the aliens might mean
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {models.map((model) => (
              <Button
                key={model.key}
                variant="outline"
                className={`h-auto p-4 flex flex-col items-center gap-2 ${
                  analysisResults[model.key] ? 'ring-2 ring-green-500' : ''
                }`}
                onClick={() => testModelMutation.mutate(model.key)}
                disabled={testModelMutation.isPending}
              >
                {testModelMutation.isPending && testModelMutation.variables === model.key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <div className={`w-4 h-4 rounded-full ${
                    analysisResults[model.key] ? 'bg-green-500' : model.color
                  }`} />
                )}
                <span className="text-sm font-medium">{model.name}</span>
              </Button>
            ))}
          </div>

          {/* Analysis Results */}
          {Object.keys(analysisResults).length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold">Model Explanations</h4>
              {Object.entries(analysisResults).map(([modelKey, result]: [string, any]) => {
                const model = models.find(m => m.key === modelKey);
                return (
                  <div key={modelKey} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${model?.color || 'bg-gray-500'}`} />
                      <h5 className="font-medium">{model?.name || modelKey}</h5>
                      {result.confidence && (
                        <Badge variant="outline">
                          {Math.round(result.confidence * 100)}% confident
                        </Badge>
                      )}
                    </div>
                    
                    {result.patternDescription && (
                      <div>
                        <h6 className="text-sm font-medium text-gray-700">Why the solution is correct:</h6>
                        <p className="text-sm">{result.patternDescription}</p>
                      </div>
                    )}
                    
                    {result.solvingStrategy && (
                      <div>
                        <h6 className="text-sm font-medium text-gray-700">Simple explanation:</h6>
                        <p className="text-sm">{result.solvingStrategy}</p>
                      </div>
                    )}
                    
                    {result.alienMeaning && (
                      <div className="bg-purple-50 p-3 rounded border border-purple-200">
                        <h6 className="text-sm font-medium text-purple-800">🛸 What the aliens might mean:</h6>
                        <p className="text-sm text-purple-700">{result.alienMeaning}</p>
                      </div>
                    )}
                    
                    {result.hints && result.hints.length > 0 && (
                      <div>
                        <h6 className="text-sm font-medium text-gray-700">Key insights:</h6>
                        <ul className="text-sm space-y-1">
                          {result.hints.map((hint: string, index: number) => (
                            <li key={index} className="flex gap-2">
                              <span className="text-blue-500">•</span>
                              <span>{hint}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}