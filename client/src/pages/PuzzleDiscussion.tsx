import React, { useState } from 'react';
import { Link } from 'wouter';
import { useWorstPerformingPuzzles } from '@/hooks/usePuzzle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Grid3X3, Eye, RefreshCw, AlertTriangle, MessageSquare, Target, TrendingDown, Github } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function PuzzleDiscussion() {
  const [selectedLimit, setSelectedLimit] = useState<number>(50);
  const [sortBy, setSortBy] = useState<string>('accuracy');
  const [compactView, setCompactView] = useState<boolean>(false);
  
  // Set page title
  React.useEffect(() => {
    document.title = 'ARC Puzzle Discussion - Lowest Accuracy Puzzles';
  }, []);

  const { puzzles, total, isLoading, error } = useWorstPerformingPuzzles(selectedLimit, sortBy);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Alert className="border-red-500 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load worst-performing puzzles. Please check your connection and try again.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const formatAccuracy = (accuracy: number) => {
    return Math.round(accuracy * 100) + '%';
  };

  const getAccuracyBadgeColor = (accuracy: number) => {
    if (accuracy === 0) return 'bg-red-100 text-red-800';
    if (accuracy < 0.3) return 'bg-orange-100 text-orange-800';
    if (accuracy < 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="text-center space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-red-900 to-orange-800 bg-clip-text text-transparent">
                Most Difficult Puzzles
              </h1>
              <p className="text-lg text-slate-600 mt-2">
                Puzzles with the Lowest LLM Accuracy Rates
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="outline" className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  Browse All
                </Button>
              </Link>
              <Link href="/model-examiner">
                <Button variant="outline" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Model Examiner
                </Button>
              </Link>
              <Link href="/overview">
                <Button variant="outline" className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  Database Overview
                </Button>
              </Link>
              <a
                href="https://github.com/your-github-username/arc-explainer"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  <span className="hidden sm:inline">Open Source</span>
                </Button>
              </a>
            </div>
          </div>

          {/* Mission Statement */}
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 text-sm text-slate-600 max-w-4xl mx-auto">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">Most Challenging Puzzles</h3>
                <p>
                  This page shows puzzles where LLMs have the most difficulty - sorted by lowest accuracy rates. 
                  These are the hardest puzzles for AI models to solve correctly, with 0% accuracy puzzles at the top.
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Controls */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <TrendingDown className="h-5 w-5 text-red-600" />
              Difficulty Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="limit-select" className="text-sm font-medium">
                  Show hardest:
                </label>
                <select
                  id="limit-select"
                  value={selectedLimit}
                  onChange={(e) => setSelectedLimit(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-200 rounded-md text-sm"
                >
                  <option value={25}>25 puzzles</option>
                  <option value={50}>50 puzzles</option>
                  <option value={75}>75 puzzles</option>
                  <option value={100}>100 puzzles</option>
                  <option value={150}>150 puzzles</option>
                  <option value={200}>200 puzzles</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="sort-select" className="text-sm font-medium">
                  Sort by:
                </label>
                <select
                  id="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-md text-sm"
                >
                  <option value="accuracy">Lowest Accuracy</option>
                  <option value="feedback">Most Negative Feedback</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="compact-toggle" className="text-sm font-medium">
                  Compact view:
                </label>
                <input
                  id="compact-toggle"
                  type="checkbox"
                  checked={compactView}
                  onChange={(e) => setCompactView(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-xs text-gray-500">{compactView ? 'On' : 'Off'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-slate-800">
              Most Difficult Puzzles
              {!isLoading && (
                <Badge variant="outline" className="ml-2 bg-red-50 text-red-700 border-red-200">
                  {total} found
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-gray-600">
              Puzzles with lowest LLM accuracy rates - sorted by difficulty
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading most difficult puzzles...</p>
              </div>
            ) : puzzles.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">No analyzed puzzles found.</p>
                <p className="text-sm text-gray-500 mt-2">
                  Run some AI analyses first!
                </p>
              </div>
            ) : (
              <div className={`grid gap-4 ${
                compactView 
                  ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' 
                  : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              }`}>
                {puzzles.map((puzzle: any) => (
                  <Card key={puzzle.id} className="hover:shadow-lg transition-all duration-200 border-0 bg-white/90 backdrop-blur-sm hover:bg-white/95 hover:scale-[1.02] border-l-4 border-l-red-400">
                    <CardContent className={compactView ? "p-3" : "p-4"}>
                      <div className={compactView ? "space-y-2" : "space-y-3"}>
                        <div className="flex items-center justify-between">
                          <code className="text-sm font-mono bg-red-100 px-2 py-1 rounded text-red-800">
                            {puzzle.id}
                          </code>
                          <div className="text-xs flex items-center gap-1">
                            <Grid3X3 className="h-3 w-3" /> 
                            {puzzle.maxGridSize ? `${puzzle.maxGridSize}x${puzzle.maxGridSize}` : 'Unknown'}
                            {puzzle.source && (
                              <Badge variant="outline" className={`text-xs ${
                                puzzle.source === 'ARC1' ? 'bg-blue-50 text-blue-700' : 
                                puzzle.source === 'ARC1-Eval' ? 'bg-cyan-50 text-cyan-700 font-semibold' : 
                                puzzle.source === 'ARC2' ? 'bg-purple-50 text-purple-700' : 
                                puzzle.source === 'ARC2-Eval' ? 'bg-green-50 text-green-700 font-bold' :
                                'bg-gray-50 text-gray-700'
                              }`}>
                                {puzzle.source?.replace('-Eval', ' Eval')}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Difficulty Metrics */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium text-red-700">LLM Difficulty</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className={`text-xs ${getAccuracyBadgeColor(puzzle.performanceData?.avgAccuracy || 0)}`}>
                              {formatAccuracy(puzzle.performanceData?.avgAccuracy || 0)} accuracy
                            </Badge>
                            {puzzle.performanceData?.wrongCount > 0 && (
                              <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">
                                {puzzle.performanceData.wrongCount} wrong
                              </Badge>
                            )}
                            {puzzle.performanceData?.negativeFeedback > 0 && (
                              <Badge variant="outline" className="bg-pink-50 text-pink-700 text-xs flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {puzzle.performanceData.negativeFeedback} negative
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex justify-between">
                            <span>Total Analyses:</span>
                            <span className="font-medium">{puzzle.performanceData?.totalExplanations || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Feedback:</span>
                            <span className="font-medium">{puzzle.performanceData?.totalFeedback || 0}</span>
                          </div>
                          {puzzle.performanceData?.latestAnalysis && (
                            <div className="flex justify-between">
                              <span>Latest:</span>
                              <span className="font-medium text-xs">
                                {new Date(puzzle.performanceData.latestAnalysis).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button asChild size="sm" className="flex-1 bg-red-600 hover:bg-red-700">
                            <Link href={`/examine/${puzzle.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              Analyze Puzzle
                            </Link>
                          </Button>
                          <Button asChild size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700">
                            <Link href={`/puzzle/${puzzle.id}/view`}>
                              <MessageSquare className="h-4 w-4 mr-1" />
                              View Database
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-orange-600" />
              Understanding Puzzle Difficulty
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="font-semibold text-slate-800 mb-2">📊 Accuracy Scoring</p>
                <ul className="space-y-1 text-slate-600">
                  <li>• <strong>0% Accuracy:</strong> No LLM got it right</li>
                  <li>• <strong>Low Accuracy (&lt;30%):</strong> Very few correct predictions</li>
                  <li>• <strong>Medium Accuracy (30-60%):</strong> Some success</li>
                  <li>• <strong>High Accuracy (&gt;60%):</strong> Most LLMs succeeded</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-800 mb-2">🔍 Analysis Options</p>
                <ul className="space-y-1 text-slate-600">
                  <li>• Click "Analyze Puzzle" to run AI analysis</li>
                  <li>• Click "View Database" to see all LLM attempts</li>
                  <li>• Try different models on challenging puzzles</li>
                  <li>• Compare results across different approaches</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-white/70 rounded p-3 mt-4">
              <p className="font-medium text-orange-800">
                💡 These puzzles represent the current frontier of AI reasoning ability. 
                0% accuracy puzzles are completely unsolved by current LLMs.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}