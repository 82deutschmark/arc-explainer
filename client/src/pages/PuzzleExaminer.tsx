import React, { useState } from 'react';
import { useParams } from 'wouter';
import { usePuzzle } from '@/hooks/usePuzzle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
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
  const [temperature, setTemperature] = useState<number>(0.75);

  const {
    task,
    isLoadingTask,
    taskError,
  } = usePuzzle(taskId);

  // Models that don't support temperature parameter  
  const modelsWithoutTemperature = new Set([
    'o3-mini-2025-01-31',
    'o4-mini-2025-04-16', 
    'o1-mini-2024-09-12'
  ]);

  // Available OpenAI models with token costs per million tokens
  const models = [
    { 
      key: 'gpt-4.1-nano-2025-04-14', 
      name: 'GPT-4.1 Nano', 
      color: 'bg-blue-500', 
      premium: false,
      cost: { input: '$0.10', output: '$0.40' },
      supportsTemperature: true
    },
    { 
      key: 'gpt-4.1-mini-2025-04-14', 
      name: 'GPT-4.1 Mini', 
      color: 'bg-purple-500', 
      premium: false,
      cost: { input: '$0.40', output: '$1.60' },
      supportsTemperature: true
    },
    { 
      key: 'gpt-4o-mini-2024-07-18', 
      name: 'GPT-4o Mini', 
      color: 'bg-orange-500', 
      premium: false,
      cost: { input: '$0.15', output: '$0.60' },
      supportsTemperature: true
    },
    { 
      key: 'o3-mini-2025-01-31', 
      name: 'o3-mini', 
      color: 'bg-red-500', 
      premium: true,
      cost: { input: '$1.10', output: '$4.40' },
      supportsTemperature: false
    },
    { 
      key: 'o4-mini-2025-04-16', 
      name: 'o4-mini', 
      color: 'bg-pink-500', 
      premium: true,
      cost: { input: '$1.10', output: '$4.40' },
      supportsTemperature: false
    },
    { 
      key: 'o1-mini-2024-09-12', 
      name: 'o1-mini-2024-09-12', 
      color: 'bg-green-500', 
      premium: true,
      cost: { input: '$1.10', output: '$4.40' },
      supportsTemperature: false
    },
    { 
      key: 'gpt-4.1-2025-04-14', 
      name: 'GPT-4.1', 
      color: 'bg-yellow-500', 
      premium: true,
      cost: { input: '$2.00', output: '$8.00' },
      supportsTemperature: true
    }
  ];

  // Save explained puzzle mutation
  const saveExplainedMutation = useMutation({
    mutationFn: async (explanations: Record<string, any>) => {
      const response = await apiRequest('POST', `/api/puzzle/save-explained/${taskId}`, { explanations });
      return response.json();
    }
  });

  // Test specific model
  const testModelMutation = useMutation({
    mutationFn: async (modelKey: string) => {
      const response = await apiRequest('POST', `/api/puzzle/analyze/${taskId}/${modelKey}`, { temperature });
      return response.json();
    },
    onSuccess: (data, modelKey) => {
      const newResults = { ...analysisResults, [modelKey]: data };
      setAnalysisResults(newResults);
      
      // Auto-save when we have explanations (after first model analysis)
      if (Object.keys(newResults).length >= 1) {
        saveExplainedMutation.mutate(newResults);
      }
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
            Failed to load puzzle: {taskError?.message || 'Puzzle not found'}
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
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Test how different AI models explain why this solution is correct and what the aliens might mean
            </p>
            {saveExplainedMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving explained puzzle...
              </div>
            )}
            {saveExplainedMutation.isSuccess && (
              <div className="text-sm text-green-600">
                ✓ Saved as {taskId}-EXPLAINED.json
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
            {models.map((model) => (
              <Button
                key={model.key}
                variant="outline"
                className={`h-auto p-3 flex flex-col items-center gap-2 relative text-left ${
                  analysisResults[model.key] ? 'ring-2 ring-green-500' : ''
                } ${model.premium ? 'border-amber-300 bg-amber-50' : ''}`}
                onClick={() => testModelMutation.mutate(model.key)}
                disabled={testModelMutation.isPending}
              >
                {model.premium && (
                  <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs px-1 rounded-full">
                    💰
                  </div>
                )}
                
                <div className="flex items-center gap-2 w-full">
                  {testModelMutation.isPending && testModelMutation.variables === model.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
                      analysisResults[model.key] ? 'bg-green-500' : model.color
                    }`} />
                  )}
                  <span className="text-sm font-medium">{model.name}</span>
                </div>
                
                <div className="text-xs text-gray-600 w-full">
                  <div>In: {model.cost.input}/M tokens</div>
                  <div>Out: {model.cost.output}/M tokens</div>
                  {!model.supportsTemperature && (
                    <div className="text-amber-600 font-medium">⚙️ No temperature control</div>
                  )}
                </div>
              </Button>
            ))}
          </div>
          
          {/* Temperature Control */}
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-4">
              <Label htmlFor="temperature" className="text-sm font-medium">
                Temperature: {temperature}
              </Label>
              <div className="flex-1 max-w-xs">
                <Slider
                  id="temperature"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={[temperature]}
                  onValueChange={(value) => setTemperature(value[0])}
                  className="w-full"
                />
              </div>
              <span className="text-xs text-gray-600">
                Controls creativity (some models don't support this)
              </span>
            </div>
          </div>

          {/* Cost Information */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 Costs shown per million tokens. Most puzzle analyses use ~1K-5K tokens.
              Premium models (💰) provide advanced reasoning but cost more.
            </p>
          </div>

          {/* Analysis Results */}
          {Object.keys(analysisResults).length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold">Model Explanations</h4>
              {Object.entries(analysisResults).map(([modelKey, result]: [string, any]) => {
                const model = models.find(m => m.key === modelKey);
                return (
                  <div key={modelKey} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className={`w-3 h-3 rounded-full ${model?.color || 'bg-gray-500'}`} />
                      <h5 className="font-medium">{model?.name || modelKey}</h5>
                      {/* Display multiple confidence scores */}
                      {result.patternConfidence && (
                        <Badge variant="outline" className="text-xs">
                          Pattern: {Math.round(result.patternConfidence * 100)}%
                        </Badge>
                      )}
                      {result.strategyConfidence && (
                        <Badge variant="outline" className="text-xs">
                          Strategy: {Math.round(result.strategyConfidence * 100)}%
                        </Badge>
                      )}
                      {result.hintsConfidence && (
                        <Badge variant="outline" className="text-xs">
                          Hints: {Math.round(result.hintsConfidence * 100)}%
                        </Badge>
                      )}
                      {result.alienMeaningConfidence && (
                        <Badge variant="outline" className="text-xs">
                          Alien: {Math.round(result.alienMeaningConfidence * 100)}%
                        </Badge>
                      )}
                      {/* Fallback for old confidence format */}
                      {result.confidence && !result.patternConfidence && (
                        <Badge variant="outline">
                          {typeof result.confidence === 'string' 
                            ? result.confidence 
                            : Math.round(result.confidence * 100) + '%'} confident
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