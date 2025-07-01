import React, { useState } from 'react';
import { useParams } from 'wouter';
import { usePuzzle } from '@/hooks/usePuzzle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, Hash, Lightbulb, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { getSpaceEmoji } from '@/lib/spaceEmojis';
import { Link } from 'wouter';

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
                className="w-8 h-8 border border-gray-200 flex items-center justify-center text-xs font-mono"
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
  
  const {
    task,
    analysis,
    isLoadingTask,
    isLoadingAnalysis,
    taskError,
  } = usePuzzle(taskId);

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Training Examples */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Training Examples
                <Badge variant="outline">{task.train.length} examples</Badge>
              </CardTitle>
              <p className="text-sm text-gray-600">
                These are the alien communication patterns we've observed
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {task.train.map((example, index) => (
                <div key={index} className="border-b border-gray-100 pb-4 last:border-b-0">
                  <h3 className="text-sm font-medium mb-3 text-gray-800">
                    Training Example {index + 1}
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <GridDisplay 
                      grid={example.input} 
                      title="Input Signal"
                      showEmojis={showEmojis}
                    />
                    <div className="flex items-center justify-center">
                      <div className="text-2xl text-gray-400">→</div>
                    </div>
                    <GridDisplay 
                      grid={example.output} 
                      title="Output Pattern"
                      showEmojis={showEmojis}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Test Case & Solution */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Test Case & Correct Answer</CardTitle>
              <p className="text-sm text-gray-600">
                The aliens gave us this input and expect this output
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.test.map((testCase, index) => (
                <div key={index} className="space-y-4">
                  <GridDisplay 
                    grid={testCase.input} 
                    title="Test Input Signal"
                    showEmojis={showEmojis}
                  />
                  
                  <div className="flex items-center justify-center py-2">
                    <div className="text-2xl text-green-500">↓</div>
                  </div>
                  
                  <GridDisplay 
                    grid={testCase.output} 
                    title="Correct Output Pattern"
                    showEmojis={showEmojis}
                    className="bg-green-50 p-3 rounded-lg border-2 border-green-200"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* AI Analysis */}
        {showAnalysis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                AI Pattern Analysis
              </CardTitle>
              <p className="text-sm text-gray-600">
                Our AI's attempt to understand the alien communication logic
              </p>
            </CardHeader>
            <CardContent>
              {isLoadingAnalysis ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing alien communication pattern...</span>
                </div>
              ) : analysis ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Pattern Description</h4>
                    <p className="text-gray-700">{analysis.patternDescription}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Solving Strategy</h4>
                    <p className="text-gray-700">{analysis.solvingStrategy}</p>
                  </div>
                  
                  {analysis.hints && analysis.hints.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Key Insights</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {analysis.hints.map((hint, index) => (
                          <li key={index} className="text-gray-700">{hint}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 mt-4">
                    <span className="text-sm text-gray-600">AI Confidence:</span>
                    <Badge variant={analysis.confidence > 0.7 ? "default" : "secondary"}>
                      {Math.round(analysis.confidence * 100)}%
                    </Badge>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertDescription>
                    Unable to analyze this pattern. The alien communication may be too complex for our current AI understanding.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}