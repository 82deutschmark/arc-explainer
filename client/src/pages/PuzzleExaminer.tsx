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
import { PromptPreviewModal } from '@/components/PromptPreviewModal';
import { useAnalysisResults } from '@/hooks/useAnalysisResults';
import { useModels } from '@/hooks/useModels';

export default function PuzzleExaminer() {
  const { taskId } = useParams<{ taskId: string }>();
  const [showEmojis, setShowEmojis] = useState(false); // Default to colors as requested - controls UI display
  const [emojiSet, setEmojiSet] = useState<EmojiSet>(DEFAULT_EMOJI_SET);
  const [sendAsEmojis, setSendAsEmojis] = useState(false); // Controls what gets sent to AI models
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [omitAnswer, setOmitAnswer] = useState(true); // Cascade: researcher option to hide correct answer in prompt
  // systemPromptMode is now hardcoded to 'ARC' - the new modular architecture replaces legacy {ARC}/{None} toggle

  // Set page title with puzzle ID
  React.useEffect(() => {
    document.title = taskId ? `ARC Puzzle ${taskId}` : 'ARC Puzzle Examiner';
  }, [taskId]);

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
  const { data: models, isLoading: isLoadingModels, error: modelsError } = useModels();
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
    topP,
    setTopP,
    candidateCount,
    setCandidateCount,
  } = useAnalysisResults({
    taskId,
    refetchExplanations,
    // Forward researcher options to backend
    emojiSetKey: sendAsEmojis ? emojiSet : undefined, // Only send emoji set if "Send as emojis" is enabled
    omitAnswer,
    // systemPromptMode removed - now hardcoded to 'ARC' in the backend
  });
  
  // Find the current model's details if we're analyzing
  const currentModel = currentModelKey ? models?.find(model => model.key === currentModelKey) : null;

  // Loading state
  if (isLoadingTask || isLoadingModels) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading tasks...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (taskError || !task || modelsError) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Alert>
          <AlertDescription>
            Failed to load puzzle: {taskError?.message || modelsError?.message || 'Puzzle not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Handle model selection
  const handleAnalyzeWithModel = (modelKey: string) => {
    const model = models?.find(m => m.key === modelKey);
    analyzeWithModel(modelKey, model?.supportsTemperature ?? true);
  };

  return (
    <div className="container mx-auto p-3 max-w-6xl space-y-3">
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
            <h1 className="text-2xl font-bold">Puzzle {taskId}</h1>
            <p className="text-gray-600">ARC Task Examiner</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/model-examiner">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Model Examiner
            </Button>
          </Link>
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


      {/* Complete Puzzle Pattern */}
      <Card>
        <CardHeader>
          <CardTitle>Complete Puzzle Pattern</CardTitle>
          <p className="text-sm text-gray-600">Training examples show the pattern, test case shows the question and correct answer</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {/* Training Examples */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                Training Examples 
                <Badge variant="outline">{task.train.length} examples</Badge>
              </h3>
              <div className="space-y-4">
                {task.train.map((example, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3">
                    <h4 className="text-sm font-medium mb-2 text-center">Example {index + 1}</h4>
                    <div className="flex items-center justify-center gap-6">
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
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-3 text-center">Test Case & Correct Answer</h3>
              {task.test.map((testCase, index) => (
                <div key={index} className="flex items-center justify-center gap-6">
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
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Model Testing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Model Analysis
          </CardTitle>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Test how different AI models try to explain why this solution is correct
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
          
          {/* Error Message */}
          {analyzerError && (
            <Alert className="mt-2 mb-4 border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">
                <strong>API Error:</strong> {analyzerError.message}
              </AlertDescription>
            </Alert>
          )}
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

          {/* Prompt Preview */}
          <div className="mb-3 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPromptPreview(true)}
              disabled={isAnalyzing}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              Preview Prompt
            </Button>
          </div>
          
          {/* Model Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 mb-4">
            {models?.map((model) => {
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
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-semibold text-indigo-800 flex items-center gap-2">
                <Rocket className="h-4 w-4" />
                Alternative Visual Solver
              </h5>
            </div>
            <div className="flex items-center gap-4">
              <Link href={`/puzzle/saturn/${taskId}`}>
                <Button size="default" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700">
                  <Rocket className="h-4 w-4" />
                  Open Saturn Visual Solver
                </Button>
              </Link>
              <div className="flex-1">
                <p className="text-sm text-indigo-700 mb-1">
                  Uses iterative visual analysis to solve puzzles step-by-step
                </p>
                <p className="text-xs text-indigo-600">
                  💡 Powered by the open-source{' '}
                  <a
                    href="https://github.com/zoecarver/saturn-arc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium hover:text-indigo-800"
                  >
                    Saturn ARC project by Zoe Carver
                  </a>
                </p>
              </div>
            </div>
          </div>
          
          {/* Temperature Control */}
          <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded">
            <div className="flex items-center gap-3">
              <Label htmlFor="temperature" className="text-sm font-medium whitespace-nowrap">
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
              <div className="text-xs text-gray-600 flex-shrink-0">
                <div>Controls creativity • Gemini & GPT-4.1 & older only!!!</div>
                <div className="text-blue-600">💡 Temperature and reasoning are mutually exclusive</div>
              </div>
            </div>
          </div>

          {/* Top P Control */}
          <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded">
            <div className="flex items-center gap-3">
              <Label htmlFor="topP" className="text-sm font-medium whitespace-nowrap">
                Top P: {topP.toFixed(2)}
              </Label>
              <div className="flex-1 max-w-xs">
                <Slider
                  id="topP"
                  min={0.0}
                  max={1.0}
                  step={0.05}
                  value={[topP]}
                  onValueChange={(value) => setTopP(value[0])}
                  className="w-full"
                />
              </div>
              <div className="text-xs text-gray-600 flex-shrink-0">
                <div>Controls diversity • Gemini only</div>
              </div>
            </div>
          </div>

          {/* Candidate Count Control */}
          <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded">
            <div className="flex items-center gap-3">
              <Label htmlFor="candidateCount" className="text-sm font-medium whitespace-nowrap">
                Candidates: {candidateCount}
              </Label>
              <div className="flex-1 max-w-xs">
                <Slider
                  id="candidateCount"
                  min={1}
                  max={8}
                  step={1}
                  value={[candidateCount]}
                  onValueChange={(value) => setCandidateCount(value[0])}
                  className="w-full"
                />
              </div>
              <div className="text-xs text-gray-600 flex-shrink-0">
                <div>Number of responses • Gemini only</div>
              </div>
            </div>
          </div>

          {/* GPT-5 Reasoning Parameters */}
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <h5 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
              <Brain className="h-4 w-4" />
              GPT-5 Reasoning Parameters
            </h5>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                  <p className="text-xs text-blue-600 mt-0.5">
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
                  <p className="text-xs text-blue-600 mt-0.5">
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
                  <p className="text-xs text-blue-600 mt-0.5">
                    {reasoningSummaryType === 'auto' && 'Automatic summary generation'}
                    {reasoningSummaryType === 'detailed' && 'Comprehensive summary'}
                  </p>
                </div>
              </div>
            </div>


          {/* Analysis Results */}
          {explanations.length > 0 && (
            <div className="mt-4">
              <h4 className="text-lg font-semibold mb-2">Analysis Results ({explanations.length})</h4>
              <div className="space-y-3">
                {explanations.map((explanation) => (
                  <AnalysisResultCard
                    key={`${explanation.id}-${explanation.modelName}`} // More specific key for better React reconciliation
                    modelKey={explanation.modelName}
                    result={explanation}
                    model={models?.find(m => m.key === explanation.modelName)} // Pass model config to enable temperature display
                    testCases={task.test} // Pass the full test array
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Prompt Preview Modal */}
      <PromptPreviewModal
        isOpen={showPromptPreview}
        onClose={() => setShowPromptPreview(false)}
        task={task}
        taskId={taskId}

        promptId={promptId}
        customPrompt={customPrompt}
        options={{
          emojiSetKey: emojiSet,
          omitAnswer,
          sendAsEmojis  /// THIS SHOULD EXIST!!!!
        }}
      />
    </div>
  );
}
