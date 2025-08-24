/**
 * ResearchDashboard Component
 * Elegant research-focused dashboard with leaderboards and advanced search for ARC puzzle analysis
 * Designed for researchers to easily find patterns, model discrepancies, and performance insights
 * 
 * @author Cascade
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, 
  TrendingUp, 
  Brain, 
  Search,
  Filter,
  BarChart3,
  Zap,
  Target,
  AlertTriangle
} from 'lucide-react';

interface ModelPerformance {
  modelName: string;
  displayName: string;
  provider: string;
  totalAttempts: number;
  correctPredictions: number;
  accuracyPercentage: number;
  avgConfidence: number;
  avgAccuracyScore: number;
  successfulExtractions: number;
  extractionSuccessRate: number;
}

interface SaturnPerformance {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  recentResults: Array<{
    puzzleId: string;
    solved: boolean;
    createdAt: string;
  }>;
}

interface ModelDiscrepancy {
  puzzleId: string;
  source: string;
  models: Array<{
    modelName: string;
    correct: boolean;
    confidence: number;
    accuracyScore: number;
  }>;
  agreementRate: number;
  highestConfidence: number;
  lowestConfidence: number;
}

interface ResearchDashboardProps {
  modelPerformance: ModelPerformance[];
  saturnPerformance: SaturnPerformance;
  modelDiscrepancies: ModelDiscrepancy[];
  totalPuzzles: number;
  puzzlesWithExplanations: number;
  puzzlesWithSaturnResults: number;
  isLoading: boolean;
}

export function ResearchDashboard({
  modelPerformance,
  saturnPerformance,
  modelDiscrepancies,
  totalPuzzles,
  puzzlesWithExplanations,
  puzzlesWithSaturnResults,
  isLoading
}: ResearchDashboardProps) {
  const [selectedView, setSelectedView] = useState('leaderboards');

  // Top performing models by accuracy
  const topPerformers = useMemo(() => {
    if (!Array.isArray(modelPerformance)) return [];
    return [...modelPerformance]
      .sort((a, b) => b.accuracyPercentage - a.accuracyPercentage)
      .slice(0, 10);
  }, [modelPerformance]);

  // Models with highest extraction success rates
  const extractionLeaders = useMemo(() => {
    if (!Array.isArray(modelPerformance)) return [];
    return [...modelPerformance]
      .sort((a, b) => b.extractionSuccessRate - a.extractionSuccessRate)
      .slice(0, 10);
  }, [modelPerformance]);

  // Most controversial puzzles (highest model disagreement)
  const controversialPuzzles = useMemo(() => {
    if (!Array.isArray(modelDiscrepancies)) return [];
    return [...modelDiscrepancies]
      .sort((a, b) => a.agreementRate - b.agreementRate)
      .slice(0, 10);
  }, [modelDiscrepancies]);

  // High confidence failures (models very confident but wrong)
  const confidenceFailures = useMemo(() => {
    if (!Array.isArray(modelDiscrepancies)) return [];
    return modelDiscrepancies
      .flatMap(puzzle => 
        puzzle.models
          .filter(model => !model.correct && model.confidence > 80)
          .map(model => ({
            puzzleId: puzzle.puzzleId,
            source: puzzle.source,
            modelName: model.modelName,
            confidence: model.confidence,
            accuracyScore: model.accuracyScore
          }))
      )
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 15);
  }, [modelDiscrepancies]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-gray-200 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-16 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Statistics Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{totalPuzzles}</p>
                <p className="text-xs text-muted-foreground">Total Puzzles</p>
              </div>
              <Brain className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{puzzlesWithExplanations}</p>
                <p className="text-xs text-muted-foreground">With AI Analysis</p>
              </div>
              <Target className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{puzzlesWithSaturnResults}</p>
                <p className="text-xs text-muted-foreground">🪐 Saturn Attempts</p>
              </div>
              <Zap className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{saturnPerformance.successRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">🪐 Success Rate</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs value={selectedView} onValueChange={setSelectedView} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="leaderboards" className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Leaderboards
          </TabsTrigger>
          <TabsTrigger value="discrepancies" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Model Discrepancies
          </TabsTrigger>
          <TabsTrigger value="saturn" className="flex items-center gap-2">
            <span>🪐</span>
            Saturn Analysis
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Research Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboards" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Accuracy Leaderboard */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Top Accuracy Leaders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topPerformers.map((model, index) => (
                    <div key={model.modelName} className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-yellow-50 to-orange-50 border">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-800 font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{model.displayName}</div>
                          <div className="text-xs text-gray-600">{model.totalAttempts} attempts</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-yellow-100 text-yellow-800">
                          {model.accuracyPercentage}%
                        </Badge>
                        <div className="text-xs text-gray-500 mt-1">
                          {Math.round(model.avgAccuracyScore * 100)}% trust
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Extraction Success Leaderboard */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-blue-500" />
                  Extraction Success Leaders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {extractionLeaders.map((model, index) => (
                    <div key={model.modelName} className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold text-sm">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{model.displayName}</div>
                          <div className="text-xs text-gray-600">{model.successfulExtractions}/{model.totalAttempts} extracted</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className="bg-blue-100 text-blue-800">
                          {model.extractionSuccessRate}%
                        </Badge>
                        <div className="text-xs text-gray-500 mt-1">
                          Avg conf: {model.avgConfidence}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="discrepancies" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Most Controversial Puzzles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Most Controversial Puzzles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {controversialPuzzles.map((puzzle) => (
                    <div key={puzzle.puzzleId} className="p-3 rounded-lg bg-red-50 border border-red-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">{puzzle.puzzleId}</span>
                          <Badge variant="outline" className="text-xs">{puzzle.source}</Badge>
                        </div>
                        <Badge className="bg-red-100 text-red-800">
                          {puzzle.agreementRate}% agreement
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-600">
                        {puzzle.models.length} models tested • 
                        Confidence range: {puzzle.lowestConfidence}%-{puzzle.highestConfidence}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* High Confidence Failures */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-orange-500" />
                  Overconfident Failures
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {confidenceFailures.map((failure, index) => (
                    <div key={`${failure.puzzleId}-${failure.modelName}-${index}`} className="p-3 rounded-lg bg-orange-50 border border-orange-100">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{failure.puzzleId}</span>
                          <Badge variant="outline" className="text-xs">{failure.source}</Badge>
                        </div>
                        <Badge className="bg-orange-100 text-orange-800">
                          {failure.confidence}% confident
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-600">
                        {failure.modelName} • Accuracy: {Math.round(failure.accuracyScore * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="saturn" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Saturn Overview */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🪐</span>
                  Saturn Visual Solver Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">{saturnPerformance.successCount}</div>
                    <div className="text-sm text-green-600">Puzzles Solved</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-700">{saturnPerformance.failureCount}</div>
                    <div className="text-sm text-red-600">Failed Attempts</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-700">{saturnPerformance.successRate.toFixed(1)}%</div>
                    <div className="text-sm text-purple-600">Success Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Saturn Results */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent Saturn Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {saturnPerformance.recentResults.slice(0, 8).map((result) => (
                    <div key={result.puzzleId} className="flex items-center justify-between text-sm">
                      <span className="font-mono">{result.puzzleId}</span>
                      <Badge className={result.solved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {result.solved ? '✅' : '❌'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="text-center py-12">
            <BarChart3 className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Advanced Research Insights</h3>
            <p className="text-gray-500">Coming soon: Pattern analysis, difficulty correlations, and model behavior insights</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
