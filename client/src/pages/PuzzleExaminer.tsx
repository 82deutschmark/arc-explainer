import React, { useState } from 'react';
import { useParams } from 'wouter';
import { usePuzzle } from '@/hooks/usePuzzle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, Hash, Lightbulb, ArrowLeft, Brain } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { getSpaceEmoji } from '@/lib/spaceEmojis';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';

function GridDisplay({ 
  grid, 
  title, 
  showEmojis = true,
  className = ""
}: { 
  grid: number[][], 
  title: string,
  showEmojis?: boolean,
  className?: string 
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <h4 className="text-sm font-medium text-gray-700">{title}</h4>
      <div className="inline-block border border-gray-300 rounded">
        {grid.map((row, rowIndex) => (
          <div key={rowIndex} className="flex">
            {row.map((cell, colIndex) => (
              <div
                key={colIndex}
                className="w-6 h-6 border border-gray-200 flex items-center justify-center text-xs font-mono"
                style={{ 
                  backgroundColor: showEmojis ? 'white' : getBackgroundColor(cell)
                }}
              >
                {showEmojis ? getSpaceEmoji(cell) : cell}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        {grid.length} × {grid[0]?.length || 0} grid
      </p>
    </div>
  );
}

function getBackgroundColor(value: number): string {
  const colors = [
    '#000000', // 0 - black
    '#0074D9', // 1 - blue  
    '#FF4136', // 2 - red
    '#2ECC40', // 3 - green
    '#FFDC00', // 4 - yellow
    '#AAAAAA', // 5 - gray
    '#F012BE', // 6 - magenta
    '#FF851B', // 7 - orange
    '#7FDBFF', // 8 - aqua
    '#870C25', // 9 - maroon
  ];
  return colors[value] || '#FFFFFF';
}

export default function PuzzleExaminer() {
  const { taskId } = useParams();
  const [showEmojis, setShowEmojis] = useState(true);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [analysisResults, setAnalysisResults] = useState<{[key: string]: any}>({});
  
  const {
    task,
    analysis,
    isLoadingTask,
    isLoadingAnalysis,
    taskError,
  } = usePuzzle(taskId);

  // Available OpenAI models
  const models = [
    { key: 'gpt-4o', name: 'GPT-4o' },
    { key: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { key: 'gpt-4o-nano', name: 'GPT-4.1 Nano' },
    { key: 'o1-mini-2025', name: 'o1-mini 2025' },
    { key: 'gpt-4o-mini-2025', name: 'GPT-4.1 Mini' },
    { key: 'gpt-4o-mini-legacy', name: 'GPT-4o Mini Legacy' }
  ];

  // Test specific model
  const testModelMutation = useMutation({
    mutationFn: async (modelKey: string) => {
      // First set the model
      await apiRequest('POST', '/api/openai/model', { model: modelKey });
      // Then get analysis
      const response = await apiRequest('GET', `/api/puzzle/analyze/${taskId}`);
      return response.json();
    },
    onSuccess: (data, modelKey) => {
      setAnalysisResults(prev => ({ ...prev, [modelKey]: data }));
    }
  });

  if (isLoadingTask) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading alien communication pattern...</p>
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
              <h2 className="text-xl font-semibold mb-2">Pattern Not Found</h2>
              <p className="text-gray-600 mb-4">
                Could not load this alien communication pattern.
              </p>
              <Link href="/">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Browser
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!task) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Browser
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Alien Communication Pattern</h1>
              <p className="text-gray-600">Examining pattern ID: {taskId}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={showEmojis ? "default" : "outline"}
              size="sm"
              onClick={() => setShowEmojis(!showEmojis)}
            >
              {showEmojis ? <Eye className="h-4 w-4 mr-2" /> : <Hash className="h-4 w-4 mr-2" />}
              {showEmojis ? 'Emoji View' : 'Number View'}
            </Button>
            
            <Button
              variant={showAnalysis ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAnalysis(!showAnalysis)}
              disabled={isLoadingAnalysis}
            >
              {isLoadingAnalysis ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Lightbulb className="h-4 w-4 mr-2" />
              )}
              AI Analysis
            </Button>
          </div>
        </div>

        {/* Compact Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Training Examples - Compact */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Training Examples</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {task.train.map((example, index) => (
                <div key={index} className="border-b border-gray-100 pb-3 last:border-b-0">
                  <h4 className="text-xs font-medium mb-2 text-gray-600">Example {index + 1}</h4>
                  <div className="flex items-center gap-3">
                    <GridDisplay 
                      grid={example.input} 
                      title="Input"
                      showEmojis={showEmojis}
                    />
                    <div className="text-lg text-gray-400">→</div>
                    <GridDisplay 
                      grid={example.output} 
                      title="Output"
                      showEmojis={showEmojis}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Test Case */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Test & Answer</CardTitle>
            </CardHeader>
            <CardContent>
              {task.test.map((testCase, index) => (
                <div key={index} className="space-y-3">
                  <GridDisplay 
                    grid={testCase.input} 
                    title="Test Input"
                    showEmojis={showEmojis}
                  />
                  <div className="text-center">
                    <div className="text-lg text-green-500">↓</div>
                  </div>
                  <GridDisplay 
                    grid={testCase.output} 
                    title="Correct Answer"
                    showEmojis={showEmojis}
                    className="bg-green-50 p-2 rounded border-2 border-green-200"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* AI Model Testing */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Models
              </CardTitle>
              <p className="text-sm text-gray-600">Test different models' explanations</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {models.map((model) => (
                <Button
                  key={model.key}
                  variant={analysisResults[model.key] ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => testModelMutation.mutate(model.key)}
                  disabled={testModelMutation.isPending}
                >
                  {testModelMutation.isPending && testModelMutation.variables === model.key ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                  ) : analysisResults[model.key] ? (
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2" />
                  ) : (
                    <div className="w-3 h-3 border border-gray-300 rounded-full mr-2" />
                  )}
                  {model.name}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Model Analysis Results */}
        {Object.keys(analysisResults).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Model Analysis Comparison
              </CardTitle>
              <p className="text-sm text-gray-600">
                Different AI models' explanations of the alien communication pattern
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(analysisResults).map(([modelKey, result]: [string, any]) => {
                const model = models.find(m => m.key === modelKey);
                return (
                  <div key={modelKey} className="border-l-4 border-blue-200 pl-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline">{model?.name || modelKey}</Badge>
                      {result.confidence && (
                        <Badge variant={result.confidence > 0.7 ? "default" : "secondary"}>
                          {Math.round(result.confidence * 100)}% confidence
                        </Badge>
                      )}
                    </div>
                    
                    {result.patternDescription && (
                      <div className="mb-3">
                        <h4 className="text-sm font-medium mb-1">Pattern Explanation</h4>
                        <p className="text-sm text-gray-700">{result.patternDescription}</p>
                      </div>
                    )}
                    
                    {result.solvingStrategy && (
                      <div className="mb-3">
                        <h4 className="text-sm font-medium mb-1">How It Works</h4>
                        <p className="text-sm text-gray-700">{result.solvingStrategy}</p>
                      </div>
                    )}
                    
                    {result.hints && result.hints.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-1">Key Insights</h4>
                        <ul className="text-sm text-gray-700 space-y-1">
                          {result.hints.map((hint: string, index: number) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-blue-500 mt-1">•</span>
                              <span>{hint}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}