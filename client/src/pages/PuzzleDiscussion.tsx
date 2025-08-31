import React, { useState } from 'react';
import { Link } from 'wouter';
import { useWorstPerformingPuzzles } from '@/hooks/usePuzzle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Grid3X3, Eye, RefreshCw, AlertTriangle, MessageSquare, Target, TrendingDown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function PuzzleDiscussion() {
  const [selectedLimit, setSelectedLimit] = useState<number>(20);
  
  // Set page title
  React.useEffect(() => {
    document.title = 'ARC Puzzle Discussion - Retry Analysis';
  }, []);

  const { puzzles, total, isLoading, error } = useWorstPerformingPuzzles(selectedLimit);

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

  const formatPerformanceScore = (score: number) => {
    return Math.round(score * 10) / 10;
  };

  const getPerformanceBadgeColor = (score: number) => {
    if (score >= 15) return 'bg-red-100 text-red-800';
    if (score >= 10) return 'bg-orange-100 text-orange-800';
    if (score >= 5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="text-center space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-red-900 to-orange-800 bg-clip-text text-transparent">
                ARC Puzzle Discussion
              </h1>
              <p className="text-lg text-slate-600 mt-2">
                Retry Analysis for Problematic Puzzles
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
            </div>
          </div>

          {/* Mission Statement */}
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 text-sm text-slate-600 max-w-4xl mx-auto">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-slate-800 mb-2">Discussion & Retry Analysis</h3>
                <p>
                  This page shows puzzles with poor AI analysis results - incorrect predictions, low trustworthiness scores, 
                  or negative user feedback. Use the enhanced retry system to run new analysis with improved prompting that 
                  includes context about previous failures.
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
              Performance Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="limit-select" className="text-sm font-medium">
                  Show worst:
                </label>
                <select
                  id="limit-select"
                  value={selectedLimit}
                  onChange={(e) => setSelectedLimit(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-200 rounded-md text-sm"
                >
                  <option value={10}>10 puzzles</option>
                  <option value={20}>20 puzzles</option>
                  <option value={30}>30 puzzles</option>
                  <option value={50}>50 puzzles</option>
                </select>
              </div>
              <div className="text-sm text-gray-600">
                Sorted by composite performance score (incorrect predictions, low accuracy, negative feedback)
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-slate-800">
              Worst-Performing Puzzles
              {!isLoading && (
                <Badge variant="outline" className="ml-2 bg-red-50 text-red-700 border-red-200">
                  {total} found
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-gray-600">
              Puzzles requiring improved analysis - retry with enhanced prompting
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Loading worst-performing puzzles...</p>
              </div>
            ) : puzzles.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">No problematic puzzles found.</p>
                <p className="text-sm text-gray-500 mt-2">
                  All analyzed puzzles are performing well!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {puzzles.map((puzzle: any) => (
                  <Card key={puzzle.id} className="hover:shadow-lg transition-all duration-200 border-0 bg-white/90 backdrop-blur-sm hover:bg-white/95 hover:scale-[1.02] border-l-4 border-l-red-400">
                    <CardContent className="p-4">
                      <div className="space-y-3">
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
                        
                        {/* Performance Issues */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium text-red-700">Performance Issues</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1">
                            {puzzle.performanceData?.wrongCount > 0 && (
                              <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">
                                {puzzle.performanceData.wrongCount} wrong predictions
                              </Badge>
                            )}
                            {puzzle.performanceData?.avgAccuracy < 0.7 && (
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 text-xs">
                                {Math.round(puzzle.performanceData.avgAccuracy * 100)}% accuracy
                              </Badge>
                            )}
                            {puzzle.performanceData?.avgConfidence < 50 && (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 text-xs">
                                {Math.round(puzzle.performanceData.avgConfidence)}% confidence
                              </Badge>
                            )}
                            {puzzle.performanceData?.negativeFeedback > 0 && (
                              <Badge variant="outline" className="bg-pink-50 text-pink-700 text-xs flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {puzzle.performanceData.negativeFeedback} negative
                              </Badge>
                            )}
                          </div>

                          {/* Composite Score */}
                          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                            <span className="text-xs text-gray-600">Performance Score:</span>
                            <Badge className={`text-xs ${getPerformanceBadgeColor(puzzle.performanceData?.compositeScore || 0)}`}>
                              {formatPerformanceScore(puzzle.performanceData?.compositeScore || 0)}
                            </Badge>
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
                            <Link href={`/puzzle/${puzzle.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              Retry Analysis
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
              How to Use the Discussion Page
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="font-semibold text-slate-800 mb-2">📊 Performance Scoring</p>
                <ul className="space-y-1 text-slate-600">
                  <li>• <strong>Wrong Predictions:</strong> 5 points per incorrect result</li>
                  <li>• <strong>Low Accuracy:</strong> 5 points if trustworthiness &lt; 50%</li>
                  <li>• <strong>Low Confidence:</strong> 3 points if confidence &lt; 50%</li>
                  <li>• <strong>Negative Feedback:</strong> 2 points per negative vote</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-800 mb-2">🔄 Retry Process</p>
                <ul className="space-y-1 text-slate-600">
                  <li>• Click "Retry Analysis" to examine a problematic puzzle</li>
                  <li>• Use enhanced prompting with failure context</li>
                  <li>• Compare new results with original failed analyses</li>
                  <li>• Provide feedback on improvement quality</li>
                </ul>
              </div>
            </div>
            
            <div className="bg-white/70 rounded p-3 mt-4">
              <p className="font-medium text-orange-800">
                💡 Enhanced Prompting: The retry system automatically includes context about previous failures, 
                negative feedback comments, and specific issues to help AI models provide better analysis.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}