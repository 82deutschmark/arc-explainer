/**
 * ModelExaminer.tsx
 * 
 * @author Cascade modelID
 * @description The inverse of PuzzleExaminer - batch test a specific model and settings 
 * against all puzzles in a selected dataset. Provides real-time progress tracking
 * and comprehensive results analysis for model performance evaluation.
 * Includes manual batch debugging with individual puzzle cards.
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
  Eye,
  Terminal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { MODELS } from '@/constants/models';
import { useBatchAnalysis } from '@/hooks/useBatchAnalysis';
import { usePuzzleList } from '@/hooks/usePuzzle';
import { useAnalysisResults } from '@/hooks/useAnalysisResults';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import type { ExplanationData } from '@/types/puzzle';
import type { ARCTask } from '@shared/types';
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
  const [reasoningEffort, setReasoningEffort] = useState<'minimal' | 'low' | 'medium' | 'high'>('low');
  const [reasoningVerbosity, setReasoningVerbosity] = useState<'low' | 'medium' | 'high'>('high');
  const [reasoningSummaryType, setReasoningSummaryType] = useState<'auto' | 'detailed'>('detailed');

  // UI state
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(true);
  const [showDebugConsole, setShowDebugConsole] = useState(false);
  const [debugLogs, setDebugLogs] = useState<Array<{timestamp: string, level: string, message: string, data?: any}>>([]);
  
  // Individual puzzle state
  const [analyzingPuzzles, setAnalyzingPuzzles] = useState<Set<string>>(new Set());
  const [completedPuzzles, setCompletedPuzzles] = useState<Set<string>>(new Set());
  const [puzzleResults, setPuzzleResults] = useState<Map<string, ExplanationData>>(new Map());
  
  // Real-time activity tracking
  const [currentActivity, setCurrentActivity] = useState<{
    puzzleId?: string;
    status: 'idle' | 'sending_request' | 'waiting_response' | 'processing_response';
    startTime?: number;
    apiCallCount: number;
  }>({ status: 'idle', apiCallCount: 0 });
  
  const [recentActivity, setRecentActivity] = useState<Array<{
    timestamp: string;
    puzzleId: string;
    action: string;
    duration?: number;
    success: boolean;
  }>>([]);}

  // Set page title
  useEffect(() => {
    document.title = 'Model Examiner - Batch Analysis';
  }, []);

  // Load puzzles based on dataset and batch size
  const { puzzles, isLoading: puzzlesLoading } = usePuzzleList({
    source: dataset as 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval',
  });

  // Get the first N puzzles based on batch size
  const displayedPuzzles = puzzles.slice(0, batchSize);

  // Use batch analysis hook (main functionality)
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

  // Use analysis results hook for manual debugging
  const { explanations, refetchExplanations } = useAnalysisResults();

  // Debug logging function
  const addDebugLog = (level: string, message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev.slice(-99), { timestamp, level, message, data }]);
  };

  // Activity tracking functions
  const updateActivity = (status: typeof currentActivity.status, puzzleId?: string) => {
    setCurrentActivity(prev => ({
      ...prev,
      status,
      puzzleId: puzzleId || prev.puzzleId,
      startTime: status !== 'idle' ? (prev.startTime || Date.now()) : undefined,
      apiCallCount: status === 'sending_request' ? prev.apiCallCount + 1 : prev.apiCallCount
    }));
  };

  const addRecentActivity = (puzzleId: string, action: string, success: boolean, startTime?: number) => {
    const timestamp = new Date().toLocaleTimeString();
    const duration = startTime ? Date.now() - startTime : undefined;
    setRecentActivity(prev => [...prev.slice(-19), {
      timestamp,
      puzzleId,
      action,
      duration,
      success
    }]);
  };

  // Individual puzzle analysis function - same as PuzzleExaminer
  const analyzeIndividualPuzzle = async (puzzleId: string) => {
    if (!selectedModel) {
      addDebugLog('ERROR', 'No model selected for analysis');
      return;
    }

    const fetchStartTime = Date.now();
    try {
      setAnalyzingPuzzles(prev => new Set(prev).add(puzzleId));
      updateActivity('sending_request', puzzleId);
      addDebugLog('INFO', `Starting analysis for puzzle ${puzzleId} with model ${selectedModel}`);
      
      const config = {
        puzzleId,
        modelKey: selectedModel,
        promptId: promptId === 'custom' ? undefined : promptId,
        customPrompt: promptId === 'custom' ? customPrompt : undefined,
        temperature: currentModel?.supportsTemperature ? temperature : undefined,
        reasoningEffort: isGPT5ReasoningModel ? reasoningEffort : undefined,
        reasoningVerbosity: isGPT5ReasoningModel ? reasoningVerbosity : undefined,
        reasoningSummaryType: isGPT5ReasoningModel ? reasoningSummaryType : undefined,
      };

      updateActivity('waiting_response', puzzleId);
      const response = await apiRequest('POST', '/api/puzzle/analyze', config);
      
      if (response.ok) {
        updateActivity('processing_response', puzzleId);
        const result = await response.json();
        addDebugLog('SUCCESS', `Analysis completed for puzzle ${puzzleId}`, { explanationId: result.data?.id });
        addRecentActivity(puzzleId, 'Individual Analysis', true, fetchStartTime);
        
        // Fetch the saved explanation
        const explanationResponse = await apiRequest('GET', `/api/puzzle/${puzzleId}/explanation`);
        if (explanationResponse.ok) {
          const explanationData = await explanationResponse.json();
          setPuzzleResults(prev => new Map(prev).set(puzzleId, explanationData.data));
          setCompletedPuzzles(prev => new Set(prev).add(puzzleId));
        }
        
        // Refresh explanations for the card display
        refetchExplanations();
      } else {
        addDebugLog('ERROR', `Analysis failed for puzzle ${puzzleId}: ${response.status}`);
        addRecentActivity(puzzleId, 'Individual Analysis', false, fetchStartTime);
      }
      
      updateActivity('idle');
    } catch (error) {
      addDebugLog('ERROR', `Error analyzing puzzle ${puzzleId}: ${error instanceof Error ? error.message : String(error)}`);
      addRecentActivity(puzzleId, 'Individual Analysis', false, fetchStartTime);
      updateActivity('idle');
    } finally {
      setAnalyzingPuzzles(prev => {
        const newSet = new Set(prev);
        newSet.delete(puzzleId);
        return newSet;
      });
    }
  };

  // Load puzzle results on puzzle list change
  useEffect(() => {
    if (displayedPuzzles.length > 0) {
      addDebugLog('INFO', `Loaded ${displayedPuzzles.length} puzzles for display`, { 
        dataset, 
        batchSize,
        puzzleIds: displayedPuzzles.map(p => p.taskId).slice(0, 5) // Show first 5 IDs
      });
    }
  }, [displayedPuzzles.length, dataset, batchSize]);

  // Get selected model details
  const currentModel = MODELS.find(model => model.key === selectedModel);
  const isGPT5ReasoningModel = selectedModel && ["gpt-5-2025-08-07", "gpt-5-mini-2025-08-07", "gpt-5-nano-2025-08-07"].includes(selectedModel);
  
  // Statistics
  const totalPuzzles = displayedPuzzles.length;
  const analyzedCount = completedPuzzles.size;
  const analyzingCount = analyzingPuzzles.size;
  const remainingCount = totalPuzzles - analyzedCount - analyzingCount;

  // Clear all results
  const handleClearResults = () => {
    setCompletedPuzzles(new Set());
    setPuzzleResults(new Map());
    setDebugLogs([]);
    setRecentActivity([]);
    addDebugLog('INFO', 'Cleared all analysis results and logs');
  };
  
  // Handle start batch analysis (main functionality)
  const handleStartAnalysis = async () => {
    if (!selectedModel) {
      addDebugLog('ERROR', 'No model selected for analysis');
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

    addDebugLog('INFO', `Starting batch analysis with model ${selectedModel}`, config);
    
    try {
      await startAnalysis(config);
      addDebugLog('SUCCESS', 'Batch analysis started successfully');
    } catch (error) {
      addDebugLog('ERROR', `Failed to start batch analysis: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Manual batch analysis - analyze all displayed puzzles individually for debugging
  const handleAnalyzeManualBatch = async () => {
    if (!selectedModel) {
      addDebugLog('ERROR', 'No model selected for manual analysis');
      return;
    }
    
    addDebugLog('INFO', `Starting manual analysis of ${displayedPuzzles.length} puzzles with model ${selectedModel}`);
    
    for (const puzzle of displayedPuzzles) {
      if (!completedPuzzles.has(puzzle.taskId) && !analyzingPuzzles.has(puzzle.taskId)) {
        await analyzeIndividualPuzzle(puzzle.taskId);
        // Small delay between puzzles to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
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

      {/* Current Activity Status */}
      {(isRunning || currentActivity.status !== 'idle') && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {currentActivity.status === 'idle' ? (
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                  ) : (
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                  )}
                  <span className="font-medium text-blue-800">
                    {currentActivity.status === 'idle' && 'Idle'}
                    {currentActivity.status === 'sending_request' && 'Sending API Request'}
                    {currentActivity.status === 'waiting_response' && 'Waiting for Response'}
                    {currentActivity.status === 'processing_response' && 'Processing Response'}
                  </span>
                </div>
                {currentActivity.puzzleId && (
                  <Badge variant="outline" className="font-mono text-xs">
                    Puzzle: {currentActivity.puzzleId}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-blue-600">
                <span>API Calls: {currentActivity.apiCallCount}</span>
                {currentActivity.startTime && (
                  <span>Duration: {Math.round((Date.now() - currentActivity.startTime) / 1000)}s</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Batch Analysis Controls
          </CardTitle>
          <p className="text-sm text-gray-600">
            Main batch processing with session management and progress tracking
          </p>
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

      {/* Manual Puzzle Cards for Debugging */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Manual Batch Analysis (Debugging)
          </CardTitle>
          <p className="text-sm text-gray-600">
            Analyze individual puzzles manually for debugging session issues. Shows first {batchSize} puzzles from {dataset}.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Manual batch controls */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleAnalyzeManualBatch}
                disabled={!selectedModel || analyzingCount > 0}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Analyze All {displayedPuzzles.length} Puzzles Manually
              </Button>
              <Button
                onClick={handleClearResults}
                variant="outline"
                className="flex items-center gap-2"
              >
                Clear Results
              </Button>
              <div className="text-sm text-gray-600">
                {analyzedCount} completed, {analyzingCount} analyzing, {remainingCount} remaining
              </div>
            </div>

            {/* Puzzle cards grid */}
            {displayedPuzzles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedPuzzles.map((puzzle) => {
                  const isAnalyzing = analyzingPuzzles.has(puzzle.taskId);
                  const isCompleted = completedPuzzles.has(puzzle.taskId);
                  const result = puzzleResults.get(puzzle.taskId);
                  
                  return (
                    <Card key={puzzle.taskId} className={`transition-colors ${
                      isCompleted ? 'border-green-200 bg-green-50' :
                      isAnalyzing ? 'border-blue-200 bg-blue-50' :
                      'border-gray-200'
                    }`}>
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="font-mono text-xs">
                              {puzzle.taskId}
                            </Badge>
                            <div className="flex items-center gap-1">
                              {isCompleted && <CheckCircle className="h-4 w-4 text-green-600" />}
                              {isAnalyzing && <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />}
                            </div>
                          </div>
                          
                          {/* Puzzle preview */}
                          {puzzle.train && puzzle.train[0] && (
                            <div className="space-y-2">
                              <div className="text-xs text-gray-600">Training Example:</div>
                              <div className="flex gap-2">
                                <PuzzleGrid 
                                  grid={puzzle.train[0].input} 
                                  size="xs" 
                                  className="max-w-20"
                                />
                                <div className="text-xs text-gray-400 self-center">→</div>
                                <PuzzleGrid 
                                  grid={puzzle.train[0].output} 
                                  size="xs" 
                                  className="max-w-20"
                                />
                              </div>
                            </div>
                          )}
                          
                          <Button
                            onClick={() => analyzeIndividualPuzzle(puzzle.taskId)}
                            disabled={!selectedModel || isAnalyzing || isCompleted}
                            size="sm"
                            className="w-full"
                            variant={isCompleted ? "outline" : "default"}
                          >
                            {isAnalyzing ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                Analyzing...
                              </>
                            ) : isCompleted ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-2" />
                                Completed
                              </>
                            ) : (
                              <>
                                <Play className="h-3 w-3 mr-2" />
                                Analyze
                              </>
                            )}
                          </Button>
                          
                          {/* Show result if completed */}
                          {result && (
                            <div className="text-xs space-y-1 pt-2 border-t">
                              <div className="flex justify-between">
                                <span>Accuracy:</span>
                                <Badge variant={result.is_correct ? "default" : "secondary"}>
                                  {Math.round((result.accuracy_score || 0) * 100)}%
                                </Badge>
                              </div>
                              {result.is_correct !== undefined && (
                                <div className="flex justify-between">
                                  <span>Correct:</span>
                                  <span className={result.is_correct ? 'text-green-600' : 'text-red-600'}>
                                    {result.is_correct ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : puzzlesLoading ? (
              <div className="text-center text-gray-500">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading puzzles...
              </div>
            ) : (
              <div className="text-center text-gray-500">
                No puzzles found for the selected dataset.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Latest Analysis Result - show latest from manual analysis */}
      {Array.from(puzzleResults.values()).length > 0 && currentModel && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Latest Manual Analysis Result
            </CardTitle>
            <p className="text-sm text-gray-600">
              Most recent completed manual puzzle analysis
            </p>
          </CardHeader>
          <CardContent>
            {(() => {
              const latestResult = Array.from(puzzleResults.entries())
                .sort(([,a], [,b]) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
              const [puzzleId, explanation] = latestResult;
              const puzzle = displayedPuzzles.find(p => p.taskId === puzzleId);
              
              return (
                <AnalysisResultCard
                  modelKey={selectedModel}
                  result={explanation}
                  model={currentModel}
                  testCases={puzzle?.test || []}
                />
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Recent Activity Feed */
      {recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <p className="text-sm text-gray-600">
              Latest puzzle processing events and API calls
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {recentActivity.slice().reverse().map((activity, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      activity.success ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <Badge variant="outline" className="font-mono text-xs">
                      {activity.puzzleId}
                    </Badge>
                    <span className="text-gray-700">{activity.action}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{activity.timestamp}</span>
                    {activity.duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {Math.round(activity.duration / 1000)}s
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Console */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Debug Console
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDebugConsole(!showDebugConsole)}
              className="flex items-center gap-2"
            >
              {showDebugConsole ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showDebugConsole ? 'Hide' : 'Show'} Logs
            </Button>
          </CardTitle>
          {showDebugConsole && (
            <p className="text-sm text-gray-600">
              Real-time logging of batch analysis operations and API calls
            </p>
          )}
        </CardHeader>
        {showDebugConsole && (
          <CardContent>
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-80 overflow-y-auto">
              {debugLogs.length === 0 ? (
                <div className="text-gray-500">No debug logs yet. Start a batch analysis to see real-time activity.</div>
              ) : (
                <div className="space-y-1">
                  {debugLogs.map((log, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="text-gray-400 text-xs">[{log.timestamp}]</span>
                      <span className={`text-xs font-semibold ${
                        log.level === 'ERROR' ? 'text-red-400' :
                        log.level === 'SUCCESS' ? 'text-green-400' :
                        log.level === 'WARN' ? 'text-yellow-400' :
                        'text-blue-400'
                      }`}>
                        {log.level}
                      </span>
                      <span className="text-green-300">{log.message}</span>
                      {log.data && (
                        <span className="text-gray-400 text-xs">
                          {JSON.stringify(log.data)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {debugLogs.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-700">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDebugLogs([])}
                    className="text-xs"
                  >
                    Clear Logs
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Completed Batch Puzzles List */}
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
                .sort((a: any, b: any) => new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime())
                .map((result: any, index: number) => (
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
              {results.filter((r: any) => r.status === 'pending').length > 0 && (
                <div className="text-center text-sm text-gray-500 mt-4 pt-4 border-t">
                  {results.filter((r: any) => r.status === 'pending').length} puzzles remaining...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}