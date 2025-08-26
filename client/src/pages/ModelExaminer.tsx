/**
 * ModelExaminer.tsx
 * 
 * @author Claude Code Assistant
 * @description The inverse of PuzzleExaminer - batch test a specific model and settings 
 * against all puzzles in a selected dataset. Provides real-time progress tracking
 * and comprehensive results analysis for model performance evaluation.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Square, 
  Brain, 
  Database, 
  Clock, 
  CheckCircle, 
  XCircle,
  BarChart3,
  Settings,
  Loader2,
  FileText,
  Eye
} from 'lucide-react';
import { MODELS } from '@/constants/models';
import { useBatchAnalysis } from '@/hooks/useBatchAnalysis';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import type { ExplanationData } from '@/types/puzzle';
import { apiRequest } from '@/lib/queryClient';

export default function ModelExaminer() {
  // Model configuration state
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [dataset, setDataset] = useState<string>('ARC2-Eval');
  const [promptId, setPromptId] = useState<string>('solver');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0.2);
  const [batchSize, setBatchSize] = useState<number>(10);
  
  // GPT-5 reasoning parameters
  const [reasoningEffort, setReasoningEffort] = useState<'minimal' | 'low' | 'medium' | 'high'>('minimal');
  const [reasoningVerbosity, setReasoningVerbosity] = useState<'low' | 'medium' | 'high'>('low');
  const [reasoningSummaryType, setReasoningSummaryType] = useState<'auto' | 'detailed'>('auto');

  // UI state
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(true);
  const [latestExplanation, setLatestExplanation] = useState<ExplanationData | null>(null);
  const [latestPuzzle, setLatestPuzzle] = useState<any>(null);

  // Set page title
  useEffect(() => {
    document.title = 'Model Examiner - Batch Analysis';
  }, []);

  // Use batch analysis hook
  const {
    sessionId,
    progress,
    isRunning,
    error,
    results,
    startAnalysis,
    pauseAnalysis,
    resumeAnalysis,
    cancelAnalysis,
    clearSession
  } = useBatchAnalysis();

  // Function to fetch latest explanation for display
  const fetchLatestExplanation = async (puzzleId: string, explanationId: number) => {
    try {
      // Fetch explanation
      const explanationResponse = await apiRequest('GET', `/api/puzzle/${puzzleId}/explanation`);
      if (explanationResponse.ok) {
        const explanationData = await explanationResponse.json();
        setLatestExplanation(explanationData.data);
      }

      // Fetch puzzle data
      const puzzleResponse = await apiRequest('GET', `/api/puzzle/task/${puzzleId}`);
      if (puzzleResponse.ok) {
        const puzzleData = await puzzleResponse.json();
        setLatestPuzzle(puzzleData.data);
      }
    } catch (error) {
      console.error('Error fetching latest explanation:', error);
    }
  };

  // Watch for new completed results and fetch latest explanation
  useEffect(() => {
    if (results && results.length > 0) {
      // Find the most recently completed result with an explanation
      const completedResults = results
        .filter(r => r.status === 'completed' && r.explanation_id)
        .sort((a, b) => new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime());
      
      if (completedResults.length > 0 && completedResults[0].explanation_id) {
        const latest = completedResults[0];
        // Only fetch if it's different from current
        if (!latestExplanation || latestExplanation.id !== latest.explanation_id) {
          fetchLatestExplanation(latest.puzzle_id, latest.explanation_id!);
        }
      }
    }
  }, [results, latestExplanation]);

  // Get selected model details
  const currentModel = MODELS.find(model => model.key === selectedModel);
  const isGPT5ReasoningModel = selectedModel && ["gpt-5-2025-08-07", "gpt-5-mini-2025-08-07", "gpt-5-nano-2025-08-07"].includes(selectedModel);

  // Handle start analysis
  const handleStartAnalysis = async () => {
    if (!selectedModel) {
      return;
    }

    const config = {
      modelKey: selectedModel,
      dataset,
      promptId: promptId === 'custom' ? undefined : promptId,
      customPrompt: promptId === 'custom' ? customPrompt : undefined,
      temperature: currentModel?.supportsTemperature ? temperature : undefined,
      reasoningEffort: isGPT5ReasoningModel ? reasoningEffort : undefined,
      reasoningVerbosity: isGPT5ReasoningModel ? reasoningVerbosity : undefined,
      reasoningSummaryType: isGPT5ReasoningModel ? reasoningSummaryType : undefined,
      batchSize
    };

    await startAnalysis(config);
  };

  // Dataset options with puzzle counts
  const datasetOptions = [
    { value: 'ARC2-Eval', label: 'ARC2 Evaluation Set', count: '~400 puzzles' },
    { value: 'ARC2', label: 'ARC2 Training Set', count: '~800 puzzles' },
    { value: 'ARC1-Eval', label: 'ARC1 Evaluation Set', count: '~400 puzzles' },
    { value: 'ARC1', label: 'ARC1 Training Set', count: '~400 puzzles' },
    { value: 'All', label: 'All Datasets', count: '~2000 puzzles' }
  ];

  const promptOptions = [
    { value: 'solver', label: 'Solver Mode', description: 'Solve puzzles and predict outputs' },
    { value: 'explainer', label: 'Explainer Mode', description: 'Explain puzzle patterns and solutions' },
    { value: 'researcher', label: 'Researcher Mode', description: 'Deep analysis with reasoning' },
    { value: 'custom', label: 'Custom Prompt', description: 'Use your own prompt template' }
  ];

  return (
    <div className="container mx-auto p-3 max-w-6xl space-y-4">
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
            <h1 className="text-2xl font-bold">Model Examiner</h1>
            <p className="text-gray-600">Batch test AI models against puzzle datasets</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Link href="/overview">
            <Button variant="outline" size="sm">
              <BarChart3 className="h-4 w-4 mr-2" />
              View Results Overview
            </Button>
          </Link>
        </div>
      </div>

      {/* Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Analysis Configuration
          </CardTitle>
          <p className="text-sm text-gray-600">
            Configure model settings and dataset selection for batch analysis
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="model-select">AI Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model to test" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <div className="text-xs text-gray-500 mb-2">OpenAI Models</div>
                    {MODELS.filter(m => m.provider === 'OpenAI').map((model) => (
                      <SelectItem key={model.key} value={model.key} className="flex items-center gap-2">
                        <div className="flex items-center gap-2 w-full">
                          <div className={`w-3 h-3 rounded-full ${model.color}`} />
                          <span>{model.name}</span>
                          {model.premium && <Badge variant="outline" className="text-xs">Premium</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                    
                    <div className="text-xs text-gray-500 mb-2 mt-3">Anthropic Models</div>
                    {MODELS.filter(m => m.provider === 'Anthropic').map((model) => (
                      <SelectItem key={model.key} value={model.key}>
                        <div className="flex items-center gap-2 w-full">
                          <div className={`w-3 h-3 rounded-full ${model.color}`} />
                          <span>{model.name}</span>
                          {model.premium && <Badge variant="outline" className="text-xs">Premium</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                    
                    <div className="text-xs text-gray-500 mb-2 mt-3">Other Providers</div>
                    {MODELS.filter(m => !['OpenAI', 'Anthropic'].includes(m.provider)).map((model) => (
                      <SelectItem key={model.key} value={model.key}>
                        <div className="flex items-center gap-2 w-full">
                          <div className={`w-3 h-3 rounded-full ${model.color}`} />
                          <span>{model.name}</span>
                          <span className="text-xs text-gray-500">({model.provider})</span>
                          {model.premium && <Badge variant="outline" className="text-xs">Premium</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
              {currentModel && (
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Cost: {currentModel.cost.input} in / {currentModel.cost.output} out per M tokens</div>
                  <div>Response Time: {currentModel.responseTime?.estimate || 'Unknown'}</div>
                  {!currentModel.supportsTemperature && (
                    <div className="text-amber-600">⚠️ No temperature control available</div>
                  )}
                </div>
              )}
            </div>

            {/* Dataset Selection */}
            <div className="space-y-2">
              <Label htmlFor="dataset-select">Dataset</Label>
              <Select value={dataset} onValueChange={setDataset}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {datasetOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-xs text-gray-500">{option.count}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-600">
                Evaluation sets are best for performance benchmarking
              </div>
            </div>

            {/* Prompt Selection */}
            <div className="space-y-2">
              <Label htmlFor="prompt-select">Prompt Template</Label>
              <Select value={promptId} onValueChange={setPromptId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {promptOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-xs text-gray-500">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Batch Size */}
            <div className="space-y-2">
              <Label htmlFor="batch-size">Batch Size</Label>
              <Input
                id="batch-size"
                type="number"
                min="1"
                max="50"
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value) || 10)}
                className="w-full"
              />
              <div className="text-xs text-gray-600 space-y-1">
                <div className="font-medium">Concurrent puzzles processed simultaneously</div>
                <div>• Higher values = faster completion but more API load</div>
                <div>• Lower values = slower but more stable for rate limits</div>
                <div>• Recommended: 5-15 for premium models, 3-8 for free tiers</div>
              </div>
            </div>
          </div>

          {/* Custom Prompt */}
          {promptId === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="custom-prompt">Custom Prompt</Label>
              <Textarea
                id="custom-prompt"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Enter your custom prompt template here..."
                rows={4}
                className="w-full"
              />
            </div>
          )}

          {/* Advanced Settings Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="advanced-settings"
              checked={showAdvancedSettings}
              onCheckedChange={setShowAdvancedSettings}
            />
            <Label htmlFor="advanced-settings">Show Advanced Settings</Label>
          </div>

          {/* Advanced Settings */}
          {showAdvancedSettings && (
            <div className="border-t pt-4 space-y-4">
              {/* Temperature Control */}
              {currentModel?.supportsTemperature && (
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature: {temperature}</Label>
                  <Slider
                    id="temperature"
                    min={0.1}
                    max={2.0}
                    step={0.05}
                    value={[temperature]}
                    onValueChange={(value) => setTemperature(value[0])}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-600">
                    Controls creativity and randomness in responses
                  </div>
                </div>
              )}

              {/* GPT-5 Reasoning Parameters */}
              {isGPT5ReasoningModel && (
                <div className="space-y-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h5 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    GPT-5 Reasoning Parameters
                  </h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Effort Control */}
                    <div className="space-y-1">
                      <Label className="text-sm text-blue-700">Effort Level</Label>
                      <Select value={reasoningEffort} onValueChange={(value: any) => setReasoningEffort(value)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minimal">Minimal</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Verbosity Control */}
                    <div className="space-y-1">
                      <Label className="text-sm text-blue-700">Verbosity</Label>
                      <Select value={reasoningVerbosity} onValueChange={(value: any) => setReasoningVerbosity(value)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Summary Control */}
                    <div className="space-y-1">
                      <Label className="text-sm text-blue-700">Summary</Label>
                      <Select value={reasoningSummaryType} onValueChange={(value: any) => setReasoningSummaryType(value)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto</SelectItem>
                          <SelectItem value="detailed">Detailed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Batch Analysis Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {!sessionId ? (
              <Button
                onClick={handleStartAnalysis}
                disabled={!selectedModel}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Start Batch Analysis
              </Button>
            ) : (
              <>
                {progress?.status === 'running' && (
                  <Button
                    onClick={pauseAnalysis}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Pause className="h-4 w-4" />
                    Pause
                  </Button>
                )}
                
                {progress?.status === 'paused' && (
                  <Button
                    onClick={resumeAnalysis}
                    className="flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Resume
                  </Button>
                )}
                
                {['running', 'paused'].includes(progress?.status || '') && (
                  <Button
                    onClick={cancelAnalysis}
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <Square className="h-4 w-4" />
                    Cancel
                  </Button>
                )}
                
                {['completed', 'cancelled', 'error'].includes(progress?.status || '') && (
                  <Button
                    onClick={clearSession}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    New Analysis
                  </Button>
                )}
              </>
            )}

            {isRunning && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analysis running...
              </div>
            )}
          </div>

          {error && (
            <Alert className="mt-3">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Progress Display */}
      {progress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Analysis Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progress.progress.completed} / {progress.progress.total} puzzles</span>
              </div>
              <Progress value={progress.progress.percentage} className="w-full" />
              <div className="text-xs text-gray-600 text-center">
                {progress.progress.percentage}% complete
              </div>
            </div>

            {/* Statistics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Successful</span>
                </div>
                <div className="text-lg font-bold text-green-700">
                  {progress.progress.successful}
                </div>
              </div>

              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Failed</span>
                </div>
                <div className="text-lg font-bold text-red-700">
                  {progress.progress.failed}
                </div>
              </div>

              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                  <BarChart3 className="h-4 w-4" />
                  <span className="text-sm font-medium">Accuracy</span>
                </div>
                <div className="text-lg font-bold text-blue-700">
                  {progress.stats.overallAccuracy}%
                </div>
              </div>

              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <div className="flex items-center justify-center gap-1 text-amber-600 mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">Avg Time</span>
                </div>
                <div className="text-lg font-bold text-amber-700">
                  {Math.round(progress.stats.averageProcessingTime / 1000)}s
                </div>
              </div>
            </div>

            {/* ETA */}
            {progress.stats.eta > 0 && progress.progress.percentage < 100 && (
              <div className="text-center text-sm text-gray-600">
                Estimated time remaining: {Math.round(progress.stats.eta / 60)} minutes
              </div>
            )}

            {/* Status Badge */}
            <div className="flex justify-center">
              <Badge 
                variant={
                  progress.status === 'completed' ? 'default' :
                  progress.status === 'running' ? 'secondary' :
                  progress.status === 'error' ? 'destructive' :
                  'outline'
                }
                className="capitalize"
              >
                {progress.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Latest Analysis Result */}
      {latestExplanation && latestPuzzle && currentModel && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Latest Analysis Result
            </CardTitle>
            <p className="text-sm text-gray-600">
              Most recent completed puzzle analysis from this batch
            </p>
          </CardHeader>
          <CardContent>
            <AnalysisResultCard
              modelKey={selectedModel}
              result={latestExplanation}
              model={currentModel}
              testCases={latestPuzzle.test || []}
            />
          </CardContent>
        </Card>
      )}

      {/* Completed Puzzles List */}
      {results && results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Completed Puzzles
            </CardTitle>
            <p className="text-sm text-gray-600">
              Puzzles that have been processed in this batch analysis
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {results
                .sort((a, b) => new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime())
                .map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      {result.puzzle_id}
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
                    {result.error_message && (
                      <Badge variant="destructive" className="text-xs max-w-48 truncate" title={result.error_message}>
                        Error: {result.error_message}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {result.processing_time_ms && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Math.round(result.processing_time_ms / 1000)}s
                        </span>
                      )}
                      {result.accuracy_score && (
                        <Badge variant={result.is_correct ? "default" : "secondary"} className="text-xs">
                          {Math.round(result.accuracy_score * 100)}%
                        </Badge>
                      )}
                    </div>
                    {result.status === 'completed' && (
                      <Link href={`/puzzle/${result.puzzle_id}`}>
                        <Button variant="ghost" size="sm" className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
              {results.filter(r => r.status === 'pending').length > 0 && (
                <div className="text-center text-sm text-gray-500 mt-4 pt-4 border-t">
                  {results.filter(r => r.status === 'pending').length} puzzles remaining...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}