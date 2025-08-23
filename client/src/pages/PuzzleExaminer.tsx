/**
 * PuzzleExaminer.tsx
 * 
 * @author Cascade
 * @description This is the main page component for examining a single ARC puzzle.
 * It orchestrates the fetching of puzzle data and existing explanations from the database.
 * It uses the useAnalysisResults hook to handle new analysis requests and renders the results
 * using modular child components like PuzzleGrid and AnalysisResultCard.
 * The component is designed around a database-first architecture, ensuring that the UI
 * always reflects the stored state, making puzzle pages static and shareable.
 */

import React, { useState } from 'react';
import { useParams, Link } from 'wouter';
import { AnalysisResult } from '@/types/puzzle';
import { usePuzzle } from '@/hooks/usePuzzle';
import { usePuzzleWithExplanation } from '@/hooks/useExplanation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, Hash, ArrowLeft, Brain, Rocket } from 'lucide-react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EMOJI_SET_INFO, DEFAULT_EMOJI_SET } from '@/lib/spaceEmojis';
import type { EmojiSet } from '@/lib/spaceEmojis';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

// Import our refactored components and hooks
import { PuzzleGrid } from '@/components/puzzle/PuzzleGrid';
import { ModelButton } from '@/components/puzzle/ModelButton';
import { AnalysisResultCard } from '@/components/puzzle/AnalysisResultCard';
import { PromptPicker } from '@/components/PromptPicker';
// PromptPreviewModal removed - was broken and marked for deletion
import { useAnalysisResults } from '@/hooks/useAnalysisResults';
import { MODELS } from '@/constants/models';

