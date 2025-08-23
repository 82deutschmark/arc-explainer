/**
 * BatchTesting.tsx
 * 
 * Batch testing component for running AI model analysis across all puzzles in a dataset.
 * Mirrors PuzzleExaminer.tsx architecture but for "one model vs all tasks" instead of "all models vs one task".
 * Provides proper model selection, reasoning controls, temperature controls, and progress tracking.
 * Uses real project models, prompt construction, and database integration.
 * 
 * @author Cascade
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '../ui/select';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { PlayCircle, Square, RefreshCcw, Download, BarChart3, Brain, Thermometer, Hash, Eye } from 'lucide-react';

// Import real project components and constants
import { MODELS } from '@/constants/models';
import { EMOJI_SET_INFO, DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';
import type { EmojiSet } from '@/lib/spaceEmojis';
import { PromptPicker } from '@/components/PromptPicker';
import type { ModelConfig } from '@/types/puzzle';

interface BatchRun {
  id: number;
  dataset: string;
  model: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
  created_at: string;
  completed_at?: string;
  processed_count: number;
  total_puzzles: number;
  success_count: number;
  error_count: number;
  average_accuracy?: number;
  total_processing_time_ms?: number;
}

interface BatchProgress {
  status: string;
  progress: number;
  processedCount: number;
  totalPuzzles: number;
  successCount: number;
  errorCount: number;
  currentPuzzle?: string;
  averageAccuracy?: number;
  estimatedTimeRemaining?: number;
}

interface BatchConfig {
  temperature?: number;
  promptId: string;
  customPrompt?: string;
  emojiSetKey?: EmojiSet;
  omitAnswer?: boolean;
  // GPT-5 reasoning parameters
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  reasoningVerbosity?: 'low' | 'medium' | 'high';
  reasoningSummaryType?: 'auto' | 'detailed';
  rateLimitDelayMs?: number;
}

const AVAILABLE_DATASETS = [
  { value: 'evaluation2', label: 'ARC2-Eval (118 puzzles)', count: 118 },
  { value: 'evaluation', label: 'ARC1-Eval (400 puzzles)', count: 400 },
  { value: 'training', label: 'ARC1 Training (400 puzzles)', count: 400 },
  { value: 'training2', label: 'ARC2 Training (1000 puzzles)', count: 1000 }
];

// Group models by provider for better UX
const getModelsByProvider = () => {
  const groups: Record<string, ModelConfig[]> = {};
  MODELS.forEach(model => {
    if (!groups[model.provider]) {
      groups[model.provider] = [];
    }
    groups[model.provider].push(model);
  });
  return groups;
};

export function BatchTesting() {
  // Model and dataset selection
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedDataset, setSelectedDataset] = useState<string>('evaluation2');
  
  // Analysis parameters (mirroring PuzzleExaminer)
  const [temperature, setTemperature] = useState<number>(0.2);
  const [promptId, setPromptId] = useState<string>('solver');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  
  // Researcher options (mirroring PuzzleExaminer)
  const [emojiSet, setEmojiSet] = useState<EmojiSet>(DEFAULT_EMOJI_SET);
  const [sendAsEmojis, setSendAsEmojis] = useState(false);
  const [omitAnswer, setOmitAnswer] = useState(true);
  
  // GPT-5 reasoning parameters (mirroring PuzzleExaminer)
  const [reasoningEffort, setReasoningEffort] = useState<'minimal' | 'low' | 'medium' | 'high'>('low');
  const [reasoningVerbosity, setReasoningVerbosity] = useState<'low' | 'medium' | 'high'>('low');
  const [reasoningSummaryType, setReasoningSummaryType] = useState<'auto' | 'detailed'>('auto');
  
  // Rate limiting
  const [rateLimitDelay, setRateLimitDelay] = useState<number>(1000);
  
  // Batch execution state
  const [currentBatch, setCurrentBatch] = useState<BatchRun | null>(null);
  const [batchRuns, setBatchRuns] = useState<BatchRun[]>([]);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const modelsByProvider = getModelsByProvider();
  
  // Get selected model info
  const selectedModelInfo = selectedModel ? MODELS.find(m => m.key === selectedModel) : null;
  const isGPT5ReasoningModel = selectedModelInfo?.supportsReasoning && selectedModelInfo.key.includes('gpt-5');

  useEffect(() => {
    fetchBatchRuns();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = (batchId: number) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost = import.meta.env.DEV ? 'localhost:5000' : location.host;
    const wsUrl = `${wsProtocol}://${wsHost}/ws/batch/${batchId}`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      setIsConnected(true);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data: BatchProgress = JSON.parse(event.data);
        setProgress(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    wsRef.current.onclose = () => {
      setIsConnected(false);
    };

    wsRef.current.onerror = (err) => {
      console.error('WebSocket error:', err);
      setIsConnected(false);
    };
  };

  const fetchBatchRuns = async () => {
    try {
      const response = await fetch('/api/batch/list');
      const data = await response.json();
      if (data.success) {
        setBatchRuns(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch batch runs:', err);
    }
  };

  const startBatch = async () => {
    if (!selectedModel || !selectedDataset) {
      setError('Please select both model and dataset');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build config object matching PuzzleExaminer's request format
      const config: BatchConfig = {
        promptId,
        rateLimitDelayMs: rateLimitDelay,
        // Analysis options forwarded end-to-end (matching PuzzleExaminer)
        ...(sendAsEmojis ? { emojiSetKey: emojiSet } : {}),
        omitAnswer,
        // Temperature for non-reasoning models
        ...(selectedModelInfo?.supportsReasoning ? {} : { temperature }),
        // GPT-5 reasoning parameters
        ...(isGPT5ReasoningModel ? {
          reasoningEffort,
          reasoningVerbosity,
          reasoningSummaryType
        } : {})
      };
      
      // Include custom prompt if selected
      if (promptId === "custom" && customPrompt.trim()) {
        config.customPrompt = customPrompt.trim();
      }

      const response = await fetch('/api/batch/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dataset: selectedDataset,
          model: selectedModel,
          config
        })
      });

      const data = await response.json();
      
      if (data.success) {
        const batchRun = data.data;
        setCurrentBatch(batchRun);
        connectWebSocket(batchRun.id);
        await fetchBatchRuns();
      } else {
        setError(data.message || 'Failed to start batch');
      }
    } catch (err) {
      setError('Network error: Failed to start batch');
      console.error('Start batch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const stopBatch = async () => {
    if (!currentBatch) return;

    try {
      const response = await fetch(`/api/batch/${currentBatch.id}/stop`, {
        method: 'POST'
      });

      const data = await response.json();
      
      if (data.success) {
        setCurrentBatch(null);
        setProgress(null);
        if (wsRef.current) {
          wsRef.current.close();
        }
        await fetchBatchRuns();
      } else {
        setError(data.message || 'Failed to stop batch');
      }
    } catch (err) {
      setError('Network error: Failed to stop batch');
      console.error('Stop batch error:', err);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'running': return 'secondary';
      case 'failed': return 'destructive';
      case 'stopped': return 'outline';
      default: return 'secondary';
    }
  };

  const selectedDatasetInfo = AVAILABLE_DATASETS.find(d => d.value === selectedDataset);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Batch Testing</h1>
          <p className="text-muted-foreground">
            Run AI model analysis across entire puzzle datasets
          </p>
        </div>
        <Button 
          onClick={fetchBatchRuns}
          variant="outline"
          size="sm"
        >
          <RefreshCcw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Model & Dataset Configuration</CardTitle>
            <CardDescription>
              Select AI model and dataset for batch analysis. Configure analysis parameters.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="model" className="text-sm font-medium flex items-center gap-2">
                <Brain className="h-4 w-4" />
                AI Model
              </Label>
              <Select 
                value={selectedModel} 
                onValueChange={setSelectedModel}
                disabled={!!currentBatch}
              >
                <SelectTrigger id="model">
                  <SelectValue placeholder="Select AI model" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(modelsByProvider).map(([provider, models]) => (
                    <SelectGroup key={provider}>
                      <SelectLabel>{provider}</SelectLabel>
                      {models.map(model => (
                        <SelectItem key={model.key} value={model.key}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${model.color}`}></div>
                            <span>{model.name}</span>
                            {model.premium && <Badge variant="outline" className="text-xs">Premium</Badge>}
                            {model.supportsReasoning && <Badge variant="secondary" className="text-xs">Reasoning</Badge>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {selectedModelInfo && (
                <div className="text-xs text-muted-foreground mt-1">
                  <span>Cost: {selectedModelInfo.cost.input}/1M input, {selectedModelInfo.cost.output}/1M output</span>
                  {selectedModelInfo.responseTime && (
                    <span> • Est: {selectedModelInfo.responseTime.estimate}</span>
                  )}
                </div>
              )}
            </div>

            {/* Dataset Selection */}
            <div className="space-y-2">
              <Label htmlFor="dataset" className="text-sm font-medium flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Dataset
              </Label>
              <Select 
                value={selectedDataset} 
                onValueChange={setSelectedDataset}
                disabled={!!currentBatch}
              >
                <SelectTrigger id="dataset">
                  <SelectValue placeholder="Select dataset" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_DATASETS.map(dataset => (
                    <SelectItem key={dataset.value} value={dataset.value}>
                      {dataset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDatasetInfo && (
                <p className="text-sm text-muted-foreground">
                  {selectedDatasetInfo.count} puzzles to process
                </p>
              )}
            </div>

            <Separator />

            {/* Analysis Parameters */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Analysis Parameters</h4>
              
              {/* Prompt Selection */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Prompt Template</Label>
                <PromptPicker
                  selectedPromptId={promptId}
                  onPromptChange={setPromptId}
                  customPrompt={customPrompt}
                  onCustomPromptChange={setCustomPrompt}
                  disabled={!!currentBatch}
                  sendAsEmojis={sendAsEmojis}
                  onSendAsEmojisChange={setSendAsEmojis}
                  omitAnswer={omitAnswer}
                  onOmitAnswerChange={setOmitAnswer}
                />
              </div>

              {/* Temperature Control (only for non-reasoning models) */}
              {selectedModelInfo && !selectedModelInfo.supportsReasoning && selectedModelInfo.supportsTemperature && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Thermometer className="h-4 w-4" />
                    Temperature: {temperature}
                  </Label>
                  <Slider
                    value={[temperature]}
                    onValueChange={(value) => setTemperature(value[0])}
                    min={0}
                    max={2}
                    step={0.1}
                    className="w-full"
                    disabled={!!currentBatch}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Deterministic</span>
                    <span>Creative</span>
                  </div>
                </div>
              )}

              {/* GPT-5 Reasoning Parameters */}
              {isGPT5ReasoningModel && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                  <h5 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    GPT-5 Reasoning Parameters
                  </h5>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Reasoning Effort */}
                    <div>
                      <Label className="text-xs font-medium text-blue-700">Effort Level</Label>
                      <Select 
                        value={reasoningEffort} 
                        onValueChange={(value) => setReasoningEffort(value as typeof reasoningEffort)}
                        disabled={!!currentBatch}
                      >
                        <SelectTrigger className="w-full mt-1">
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

                    {/* Reasoning Verbosity */}
                    <div>
                      <Label className="text-xs font-medium text-blue-700">Verbosity</Label>
                      <Select 
                        value={reasoningVerbosity} 
                        onValueChange={(value) => setReasoningVerbosity(value as typeof reasoningVerbosity)}
                        disabled={!!currentBatch}
                      >
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Reasoning Summary Type */}
                    <div>
                      <Label className="text-xs font-medium text-blue-700">Summary</Label>
                      <Select 
                        value={reasoningSummaryType} 
                        onValueChange={(value) => setReasoningSummaryType(value as typeof reasoningSummaryType)}
                        disabled={!!currentBatch}
                      >
                        <SelectTrigger className="w-full mt-1">
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


              {/* Rate Limiting */}
              <div className="space-y-2">
                <Label htmlFor="delay" className="text-sm font-medium">Rate Limit Delay (ms)</Label>
                <Input
                  id="delay"
                  type="number"
                  min="0"
                  step="100"
                  value={rateLimitDelay}
                  onChange={(e) => setRateLimitDelay(parseInt(e.target.value))}
                  disabled={!!currentBatch}
                />
                <p className="text-xs text-muted-foreground">Delay between puzzle analyses to prevent rate limiting</p>
              </div>
            </div>

            {error && (
              <Alert>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Separator />

            {/* Action Button */}
            <div>
              {currentBatch ? (
                <Button 
                  onClick={stopBatch}
                  variant="destructive"
                  className="w-full"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Batch Run
                </Button>
              ) : (
                <Button 
                  onClick={startBatch}
                  disabled={isLoading || !selectedModel || !selectedDataset}
                  className="w-full"
                  size="lg"
                >
                  <PlayCircle className="w-4 h-4 mr-2" />
                  {isLoading ? 'Starting...' : 'Start Batch Analysis'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Current Progress
              {isConnected && (
                <Badge variant="secondary">Live</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Real-time batch execution status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentBatch && progress ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{progress.progress}%</span>
                  </div>
                  <Progress value={progress.progress} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{progress.processedCount} / {progress.totalPuzzles}</span>
                    <span>
                      {progress.successCount} success, {progress.errorCount} errors
                    </span>
                  </div>
                </div>

                {progress.currentPuzzle && (
                  <div className="text-sm">
                    <strong>Current:</strong> {progress.currentPuzzle}
                  </div>
                )}

                {progress.averageAccuracy !== undefined && (
                  <div className="text-sm">
                    <strong>Avg Accuracy:</strong> {(progress.averageAccuracy * 100).toFixed(1)}%
                  </div>
                )}

                {progress.estimatedTimeRemaining && (
                  <div className="text-sm">
                    <strong>ETA:</strong> {formatDuration(progress.estimatedTimeRemaining)}
                  </div>
                )}

                <Badge variant={getStatusBadgeVariant(progress.status)}>
                  {progress.status}
                </Badge>
              </>
            ) : currentBatch ? (
              <div className="text-center text-muted-foreground py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                Starting batch...
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No active batch
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats Panel */}
        <Card>
          <CardHeader>
            <CardTitle>
              <BarChart3 className="w-5 h-5 inline mr-2" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Runs:</span>
                <span className="text-sm font-medium">{batchRuns.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Completed:</span>
                <span className="text-sm font-medium">
                  {batchRuns.filter(r => r.status === 'completed').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Running:</span>
                <span className="text-sm font-medium">
                  {batchRuns.filter(r => r.status === 'running').length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Batch Runs</CardTitle>
          <CardDescription>
            History of batch testing runs and their results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {batchRuns.length > 0 ? (
            <div className="space-y-3">
              {batchRuns.slice(0, 10).map((run) => (
                <div key={run.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(run.status)}>
                        {run.status}
                      </Badge>
                      <span className="font-medium">{run.model}</span>
                      <span className="text-sm text-muted-foreground">
                        on {run.dataset}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(run.created_at).toLocaleString()} • 
                      {run.processed_count}/{run.total_puzzles} puzzles • 
                      {run.success_count} successful
                      {run.average_accuracy && (
                        <> • {(run.average_accuracy * 100).toFixed(1)}% avg accuracy</>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {run.status === 'completed' && (
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-1" />
                        Results
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No batch runs yet. Start your first batch above!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default BatchTesting;
