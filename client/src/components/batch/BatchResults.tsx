/**
 * BatchResults.tsx
 * 
 * Detailed batch results dashboard component.
 * Displays comprehensive analytics, individual puzzle results, and export functionality.
 * Integrates with batch API to show detailed analysis results and performance metrics.
 * 
 * @author Cascade
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { Download, TrendingUp, Clock, Target, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface BatchResult {
  puzzle_id: string;
  explanation_id?: number;
  processing_time_ms: number;
  accuracy_score?: number;
  success: boolean;
  error_message?: string;
  created_at: string;
}

interface BatchRun {
  id: number;
  dataset: string;
  model: string;
  status: string;
  created_at: string;
  completed_at?: string;
  processed_count: number;
  total_puzzles: number;
  success_count: number;
  error_count: number;
  average_accuracy?: number;
  total_processing_time_ms?: number;
}

interface BatchAnalytics {
  totalRuns: number;
  totalPuzzlesSolved: number;
  overallSuccessRate: number;
  averageAccuracy: number;
  averageProcessingTime: number;
  modelPerformance: Array<{
    model: string;
    runs: number;
    successRate: number;
    avgAccuracy: number;
    avgTime: number;
  }>;
  datasetPerformance: Array<{
    dataset: string;
    runs: number;
    successRate: number;
    avgAccuracy: number;
  }>;
}

interface BatchResultsProps {
  batchId?: number;
  showAnalytics?: boolean;
}

export function BatchResults({ batchId, showAnalytics = true }: BatchResultsProps) {
  const [batchRun, setBatchRun] = useState<BatchRun | null>(null);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [analytics, setAnalytics] = useState<BatchAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<number | undefined>(batchId);
  const [availableBatches, setAvailableBatches] = useState<BatchRun[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('created_at');

  useEffect(() => {
    fetchAvailableBatches();
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      fetchBatchResults(selectedBatchId);
    }
  }, [selectedBatchId]);

  const fetchAvailableBatches = async () => {
    try {
      const response = await fetch('/api/batch/list');
      const data = await response.json();
      if (data.success) {
        const completedBatches = data.data.filter((b: BatchRun) => b.status === 'completed');
        setAvailableBatches(completedBatches);
        
        if (!selectedBatchId && completedBatches.length > 0) {
          setSelectedBatchId(completedBatches[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch available batches:', err);
    }
  };

  const fetchBatchResults = async (batchId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch batch run details
      const batchResponse = await fetch(`/api/batch/${batchId}`);
      const batchData = await batchResponse.json();
      
      if (batchData.success) {
        setBatchRun(batchData.data);
      }

      // Fetch detailed results
      const resultsResponse = await fetch(`/api/batch/${batchId}/results`);
      const resultsData = await resultsResponse.json();
      
      if (resultsData.success) {
        setResults(resultsData.data);
        
        if (showAnalytics) {
          await generateAnalytics(resultsData.data);
        }
      } else {
        setError(resultsData.message || 'Failed to fetch results');
      }
    } catch (err) {
      setError('Network error: Failed to fetch batch results');
      console.error('Fetch batch results error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateAnalytics = async (results: BatchResult[]) => {
    try {
      // This is a simplified version - in a real app, this might come from a dedicated analytics endpoint
      const totalPuzzles = results.length;
      const successfulResults = results.filter(r => r.success);
      const accuracyScores = results.filter(r => r.accuracy_score !== null).map(r => r.accuracy_score!);
      const processingTimes = results.map(r => r.processing_time_ms);

      const mockAnalytics: BatchAnalytics = {
        totalRuns: availableBatches.length,
        totalPuzzlesSolved: totalPuzzles,
        overallSuccessRate: totalPuzzles > 0 ? (successfulResults.length / totalPuzzles) * 100 : 0,
        averageAccuracy: accuracyScores.length > 0 ? (accuracyScores.reduce((a, b) => a + b, 0) / accuracyScores.length) * 100 : 0,
        averageProcessingTime: processingTimes.length > 0 ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length : 0,
        modelPerformance: [],
        datasetPerformance: []
      };

      setAnalytics(mockAnalytics);
    } catch (err) {
      console.error('Error generating analytics:', err);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const exportResults = () => {
    if (!results || !batchRun) return;
    
    const csvContent = [
      ['Puzzle ID', 'Success', 'Accuracy Score', 'Processing Time (ms)', 'Error Message', 'Created At'].join(','),
      ...results.map(result => [
        result.puzzle_id,
        result.success ? 'Yes' : 'No',
        result.accuracy_score?.toFixed(3) || '',
        result.processing_time_ms.toString(),
        result.error_message || '',
        new Date(result.created_at).toISOString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `batch_${batchRun.id}_results.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredResults = results.filter(result => {
    if (filterStatus === 'success') return result.success;
    if (filterStatus === 'error') return !result.success;
    return true;
  });

  const sortedResults = [...filteredResults].sort((a, b) => {
    switch (sortBy) {
      case 'accuracy':
        return (b.accuracy_score || 0) - (a.accuracy_score || 0);
      case 'processing_time':
        return b.processing_time_ms - a.processing_time_ms;
      case 'puzzle_id':
        return a.puzzle_id.localeCompare(b.puzzle_id);
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  if (availableBatches.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">No completed batch runs available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Batch Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Batch Results Analysis</CardTitle>
          <CardDescription>
            View detailed results and analytics for completed batch runs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <Select
                value={selectedBatchId?.toString() || ''}
                onValueChange={(value) => setSelectedBatchId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select batch run" />
                </SelectTrigger>
                <SelectContent>
                  {availableBatches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id.toString()}>
                      Batch #{batch.id} - {batch.model} on {batch.dataset} 
                      ({new Date(batch.created_at).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={exportResults}
              variant="outline"
              disabled={!results.length}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {error && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            Loading results...
          </CardContent>
        </Card>
      ) : batchRun && (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="results">Detailed Results</TabsTrigger>
            {showAnalytics && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                      <p className="text-2xl font-bold text-green-600">
                        {((batchRun.success_count / batchRun.processed_count) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Accuracy</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {batchRun.average_accuracy ? (batchRun.average_accuracy * 100).toFixed(1) + '%' : 'N/A'}
                      </p>
                    </div>
                    <Target className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Time</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {batchRun.total_processing_time_ms ? formatDuration(batchRun.total_processing_time_ms) : 'N/A'}
                      </p>
                    </div>
                    <Clock className="w-8 h-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Error Rate</p>
                      <p className="text-2xl font-bold text-red-600">
                        {((batchRun.error_count / batchRun.processed_count) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <XCircle className="w-8 h-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Batch Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Model:</span>
                    <Badge variant="secondary">{batchRun.model}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Dataset:</span>
                    <Badge variant="outline">{batchRun.dataset}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Started:</span>
                    <span className="text-sm">{new Date(batchRun.created_at).toLocaleString()}</span>
                  </div>
                  {batchRun.completed_at && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Completed:</span>
                      <span className="text-sm">{new Date(batchRun.completed_at).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Progress:</span>
                    <span className="text-sm">{batchRun.processed_count} / {batchRun.total_puzzles}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Detailed Results Tab */}
          <TabsContent value="results" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Individual Results</CardTitle>
                <div className="flex gap-2">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Results</SelectItem>
                      <SelectItem value="success">Success Only</SelectItem>
                      <SelectItem value="error">Errors Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Sort by Time</SelectItem>
                      <SelectItem value="puzzle_id">Sort by Puzzle</SelectItem>
                      <SelectItem value="accuracy">Sort by Accuracy</SelectItem>
                      <SelectItem value="processing_time">Sort by Speed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Puzzle ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Accuracy</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedResults.map((result) => (
                      <TableRow key={result.puzzle_id}>
                        <TableCell className="font-mono text-sm">
                          {result.puzzle_id}
                        </TableCell>
                        <TableCell>
                          <Badge variant={result.success ? 'default' : 'destructive'}>
                            {result.success ? 'Success' : 'Error'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {result.accuracy_score 
                            ? `${(result.accuracy_score * 100).toFixed(1)}%` 
                            : 'N/A'}
                        </TableCell>
                        <TableCell>{formatDuration(result.processing_time_ms)}</TableCell>
                        <TableCell className="text-sm text-red-600">
                          {result.error_message || ''}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          {showAnalytics && (
            <TabsContent value="analytics" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Analytics</CardTitle>
                  <CardDescription>
                    Detailed performance metrics and trends
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">Total Puzzles</p>
                                <p className="text-xl font-bold">{analytics.totalPuzzlesSolved}</p>
                              </div>
                              <TrendingUp className="w-6 h-6 text-blue-600" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">Overall Success</p>
                                <p className="text-xl font-bold">{analytics.overallSuccessRate.toFixed(1)}%</p>
                              </div>
                              <CheckCircle2 className="w-6 h-6 text-green-600" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-muted-foreground">Avg Processing</p>
                                <p className="text-xl font-bold">{formatDuration(analytics.averageProcessingTime)}</p>
                              </div>
                              <Clock className="w-6 h-6 text-purple-600" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Analytics will be available once results are loaded.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}

export default BatchResults;