export default function PuzzleExaminer() {
  const { taskId } = useParams<{ taskId: string }>();
  const [showEmojis, setShowEmojis] = useState(false); // Default to colors as requested - controls UI display
  const [emojiSet, setEmojiSet] = useState<EmojiSet>(DEFAULT_EMOJI_SET);
  const [sendAsEmojis, setSendAsEmojis] = useState(false); // Controls what gets sent to AI models
  // Preview modal functionality temporarily disabled due to broken component
  const [omitAnswer, setOmitAnswer] = useState(true); // Cascade: researcher option to hide correct answer in prompt
  // systemPromptMode is now hardcoded to 'ARC' - the new modular architecture replaces legacy {ARC}/{None} toggle

  // Early return if no taskId
  if (!taskId) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Alert>
          <AlertDescription>Invalid puzzle ID</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Fetch puzzle data
  const { currentTask: task, isLoadingTask, taskError } = usePuzzle(taskId);
  const { explanations, hasExplanation, refetchExplanations } = usePuzzleWithExplanation(taskId);

  // Use the custom hook for analysis results management
  const {
    temperature,
    setTemperature,
    promptId,
    setPromptId,
    customPrompt,
    setCustomPrompt,
    analyzeWithModel,
    currentModelKey,
    processingModels,
    isAnalyzing,
    analyzerError,
    // GPT-5 reasoning parameters
    reasoningEffort,
    setReasoningEffort,
    reasoningVerbosity,
    setReasoningVerbosity,
    reasoningSummaryType,
    setReasoningSummaryType,
    isGPT5ReasoningModel,
  } = useAnalysisResults({
    taskId,
    refetchExplanations,
    // Forward researcher options to backend
    emojiSetKey: sendAsEmojis ? emojiSet : undefined, // Only send emoji set if "Send as emojis" is enabled
    omitAnswer,
    // systemPromptMode removed - now hardcoded to 'ARC' in the backend
  });
  
  // Find the current model's details if we're analyzing
  const currentModel = currentModelKey ? MODELS.find(model => model.key === currentModelKey) : null;

  // Loading state
  if (isLoadingTask) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading ARC puzzle data...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
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

  // Handle model selection
  const handleAnalyzeWithModel = (modelKey: string) => {
    const model = MODELS.find(m => m.key === modelKey);
    analyzeWithModel(modelKey, model?.supportsTemperature ?? true);
  };

  return (
    <div className="container mx-auto p-2 max-w-4xl space-y-2">
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
            <h1 className="text-xl font-bold">Puzzle {taskId}</h1>
            <p className="text-gray-600 text-sm">Testing LLM ARC-AGI Performance</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant={showEmojis ? "default" : "outline"}
            size="sm"
            onClick={() => setShowEmojis(!showEmojis)}
            className={`transition-all duration-300 ${
              showEmojis 
                ? 'animate-slow-pulse bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg shadow-purple-500/25 border-2 border-purple-400/50' 
                : 'animate-slow-pulse border-2 border-amber-400/50 hover:border-amber-500 hover:bg-amber-50 hover:text-amber-800 shadow-lg shadow-amber-500/25'
            }`}
          >
            {showEmojis ? (
              <Hash className="h-4 w-4 mr-2 animate-slow-bounce text-white" />
            ) : (
              <Eye className="h-4 w-4 mr-2 animate-slow-bounce text-amber-600" />
            )}
            <span className={showEmojis ? 'text-white font-semibold' : 'text-amber-700 font-semibold'}>
              {showEmojis ? '🔢 Show Numbers' : '🛸 Show Emojis'}
            </span>
          </Button>
          
          {/* Emoji Palette Selector */}
          {showEmojis && (
            <Select
              value={emojiSet}
              onValueChange={(val) => setEmojiSet(val as EmojiSet)}
              disabled={isAnalyzing}
            >
              <SelectTrigger className="w-40" title={EMOJI_SET_INFO[emojiSet]?.description}>
                <SelectValue placeholder="Emoji palette" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Emoji Palettes</SelectLabel>
                  {Object.entries(EMOJI_SET_INFO)
                    .map(([key, info]) => (
                      <SelectItem key={key} value={key}>
                        {info.name}
                      </SelectItem>
                    ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>


      {/* Training & Test Grids */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Training & Test Grids for Task {taskId}</CardTitle>
          <p className="text-xs text-gray-600">Training examples demonstrate pattern, test shows challenge</p>
        </CardHeader>
        <CardContent className="p-3">
          <div className="space-y-4">
            {/* Training Examples */}
            <div>
              <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                Training Examples 
                <Badge variant="outline" className="text-xs">{task.train.length} examples</Badge>
              </h3>
              <div className="space-y-3">
                {task.train.map((example, index) => (
                  <div key={index} className="border border-gray-200 rounded p-2">
                    <h4 className="text-xs font-medium mb-2 text-center">Example {index + 1}</h4>
                    <div className="flex items-center justify-center gap-4">
                      <PuzzleGrid 
                        grid={example.input}
                        title="Input"  
                        showEmojis={showEmojis}
                        emojiSet={emojiSet}
                      />
                      <div className="text-3xl text-gray-400">→</div>
                      <PuzzleGrid 
                        grid={example.output}
                        title="Output"
                        showEmojis={showEmojis}
                        emojiSet={emojiSet}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Test Case */}
            <div className="border-t pt-3">
              <h3 className="text-base font-semibold mb-2 text-center">{task.test.length === 1 ? 'Test Case & Correct Answer' : `Test Cases & Correct Answers (${task.test.length})`}</h3>
              <div className="space-y-4">
                {task.test.map((testCase, index) => (
                  <div key={index} className="border border-gray-200 rounded p-3">
                    <h4 className="text-xs font-medium mb-2 text-center">Test Case {index + 1}</h4>
                    <div className="flex items-center justify-center gap-4">
                      <PuzzleGrid 
                        grid={testCase.input}
                        title="Test Question"
                        showEmojis={showEmojis}
                        emojiSet={emojiSet}
                      />
                      <div className="text-3xl text-green-600">→</div>
                      <PuzzleGrid 
                        grid={testCase.output}
                        title="Correct Answer"
                        showEmojis={showEmojis}
                        emojiSet={emojiSet}
                        highlight={true}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Model Performance Analysis */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-4 w-4" />
            Model Performance Analysis
          </CardTitle>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">
              Test different LLMs on this ARC-AGI challenge
            </p>
            {isAnalyzing && currentModel && (
              <div className="flex flex-col">
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Analyzing with {currentModel.name}...
                </div>
                {currentModel.responseTime && (
                  <div className={`text-xs mt-1 ${currentModel.responseTime.speed === 'slow' ? 'text-red-600' : 
                              currentModel.responseTime.speed === 'moderate' ? 'text-amber-600' : 
                              'text-green-600'}`}>
                    {currentModel.responseTime.speed === 'slow' ? '⏳' : 
                     currentModel.responseTime.speed === 'moderate' ? '⌛' : '⚡'} 
                    Expected response time: {currentModel.responseTime.estimate}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Prompt Picker */}
          <PromptPicker
            selectedPromptId={promptId}
            onPromptChange={setPromptId}
            customPrompt={customPrompt}
            onCustomPromptChange={setCustomPrompt}
            disabled={isAnalyzing}
            sendAsEmojis={sendAsEmojis}
            onSendAsEmojisChange={setSendAsEmojis}
            omitAnswer={omitAnswer}
            onOmitAnswerChange={setOmitAnswer}
            // systemPromptMode removed - now using modular architecture
          />

          {/* Prompt Preview - Temporarily disabled due to broken component */}
          <div className="mb-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              disabled={true}
              className="flex items-center gap-2 opacity-50"
              title="Prompt preview temporarily disabled - component needs rebuild for new architecture"
            >
              <Eye className="h-4 w-4" />
              Preview Prompt (Disabled)
            </Button>
          </div>
          
          {/* Model Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 mb-4">
            {MODELS.map((model) => {
              const isThisModelProcessing = processingModels.has(model.key);
              
              return (
                <ModelButton
                  key={model.key}
                  model={model}
                  isAnalyzing={isThisModelProcessing}
                  explanationCount={explanations.filter(explanation => explanation.modelName === model.key).length}
                  onAnalyze={handleAnalyzeWithModel}
                  disabled={isThisModelProcessing}
                />
              );
            })}
          </div>

          {/* Saturn Visual Solver */}
          <div className="mb-3 p-2 bg-indigo-50 border border-indigo-200 rounded">
            <div className="flex items-center justify-between mb-1">
              <h5 className="text-xs font-semibold text-indigo-800 flex items-center gap-2">
                <Rocket className="h-3 w-3" />
                Saturn Visual Solver
              </h5>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Link href={`/puzzle/saturn/${taskId}`}>
                <Button size="sm" className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-xs">
                  <Rocket className="h-3 w-3" />
                  Open Saturn
                </Button>
              </Link>
              <div className="flex-1">
                <span className="text-indigo-700">
                  Iterative visual analysis • 
                </span>
                <a
                  href="https://github.com/zoecarver/saturn-arc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-indigo-600 hover:text-indigo-800"
                >
                  Saturn ARC project
                </a>
              </div>
            </div>
          </div>
          
          {/* Temperature Control */}
          <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded">
            <div className="flex items-center gap-4">
              <Label htmlFor="temperature" className="text-sm font-medium">
                Temperature: {temperature}
              </Label>
              <div className="flex-1 max-w-xs">
                <Slider
                  id="temperature"
                  min={0.1}
                  max={2.0}
                  step={0.05}
                  value={[temperature]}
                  onValueChange={(value) => setTemperature(value[0])}
                  className="w-full"
                />
              </div>
              <div className="text-xs text-gray-600">
                <div>Controls creativity • Only GPT-4.1 series & GPT-5 Chat support this</div>
                <div className="text-blue-600">💡 Temperature and reasoning are mutually exclusive features</div>
                <div className="text-amber-600 font-medium">⚠️ Values above 1.1 may produce crazy and illegible replies</div>
              </div>
            </div>
          </div>

          {/* GPT-5 Reasoning Parameters */}
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded">
            <h5 className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-2">
              <Brain className="h-3 w-3" />
              GPT-5 Reasoning Parameters
            </h5>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {/* Effort Control */}
                <div>
                  <Label htmlFor="reasoning-effort" className="text-sm font-medium text-blue-700">
                    Effort Level
                  </Label>
                  <Select 
                    value={reasoningEffort} 
                    onValueChange={(value) => setReasoningEffort(value as 'minimal' | 'low' | 'medium' | 'high')}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select effort level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-blue-600 mt-1">
                    {reasoningEffort === 'minimal' && 'Basic reasoning'}
                    {reasoningEffort === 'low' && 'Light reasoning'}
                    {reasoningEffort === 'medium' && 'Moderate reasoning'}
                    {reasoningEffort === 'high' && 'Intensive reasoning'}
                  </p>
                </div>

                {/* Verbosity Control */}
                <div>
                  <Label htmlFor="reasoning-verbosity" className="text-sm font-medium text-blue-700">
                    Verbosity
                  </Label>
                  <Select 
                    value={reasoningVerbosity} 
                    onValueChange={(value) => setReasoningVerbosity(value as 'low' | 'medium' | 'high')}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select verbosity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-blue-600 mt-1">
                    {reasoningVerbosity === 'low' && 'Concise reasoning logs'}
                    {reasoningVerbosity === 'medium' && 'Balanced detail'}
                    {reasoningVerbosity === 'high' && 'Detailed reasoning logs'}
                  </p>
                </div>

                {/* Summary Control */}
                <div>
                  <Label htmlFor="reasoning-summary" className="text-sm font-medium text-blue-700">
                    Summary
                  </Label>
                  <Select 
                    value={reasoningSummaryType} 
                    onValueChange={(value) => setReasoningSummaryType(value as 'auto' | 'detailed')}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select summary type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-blue-600 mt-1">
                    {reasoningSummaryType === 'auto' && 'Automatic summary generation'}
                    {reasoningSummaryType === 'detailed' && 'Comprehensive summary'}
                  </p>
                </div>
              </div>
            </div>


          {/* Analysis Results */}
          {explanations.length > 0 && (
            <div className="mt-4">
              <h4 className="text-base font-semibold mb-2">Analysis Results</h4>
              
              {/* Database Explanations Section */}
              {explanations.filter(exp => exp.id !== undefined).length > 0 && (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-blue-800 mb-1">Database Explanations</h5>
                  <div className="space-y-2">
                    {explanations
                      .filter(explanation => explanation.id !== undefined)
                      .map((explanation) => (
                        <AnalysisResultCard
                          key={explanation.id}
                          modelKey={explanation.modelName}
                          result={explanation}
                          expectedOutputGrid={task.test && task.test.length > 0 ? task.test[0].output : undefined}
                          allExpectedOutputGrids={task.test?.map(t => t.output) || []}
                        />
                      ))}
                  </div>
                </div>
              )}
              
              {/* AI Generated Explanations Section */}
              {explanations.filter(exp => exp.id === undefined).length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-green-800 mb-1">AI Generated Explanations</h5>
                  <div className="space-y-2">
                    {explanations
                      .filter(explanation => explanation.id === undefined)
                      .map((explanation, index) => (
                        <AnalysisResultCard
                          key={`generated-${index}`}
                          modelKey={explanation.modelName}
                          result={explanation}
                          expectedOutputGrid={task.test && task.test.length > 0 ? task.test[0].output : undefined}
                          allExpectedOutputGrids={task.test?.map(t => t.output) || []}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
