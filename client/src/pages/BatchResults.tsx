import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye,
  Download,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { MODELS } from '@/constants/models';

interface BatchSession {
  id: string;
  modelKey: string;
  dataset: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';
  createdAt: string;
  completedAt?: string;
  totalPuzzles: number;
  completedPuzzles: number;
  successfulPuzzles: number;
  failedPuzzles: number;
  averageProcessingTime?: number;
  overallAccuracy?: number;
}

interface BatchResult {
  id: number;
  sessionId: string;
  puzzleId: string;
  status: 'pending' | 'completed' | 'failed';
  explanationId?: number;
  processingTimeMs?: number;
  accuracyScore?: number;
  isCorrect?: boolean;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export default function BatchResults() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Set page title
  useEffect(() => {
    document.title = 'Batch Analysis Results';
  }, []);

  // Fetch all batch sessions
  const { 
    data: sessionsData, 
    isLoading: sessionsLoading, 
    error: sessionsError,
    refetch: refetchSessions
  } = useQuery({
    queryKey: ['batch-sessions'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/model/batch-sessions');
      if (!response.ok) {
        throw new Error('Failed to fetch batch sessions');
      }
      const data = await response.json();
      return data.data?.sessions || [];
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Fetch results for selected session
  const { 
    data: resultsData, 
    isLoading: resultsLoading,
    error: resultsError,
    refetch: refetchResults
  } = useQuery({
    queryKey: ['batch-results', selectedSessionId],
    queryFn: async () => {
      if (!selectedSessionId) return null;
      const response = await apiRequest('GET', `/api/model/batch-results/${selectedSessionId}?limit=1000`);
      if (!response.ok) {
        throw new Error('Failed to fetch batch results');
      }
      const data = await response.json();
      return data.data?.results || data.data || [];
    },
    enabled: !!selectedSessionId,
    refetchInterval: selectedSessionId ? 3000 : false, // Auto-refresh results
  });

  const sessions: BatchSession[] = Array.isArray(sessionsData) ? sessionsData : [];
  const results: BatchResult[] = Array.isArray(resultsData) ? resultsData : [];

  // Get model info for display
  const getModelInfo = (modelKey: string) => {
    const model = MODELS.find(m => m.key === modelKey);
    return model ? `${model.name} (${model.provider})` : modelKey;
  };

  // Handle CSV export
  const handleExportCSV = async (sessionId: string) => {
    try {
      const response = await apiRequest('GET', `/api/model/batch-results/${sessionId}/export`);
      if (!response.ok) {
        throw new Error('Failed to export results');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batch-results-${sessionId}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/model-examiner">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Model Examiner
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Batch Analysis Results</h1>
              <p className="text-gray-600">View and manage batch testing results across all sessions</p>
            </div>
          </div>
          <Button onClick={() => { refetchSessions(); refetchResults(); }} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sessions List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Batch Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sessionsLoading ? (
                <div className="text-center py-4">Loading sessions...</div>
              ) : sessionsError ? (
                <Alert>
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>Failed to load sessions</AlertDescription>
                </Alert>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No batch sessions found</p>
                  <p className="text-xs">Start a batch analysis to see results here</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSessionId === session.id
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedSessionId(session.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge 
                          variant={
                            session.status === 'completed' ? 'default' :
                            session.status === 'running' ? 'secondary' :
                            session.status === 'error' ? 'destructive' :
                            'outline'
                          }
                          className="text-xs capitalize"
                        >
                          {session.status}
                        </Badge>
                        <div className="text-xs text-gray-500">
                          {new Date(session.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-sm font-medium">
                        {getModelInfo(session.modelKey)}
                      </div>
                      <div className="text-xs text-gray-600">
                        {session.dataset} • {session.completedPuzzles}/{session.totalPuzzles} puzzles
                      </div>
                      {session.overallAccuracy !== undefined && (
                        <div className="text-xs text-green-600 mt-1">
                          {session.overallAccuracy}% accuracy
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Display */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Session Results
                </div>
                {selectedSessionId && (
                  <Button onClick={() => handleExportCSV(selectedSessionId)} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedSessionId ? (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p>Select a session to view results</p>
                  <p className="text-xs">Click on a session from the list to see detailed results</p>
                </div>
              ) : resultsLoading ? (
                <div className="text-center py-8">Loading results...</div>
              ) : resultsError ? (
                <Alert>
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>Failed to load results</AlertDescription>
                </Alert>
              ) : results.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No results found for this session</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {results
                    .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())
                    .map((result) => (
                    <div key={result.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          {result.puzzleId}
                        </Badge>
                        <div className="flex items-center gap-2">
                          {result.status === 'completed' ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : result.status === 'failed' ? (
                            <XCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="text-sm capitalize">{result.status}</span>
                        </div>
                        {result.errorMessage && (
                          <Badge variant="destructive" className="text-xs max-w-48 truncate" title={result.errorMessage}>
                            Error: {result.errorMessage}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {result.processingTimeMs && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {Math.round(result.processingTimeMs / 1000)}s
                            </span>
                          )}
                          {result.accuracyScore !== undefined && (
                            <Badge variant={result.isCorrect ? "default" : "secondary"} className="text-xs">
                              {Math.round(result.accuracyScore * 100)}%
                            </Badge>
                          )}
                        </div>
                        {result.status === 'completed' && (
                          <Link href={`/puzzle/${result.puzzleId}`}>
                            <Button variant="ghost" size="sm" className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              View
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
