/**
 * ModelExaminer.tsx
 * 
 * @author Cascade modelID
 * @description Clean implementation using existing batch analysis system to test AI models against puzzle datasets.
 * Properly uses existing hooks and services without duplicating business logic.
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
import { ArrowLeft, Play, Pause, Square, Brain, Database, Clock, CheckCircle, XCircle, BarChart3, Settings, Loader2, Eye
} from 'lucide-react';
import { useModels } from '@/hooks/useModels';
import type { ModelConfig } from '@shared/types';
import { useBatchAnalysis } from '@/hooks/useBatchAnalysis';
import { useAnalysisResults } from '@/hooks/useAnalysisResults';

export default function ModelExaminer() {
  // UI configuration state
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [dataset, setDataset] = useState<string>('ARC2-Eval');
  const [batchSize, setBatchSize] = useState<number>(10);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(true);

  // Set page title
  useEffect(() => {
    document.title = 'Model Examiner - Batch Analysis';
  }, []);

  const { data: models, isLoading: modelsLoading, error: modelsError } = useModels();

  // Use batch analysis hook for main functionality
  const {
    sessionId,
    progress,
    isRunning,
    isLoading,
    error,
    results,
    startupStatus,
    startAnalysis,
    pauseAnalysis,
    resumeAnalysis,
    cancelAnalysis,
    clearSession
  } = useBatchAnalysis();

  // Use analysis results hook for settings management
  const { 
    temperature, 
    setTemperature,
    promptId, 
    setPromptId,
    customPrompt,
    setCustomPrompt,
    reasoningEffort,
    setReasoningEffort,
    reasoningVerbosity,
    setReasoningVerbosity,
    reasoningSummaryType,
    setReasoningSummaryType,
    isGPT5ReasoningModel
  } = useAnalysisResults({
    taskId: '', // No specific task for settings management
    refetchExplanations: () => {},
    emojiSetKey: undefined,
    omitAnswer: true
  });

  // Get current model configuration for UI display and validation
  const currentModel = selectedModel ? models?.find((m: ModelConfig) => m.key === selectedModel) : null;

  /**
   * Initiates batch analysis using the existing useBatchAnalysis hook
   * Constructs configuration object and delegates to the batch analysis system
   * Only includes relevant parameters based on model capabilities
   */
  const handleStartAnalysis = async () => {
    if (!selectedModel) return;

    // Build configuration object with conditional parameters
    const config = {
      modelKey: selectedModel,
      dataset,
      // Use custom prompt if selected, otherwise use predefined promptId
      promptId: promptId === 'custom' ? undefined : promptId,
      customPrompt: promptId === 'custom' ? customPrompt : undefined,
      // Only include temperature if model supports it
      temperature: currentModel?.supportsTemperature ? temperature : undefined,
      // GPT-5 reasoning parameters only for compatible models
      reasoningEffort: isGPT5ReasoningModel(selectedModel) ? reasoningEffort : undefined,
      reasoningVerbosity: isGPT5ReasoningModel(selectedModel) ? reasoningVerbosity : undefined,
      reasoningSummaryType: isGPT5ReasoningModel(selectedModel) ? reasoningSummaryType : undefined,
      batchSize
    };

    console.log('🚀 Starting batch analysis with configuration:', config);
    console.log(`📊 Model: ${currentModel?.name} (${selectedModel})`);
    console.log(`📂 Dataset: ${dataset}`);
    console.log(`🔢 Batch Size: ${batchSize}`);

    try {
      const result = await startAnalysis(config);
      
      console.log('🔄 StartAnalysis result:', result);
      
      if (result.success) {
        console.log('✅ Batch analysis started successfully:', result.sessionId);
      } else {
        console.error('❌ Failed to start batch analysis:', result.error);
        alert(`Failed to start batch analysis: ${result.error}`);
      }
    } catch (error) {
      console.error('💥 Exception in handleStartAnalysis:', error);
      alert(`Exception starting batch analysis: ${error}`);
    }
  };

  // Handle pause analysis
  const handlePauseAnalysis = async () => {
    console.log('🔄 Handling pause button click');
    try {
      const result = await pauseAnalysis();
      if (result.success) {
        console.log('✅ Pause successful');
      } else {
        console.error('❌ Pause failed:', result.error);
        alert(`Failed to pause analysis: ${result.error}`);
      }
    } catch (error) {
      console.error('💥 Exception in pause handler:', error);
      alert(`Exception pausing analysis: ${error}`);
    }
  };

  // Handle resume analysis
  const handleResumeAnalysis = async () => {
    console.log('🔄 Handling resume button click');
    try {
      const result = await resumeAnalysis();
      if (result.success) {
        console.log('✅ Resume successful');
      } else {
        console.error('❌ Resume failed:', result.error);
        alert(`Failed to resume analysis: ${result.error}`);
      }
    } catch (error) {
      console.error('💥 Exception in resume handler:', error);
      alert(`Exception resuming analysis: ${error}`);
    }
  };

  // Handle cancel analysis
  const handleCancelAnalysis = async () => {
    console.log('🔄 Handling cancel button click');
    try {
      const result = await cancelAnalysis();
      if (result.success) {
        console.log('✅ Cancel successful');
      } else {
        console.error('❌ Cancel failed:', result.error);
        alert(`Failed to cancel analysis: ${result.error}`);
      }
    } catch (error) {
      console.error('💥 Exception in cancel handler:', error);
      alert(`Exception cancelling analysis: ${error}`);
    }
  };

  // Configuration options for UI dropdowns
  const datasetOptions = [
    { value: 'ARC2-Eval', label: 'ARC2 Evaluation Set', count: '~400 puzzles' },
    { value: 'ARC2', label: 'ARC2 Training Set', count: '~800 puzzles' },
    { value: 'ARC1-Eval', label: 'ARC1 Evaluation Set', count: '~400 puzzles' },
    { value: 'ARC1', label: 'ARC1 Training Set', count: '~400 puzzles' }
  ];

  const promptOptions = [
    { value: 'solver', label: 'Solver Mode', description: 'Solve puzzles and predict outputs' },
    { value: 'explainer', label: 'Explainer Mode', description: 'Explain puzzle patterns and solutions' },
    { value: 'researcher', label: 'Researcher Mode', description: 'Deep analysis with reasoning' },
    { value: 'custom', label: 'Custom Prompt', description: 'Use your own prompt template' }
  ];

  return (
    <div className="container mx-auto p-3 max-w-6xl space-y-4">
      {/* Header with navigation and title */}
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
        
        {/* Link to existing batch results dashboard */}
        <div className="flex items-center gap-2">
          <Link href="/batch">
            <Button variant="outline" size="sm">
              <BarChart3 className="h-4 w-4 mr-2" />
              View Results Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Analysis Progress - FRONT AND CENTER */}
      {progress && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              Live Analysis Progress
            </CardTitle>
            <p className="text-sm text-blue-700">
              Running <strong>{currentModel?.name || selectedModel}</strong> on <strong>{dataset}</strong> dataset
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progress.progress.completed} / {progress.progress.total} puzzles</span>
              </div>
              <Progress value={progress.progress.percentage} className="w-full h-3" />
              <div className="text-sm font-medium text-center text-blue-700">
                {progress.progress.percentage}% complete
              </div>
            </div>

            {/* Live Statistics */}
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 bg-green-100 rounded-lg border border-green-200">
                <div className="text-lg font-bold text-green-700">
                  {progress.progress.successful}
                </div>
                <div className="text-xs text-green-600">✅ Successful</div>
              </div>
              <div className="text-center p-3 bg-red-100 rounded-lg border border-red-200">
                <div className="text-lg font-bold text-red-700">
                  {progress.progress.failed}
                </div>
                <div className="text-xs text-red-600">❌ Failed</div>
              </div>
              <div className="text-center p-3 bg-blue-100 rounded-lg border border-blue-200">
                <div className="text-lg font-bold text-blue-700">
                  {progress.stats.overallAccuracy}%
                </div>
                <div className="text-xs text-blue-600">🎯 Accuracy</div>
              </div>
              <div className="text-center p-3 bg-amber-100 rounded-lg border border-amber-200">
                <div className="text-lg font-bold text-amber-700">
                  {Math.round(progress.stats.averageProcessingTime / 1000)}s
                </div>
                <div className="text-xs text-amber-600">⏱️ Avg Time</div>
              </div>
            </div>

            {/* Status and ETA */}
            <div className="flex justify-between items-center">
              <Badge 
                variant={progress.status === 'completed' ? 'default' : progress.status === 'running' ? 'secondary' : 'destructive'}
                className="capitalize text-sm px-3 py-1"
              >
                {progress.status === 'running' ? '🔄 Processing...' : progress.status}
              </Badge>
              {progress.stats.eta > 0 && progress.progress.percentage < 100 && (
                <div className="text-sm text-gray-600">
                  ETA: {Math.round(progress.stats.eta / 60)} min
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pre-Completion Processing Activity - CRITICAL FOR VERBOSE FEEDBACK */}
      {sessionId && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 text-orange-600 animate-spin" />
              Live Processing Activity
            </CardTitle>
            <p className="text-sm text-orange-700">
              Real-time updates of batch processing pipeline and API activity
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Session Status */}
            <div className="p-3 bg-white rounded-lg border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-gray-900">Batch Session</div>
                <Badge variant="secondary" className="font-mono text-xs">
                  {sessionId.split('-')[0]}...
                </Badge>
              </div>
              <div className="text-sm text-gray-600">
                {startupStatus ? (
                  <div className="font-medium text-orange-700">{startupStatus}</div>
                ) : (
                  <div>✅ Session created successfully • 🚀 Processing initiated</div>
                )}
              </div>
            </div>

            {/* Processing Queue Status */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-blue-100 rounded-lg border border-blue-200">
                <div className="text-lg font-bold text-blue-700 animate-pulse">
                  {progress ? progress.progress.total - progress.progress.completed : '?'}
                </div>
                <div className="text-xs text-blue-600">🔄 In Progress</div>
              </div>
              <div className="text-center p-3 bg-gray-100 rounded-lg border border-gray-200">
                <div className="text-lg font-bold text-gray-700">
                  {progress ? progress.progress.total - progress.progress.completed : '?'}
                </div>
                <div className="text-xs text-gray-600">⏳ Queued</div>
              </div>
              <div className="text-center p-3 bg-green-100 rounded-lg border border-green-200">
                <div className="text-lg font-bold text-green-700">
                  {progress?.progress.completed || 0}
                </div>
                <div className="text-xs text-green-600">✅ Completed</div>
              </div>
              <div className="text-center p-3 bg-red-100 rounded-lg border border-red-200">
                <div className="text-lg font-bold text-red-700">
                  {progress?.progress.failed || 0}
                </div>
                <div className="text-xs text-red-600">❌ Failed</div>
              </div>
            </div>

            {/* API Processing Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">OpenAI API Processing</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-600">Active</span>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-orange-200 p-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Model:</span> <code className="text-blue-600">{selectedModel}</code>
                  </div>
                  <div>
                    <span className="text-gray-500">Expected Response:</span> <span className="text-orange-600">2-5 minutes</span>
                  </div>
                  {progress && progress.progress.percentage === 0 && (
                    <>
                      <div className="col-span-full">
                        <span className="text-amber-600">🔥 Active API calls processing...</span>
                      </div>
                      <div className="col-span-full text-xs text-gray-500">
                        💡 First responses typically arrive within 3 minutes for GPT-5 models with high reasoning effort
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Server Communication Status */}
            <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-orange-200">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-700">Server polling active</span>
              </div>
              <div className="text-xs text-gray-500">
                Updates every 2 seconds • Last check: just now
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Activity Log */}
      {results && results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Live Activity Log
            </CardTitle>
            <p className="text-sm text-gray-600">
              Real-time feed of puzzle processing and DB validation results
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results
                .sort((a: any, b: any) => new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime())
                .slice(0, 10) // Show only latest 10
                .map((result: any, index: number) => (
                <div key={result.id || index} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {result.puzzle_id}
                    </Badge>
                    {result.status === 'completed' ? (
                      <span className="text-green-600">✅ Reply received & validated</span>
                    ) : result.status === 'failed' ? (
                      <span className="text-red-600">❌ Failed: {result.error_message?.substring(0, 30)}...</span>
                    ) : (
                      <span className="text-blue-600">🔄 Waiting for reply...</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {result.processing_time_ms && (
                      <span className="text-xs text-gray-500">
                        {Math.round(result.processing_time_ms / 1000)}s
                      </span>
                    )}
                    {result.accuracy_score !== undefined && (
                      <Badge variant={result.is_correct ? "default" : "secondary"} className="text-xs">
                        {Math.round(result.accuracy_score * 100)}%
                      </Badge>
                    )}
                    {result.status === 'completed' && (
                      <Link href={`/puzzle/${result.puzzle_id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-3 w-3" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Panel - moved below progress */}
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
                  {modelsLoading ? (
                    <div className="p-4 text-center text-sm text-gray-500">Loading models...</div>
                  ) : (
                    <div className="p-2">
                      <div className="text-xs text-gray-500 mb-2">OpenAI Models</div>
                      {models?.filter((m: ModelConfig) => m.provider === 'OpenAI').map((model: ModelConfig) => (
                        <SelectItem key={model.key} value={model.key}>
                          <div className="flex items-center gap-2 w-full">
                            <div className={`w-3 h-3 rounded-full ${model.color}`} />
                            <span>{model.name}</span>
                            {model.premium && <Badge variant="outline" className="text-xs">Premium</Badge>}
                          </div>
                        </SelectItem>
                      ))}
                      
                      <div className="text-xs text-gray-500 mb-2 mt-3">Anthropic Models</div>
                      {models?.filter((m: ModelConfig) => m.provider === 'Anthropic').map((model: ModelConfig) => (
                        <SelectItem key={model.key} value={model.key}>
                          <div className="flex items-center gap-2 w-full">
                            <div className={`w-3 h-3 rounded-full ${model.color}`} />
                            <span>{model.name}</span>
                            {model.premium && <Badge variant="outline" className="text-xs">Premium</Badge>}
                          </div>
                        </SelectItem>
                      ))}
                      
                      <div className="text-xs text-gray-500 mb-2 mt-3">Other Providers</div>
                      {models?.filter((m: ModelConfig) => !['OpenAI', 'Anthropic'].includes(m.provider)).map((model: ModelConfig) => (
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
                  )}
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
              {isGPT5ReasoningModel(selectedModel) && (
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

      {/* Control Panel - delegates to existing batch analysis system */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Batch Analysis Controls
          </CardTitle>
          <p className="text-sm text-gray-600">
            Start and manage batch analysis using the existing system
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {/* Show start button when no active session */}
            {!sessionId ? (
              <Button
                onClick={handleStartAnalysis}
                disabled={!selectedModel || isLoading}
                className="flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {isLoading ? 'Starting Analysis...' : 'Start Batch Analysis'}
              </Button>
            ) : (
              <>
                {/* Session management buttons based on current status */}
                {progress?.status === 'running' && (
                  <Button
                    onClick={handlePauseAnalysis}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Pause className="h-4 w-4" />
                    Pause
                  </Button>
                )}
                
                {progress?.status === 'paused' && (
                  <Button
                    onClick={handleResumeAnalysis}
                    className="flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Resume
                  </Button>
                )}
                
                {['running', 'paused'].includes(progress?.status || '') && (
                  <Button
                    onClick={handleCancelAnalysis}
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

            {/* Loading/Running indicators */}
            {isLoading && !sessionId && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                {startupStatus || 'Initializing batch analysis...'}
              </div>
            )}
            
            {isRunning && sessionId && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analysis running...
              </div>
            )}
          </div>

          {/* Success message for session start */}
          {sessionId && !isLoading && !error && !progress && (
            <Alert className="mt-3 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Batch analysis session started successfully! Session ID: <code className="font-mono text-xs bg-green-100 px-1 rounded">{sessionId}</code>
              </AlertDescription>
            </Alert>
          )}

          {/* Error display from batch analysis hook */}
          {error && (
            <Alert className="mt-3">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Debug Information Panel */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
            <h6 className="text-xs font-semibold text-gray-700 mb-2">Debug Information</h6>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600">
              <div><strong>Selected Model Key:</strong> <code>{selectedModel || 'none'}</code></div>
              <div><strong>Model Name:</strong> {currentModel?.name || 'none'}</div>
              <div><strong>Provider:</strong> {currentModel?.provider || 'none'}</div>
              <div><strong>Session ID:</strong> <code>{sessionId || 'none'}</code></div>
              <div><strong>Hook Loading:</strong> {isLoading ? '✅' : '❌'}</div>
              <div><strong>Hook Running:</strong> {isRunning ? '✅' : '❌'}</div>
              <div><strong>Progress Status:</strong> {progress?.status || 'none'}</div>
              <div><strong>Error State:</strong> {error ? '❌' : '✅'}</div>
            </div>
          </div>
        </CardContent>
      </Card>


    </div>
  );
}
