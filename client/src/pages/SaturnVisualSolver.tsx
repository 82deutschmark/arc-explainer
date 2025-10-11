/**
 * client/src/pages/SaturnVisualSolver.tsx
 *
 * Saturn Visual Solver page - pure Python wrapper interface.
 * Features a clean layout focused on showing Python solver output:
 * - Dynamic model selection from all available models
 * - Advanced settings panel with temperature and reasoning controls
 * - Status overview with progress tracking
 * - Real-time Python solver logs in terminal style
 * - Collapsible puzzle details
 * - Python-generated image gallery
 *
 * Author: Cascade using Sonnet 4.5
 * Date: 2025-10-10
 * PURPOSE: Provide flexible Saturn solver with full model support and reasoning controls
 * SRP/DRY check: Pass - Orchestrates Saturn analysis UI only
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React from 'react';
import { useParams, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Loader2, ArrowLeft, Rocket, Terminal, Eye, RotateCcw, Settings } from 'lucide-react';
import { usePuzzle } from '@/hooks/usePuzzle';
import { useSaturnProgress } from '@/hooks/useSaturnProgress';
import { useModels } from '@/hooks/useModels';
import SaturnModelSelect from '@/components/saturn/SaturnModelSelect';
import SaturnImageGallery from '@/components/saturn/SaturnImageGallery';
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';

export default function SaturnVisualSolver() {
  const { taskId } = useParams<{ taskId: string }>();
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { state, start, sessionId } = useSaturnProgress(taskId);
  const { data: models } = useModels();
  
  // Model and parameter states
  const [modelKey, setModelKey] = React.useState<string>('gpt-5-nano-2025-08-07');
  const [temperature, setTemperature] = React.useState<number>(0.2);
  const [reasoningEffort, setReasoningEffort] = React.useState<'minimal' | 'low' | 'medium' | 'high'>('high');
  const [reasoningVerbosity, setReasoningVerbosity] = React.useState<'low' | 'medium' | 'high'>('high');
  const [reasoningSummaryType, setReasoningSummaryType] = React.useState<'auto' | 'detailed'>('detailed');
  
  // UI states
  const [showPuzzleDetails, setShowPuzzleDetails] = React.useState(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = React.useState(false);
  const [startTime, setStartTime] = React.useState<Date | null>(null);
  const logRef = React.useRef<HTMLDivElement | null>(null);
  
  // Helper to check if model supports temperature
  const supportsTemperature = React.useMemo(() => {
    if (!models) return true;
    const model = models.find(m => m.key === modelKey);
    return model?.supportsTemperature !== false;
  }, [models, modelKey]);
  
  // Helper to check if model is GPT-5 reasoning model
  const isGPT5ReasoningModel = (key: string): boolean => {
    return ["gpt-5-2025-08-07", "gpt-5-mini-2025-08-07", "gpt-5-nano-2025-08-07"].includes(key);
  };

  // Set page title with puzzle ID
  React.useEffect(() => {
    document.title = taskId ? `Saturn Solver - ${taskId}` : 'Saturn Visual Solver';
  }, [taskId]);

  // Derived state variables (moved before useEffect hooks)
  const isRunning = state.status === 'running';
  const isDone = state.status === 'completed';
  const hasError = state.status === 'error';
  const hasWarning = state.phase === 'warning' || state.phase === 'timeout';

  // Auto-scroll log to bottom when new lines arrive
  React.useEffect(() => {
    const el = logRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [state.logLines]);

  // Track start time when analysis begins
  React.useEffect(() => {
    if (state.status === 'running' && !startTime) {
      setStartTime(new Date());
    } else if (state.status !== 'running') {
      setStartTime(null);
    }
  }, [state.status, startTime]);

  // Force re-render every second to update timing display
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        setTick(tick => tick + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isRunning]);

  if (!taskId) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Alert>
          <AlertDescription>Invalid puzzle ID</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoadingTask) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading puzzle…</span>
          </div>
        </div>
      </div>
    );
  }

  if (taskError || !task) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Alert>
          <AlertDescription>
            Failed to load puzzle: {taskError?.message || 'Puzzle not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const onStart = () => {
    const startOptions: any = {
      model: modelKey,
      temperature: supportsTemperature ? temperature : undefined,
      cellSize: 24,
      maxSteps: 8,
      captureReasoning: true,
      useResponsesAPI: true, // Enable Responses API for structured reasoning
    };
    
    // Add reasoning parameters for GPT-5 models
    if (isGPT5ReasoningModel(modelKey)) {
      startOptions.reasoningEffort = reasoningEffort;
      startOptions.reasoningVerbosity = reasoningVerbosity;
      startOptions.reasoningSummaryType = reasoningSummaryType;
    }
    
    start(startOptions);
  };

  // Helper to get detailed phase explanation
  const getPhaseExplanation = (phase: string | undefined, step?: number, totalSteps?: number) => {
    const stepInfo = (step !== undefined && totalSteps !== undefined) ? 
      ` (Step ${step}/${totalSteps})` : '';
    
    switch (phase) {
      case 'init':
      case 'initializing':
        return {
          title: 'Initializing Analysis',
          description: 'Setting up the Saturn visual reasoning environment, loading puzzle data, and preparing AI models for pattern analysis.',
          details: 'This phase involves validating the puzzle format, initializing the Python solver environment, and setting up connections to the AI reasoning engine.'
        };
      case 'analyzing':
        return {
          title: 'Analyzing Training Examples' + stepInfo,
          description: 'Examining each training example to identify visual patterns, transformations, and logical rules.',
          details: 'Saturn is processing input-output pairs to understand the underlying pattern. This involves identifying color changes, shape transformations, spatial relationships, and mathematical operations.'
        };
      case 'reasoning':
        return {
          title: 'Visual Reasoning' + stepInfo,
          description: 'Applying discovered patterns to understand the puzzle\'s core logic and transformation rules.',
          details: 'The AI is now forming hypotheses about the puzzle mechanics, testing different pattern interpretations, and building a mental model of how inputs transform to outputs.'
        };
      case 'generating':
        return {
          title: 'Generating Solution' + stepInfo,
          description: 'Creating solution predictions and generating step-by-step visualizations of the reasoning process.',
          details: 'Saturn is applying the discovered pattern to the test case, generating intermediate visualization steps, and producing the final predicted output.'
        };
      case 'validating':
        return {
          title: 'Validating Results' + stepInfo,
          description: 'Checking the generated solution against pattern consistency and logical constraints.',
          details: 'The system is verifying that the proposed solution follows the identified pattern rules and makes logical sense within the puzzle context.'
        };
      case 'warning':
        return {
          title: 'Long-Running Analysis',
          description: 'Complex puzzle requiring extended processing time - approaching timeout threshold.',
          details: 'This puzzle is more challenging than usual and requires additional computational time. The analysis will continue but may timeout if it exceeds the configured limit.'
        };
      case 'timeout':
        return {
          title: 'Analysis Timeout',
          description: 'The analysis exceeded the maximum allowed time and was terminated.',
          details: 'Consider increasing the SATURN_TIMEOUT_MINUTES environment variable or simplifying the puzzle complexity. Some ARC puzzles require significant computational resources.'
        };
      case 'done':
        return {
          title: 'Analysis Complete',
          description: 'Saturn has finished processing and generated a solution with reasoning explanation.',
          details: 'The visual reasoning process is complete. Review the generated images, reasoning logs, and final solution below.'
        };
      case 'error':
        return {
          title: 'Processing Error',
          description: 'An error occurred during the analysis process.',
          details: 'Check the system output for error details. Common issues include missing API keys, invalid puzzle format, or system resource constraints.'
        };
      case 'log':
        return {
          title: 'Processing',
          description: 'Receiving real-time updates from the analysis engine.',
          details: 'Saturn is actively working on the puzzle and sending progress updates.'
        };
      default:
        return {
          title: phase || 'Waiting',
          description: phase ? `Current phase: ${phase}` : 'Waiting for analysis to begin.',
          details: 'Click "Start Analysis" to begin the Saturn visual reasoning process.'
        };
    }
  };

  const progressPercent = typeof state.progress === 'number' ? 
    Math.min(100, Math.max(0, state.progress * 100)) : 0;
  
  const phaseInfo = getPhaseExplanation(state.phase, state.step, state.totalSteps);
  
  // Calculate timing information
  const getTimingInfo = () => {
    if (!startTime || !isRunning) return null;
    
    const now = new Date();
    const elapsedMs = now.getTime() - startTime.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);
    
    let estimated = null;
    if (state.progress && state.progress > 0.1) {
      const totalEstimatedMs = elapsedMs / state.progress;
      const remainingMs = totalEstimatedMs - elapsedMs;
      if (remainingMs > 0) {
        const remainingMinutes = Math.floor(remainingMs / 60000);
        const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
        estimated = `${remainingMinutes}m ${remainingSeconds}s remaining`;
      }
    }
    
    return {
      elapsed: `${elapsedMinutes}m ${elapsedSeconds}s`,
      estimated
    };
  };
  
  const timingInfo = getTimingInfo();
  
  // Helper to format and categorize log lines
  const formatLogLine = (line: string, index: number) => {
    if (!line) {
      return {
        timestamp: '--:--:--',
        level: '',
        message: '',
        className: '',
        levelClassName: ''
      };
    }
    
    // Generate timestamp based on index (approximate)
    const now = new Date();
    const timestamp = new Date(now.getTime() - (state.logLines!.length - index - 1) * 1000);
    const timeStr = timestamp.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    // Detect log level and categorize
    let level = 'INFO';
    let levelClassName = 'bg-blue-100 text-blue-800';
    let className = '';
    
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes('error') || lowerLine.includes('failed') || lowerLine.includes('exception')) {
      level = 'ERROR';
      levelClassName = 'bg-red-100 text-red-800';
      className = 'border-l-2 border-red-300 bg-red-50';
    } else if (lowerLine.includes('warning') || lowerLine.includes('warn') || lowerLine.includes('timeout')) {
      level = 'WARN';
      levelClassName = 'bg-yellow-100 text-yellow-800';
      className = 'border-l-2 border-yellow-300 bg-yellow-50';
    } else if (lowerLine.includes('debug') || lowerLine.includes('trace')) {
      level = 'DEBUG';
      levelClassName = 'bg-gray-100 text-gray-600';
      className = 'text-gray-600';
    } else if (lowerLine.includes('saturn') || lowerLine.includes('analysis') || lowerLine.includes('processing')) {
      level = 'SATURN';
      levelClassName = 'bg-purple-100 text-purple-800';
      className = 'border-l-2 border-purple-300 bg-purple-50';
    } else if (lowerLine.includes('complete') || lowerLine.includes('success') || lowerLine.includes('finished')) {
      level = 'SUCCESS';
      levelClassName = 'bg-green-100 text-green-800';
      className = 'border-l-2 border-green-300 bg-green-50';
    }
    
    // Clean up the message (remove common prefixes)
    let message = line;
    const prefixPatterns = [
      /^\[\w+\]\s*/,  // [INFO], [DEBUG], etc.
      /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*/,  // timestamps
      /^.*?:\s*/  // any prefix ending with ":"
    ];
    
    for (const pattern of prefixPatterns) {
      message = message.replace(pattern, '');
    }
    
    return {
      timestamp: timeStr,
      level,
      message: message.trim(),
      className,
      levelClassName
    };
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Saturn Visual Solver</h1>
            <p className="text-gray-600">Task {taskId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <SaturnModelSelect value={modelKey} onChange={setModelKey} disabled={isRunning} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            disabled={isRunning}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button onClick={onStart} disabled={isRunning} className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            {isRunning ? 'Running…' : 'Start Analysis'}
          </Button>
        </div>
      </div>

      {/* Advanced Settings Panel */}
      {showAdvancedSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Advanced Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Temperature Control */}
            {supportsTemperature && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Temperature</Label>
                  <span className="text-sm text-gray-600">{temperature.toFixed(2)}</span>
                </div>
                <Slider
                  value={[temperature]}
                  onValueChange={(vals) => setTemperature(vals[0])}
                  min={0}
                  max={2}
                  step={0.05}
                  className="w-full"
                  disabled={isRunning}
                />
                <p className="text-xs text-gray-500">
                  Controls randomness. Lower = more focused, Higher = more creative.
                </p>
              </div>
            )}
            
            {/* GPT-5 Reasoning Controls */}
            {isGPT5ReasoningModel(modelKey) && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Reasoning Effort</Label>
                  <Select
                    value={reasoningEffort}
                    onValueChange={(v) => setReasoningEffort(v as 'minimal' | 'low' | 'medium' | 'high')}
                    disabled={isRunning}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    How much reasoning the model should perform.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Reasoning Verbosity</Label>
                  <Select
                    value={reasoningVerbosity}
                    onValueChange={(v) => setReasoningVerbosity(v as 'low' | 'medium' | 'high')}
                    disabled={isRunning}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Detail level of reasoning output.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Reasoning Summary</Label>
                  <Select
                    value={reasoningSummaryType}
                    onValueChange={(v) => setReasoningSummaryType(v as 'auto' | 'detailed')}
                    disabled={isRunning}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    Type of reasoning summary to generate.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Compact Status Overview */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                hasError ? 'bg-red-500' :
                hasWarning ? 'bg-orange-500 animate-pulse' :
                isRunning ? 'bg-yellow-500 animate-pulse' : 
                isDone ? 'bg-green-500' : 'bg-gray-300'
              }`} />
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2">
                  {hasError && '⚠ Error'}
                  {hasWarning && !hasError && '⚠ Warning'}
                  {isRunning && !hasError && !hasWarning && '🪐 Running'} 
                  {isDone && '✓ Complete'}
                  {!isRunning && !isDone && !hasError && !hasWarning && 'Ready'}
                  <span className="text-base">{phaseInfo.title}</span>
                </div>
                <div className="text-sm text-gray-600">
                  {phaseInfo.description}
                </div>
              </div>
            </div>
            <div className="text-right">
              {typeof state.step === 'number' && typeof state.totalSteps === 'number' && (
                <div className="text-lg font-bold text-blue-600">
                  {state.step}/{state.totalSteps}
                </div>
              )}
              <div className="text-sm text-gray-600">{progressPercent.toFixed(0)}%</div>
              {timingInfo && (
                <div className="text-xs text-gray-500">
                  {timingInfo.elapsed}{timingInfo.estimated && ` • ${timingInfo.estimated}`}
                </div>
              )}
            </div>
          </div>
          
          {/* Compact Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                hasError ? 'bg-red-500' : 
                hasWarning ? 'bg-orange-500' :
                isDone ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>


      {/* Python Solver Output */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Python Solver Output
            {state.logLines && state.logLines.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {state.logLines.length} lines
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            ref={logRef}
            className="bg-gray-900 text-green-400 font-mono text-sm border rounded-lg p-4 h-96 overflow-auto space-y-1"
          >
            {Array.isArray(state.logLines) && state.logLines.length > 0 ? (
              state.logLines.map((line, i) => {
                const formattedLog = formatLogLine(line, i);
                return (
                  <div key={i} className={`flex items-start gap-2 ${formattedLog.className}`}>
                    <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
                      {formattedLog.timestamp}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      formattedLog.level === 'ERROR' ? 'bg-red-900 text-red-300' :
                      formattedLog.level === 'WARN' ? 'bg-yellow-900 text-yellow-300' :
                      formattedLog.level === 'SUCCESS' ? 'bg-green-900 text-green-300' :
                      formattedLog.level === 'SATURN' ? 'bg-purple-900 text-purple-300' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {formattedLog.level}
                    </span>
                    <span className="flex-1 leading-relaxed">
                      {formattedLog.message}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-gray-500 text-center py-8">
                {isRunning ? 'Waiting for Python solver output...' : 'No output yet. Click "Start Analysis" to begin.'}
              </div>
            )}
            {isRunning && (
              <div className="flex items-center gap-2 text-green-400 animate-pulse">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-xs">Python solver running...</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Collapsible Puzzle Details */}
      <Card>
        <CardHeader>
          <Button 
            variant="ghost" 
            onClick={() => setShowPuzzleDetails(!showPuzzleDetails)}
            className="w-full justify-between h-auto py-4"
          >
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Puzzle Details ({task.train.length} training examples, {task.test?.length || 0} test cases)
            </div>
            <div className={`transform transition-transform ${showPuzzleDetails ? 'rotate-180' : ''}`}>
              ▼
            </div>
          </Button>
        </CardHeader>
        {showPuzzleDetails && (
          <CardContent className="pt-0">
            <div className="space-y-6">
              {/* Training Examples */}
              <div>
                <h4 className="font-medium mb-4 text-sm">Training Examples</h4>
                <div className="space-y-4">
                  {task.train.map((ex, i) => (
                    <div key={i} className="border rounded-lg p-4 bg-gray-50">
                      <div className="text-sm font-medium mb-3 text-center text-gray-700">Example {i + 1}</div>
                      <div className="flex flex-col lg:flex-row items-center gap-4 justify-center">
                        <PuzzleGrid grid={ex.input} title="Input" showEmojis={false} />
                        <div className="text-gray-400 text-2xl">→</div>
                        <PuzzleGrid grid={ex.output} title="Output" showEmojis={false} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Test Case */}
              {Array.isArray(task.test) && task.test.length > 0 && (
                <div>
                  <h4 className="font-medium mb-4 text-sm">Test Case</h4>
                  <div className="border rounded-lg p-4 bg-blue-50">
                    <div className="flex flex-col lg:flex-row items-center gap-4 justify-center">
                      <PuzzleGrid grid={task.test[0].input} title="Test Input" showEmojis={false} />
                      <div className="text-gray-400 text-2xl">→</div>
                      {task.test[0].output ? (
                        <PuzzleGrid grid={task.test[0].output} title="Expected Output" showEmojis={false} />
                      ) : (
                        <div className="text-center text-gray-500 border-2 border-dashed border-gray-300 rounded p-8 bg-white">
                          <div className="text-lg">?</div>
                          <div className="text-sm">Solution needed</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Image Gallery */}
      {Array.isArray(state.galleryImages) && state.galleryImages.length > 0 && (
        <SaturnImageGallery
          images={state.galleryImages}
          title={`Generated Images (${state.galleryImages.length})`}
        />
      )}

      {/* Results */}
      {isDone && state.result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Analysis Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm overflow-auto max-h-96 whitespace-pre-wrap">
                {JSON.stringify(state.result, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attribution */}
      <Alert className="bg-amber-50 border-amber-200">
        <AlertDescription className="text-center">
          Powered by the open-source{' '}
          <a
            href="https://github.com/zoecarver/saturn-arc"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium text-amber-800 hover:text-amber-900"
          >
            Saturn ARC project
          </a>
          {' '}by Zoe Carver
        </AlertDescription>
      </Alert>
    </div>
  );
}
