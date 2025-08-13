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
import { Label } from '@/components/ui/label';
import { Loader2, Eye, Hash, ArrowLeft, Brain } from 'lucide-react';
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
import { useAnalysisResults } from '@/hooks/useAnalysisResults';
import { MODELS } from '@/constants/models';

export default function PuzzleExaminer() {
  const { taskId } = useParams<{ taskId: string }>();
  const [showEmojis, setShowEmojis] = useState(false); // Default to colors as requested
  const [emojiSet, setEmojiSet] = useState<EmojiSet>(DEFAULT_EMOJI_SET);

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
    isProviderProcessing,
  } = useAnalysisResults({
    taskId,
    refetchExplanations,
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
            <span>Loading alien communication pattern...</span>
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
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
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
            <p className="text-gray-600">Examining alien communication pattern</p>
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

          {/* Emoji Set Picker */}
          <div className="w-56">
            <Select
              value={emojiSet}
              onValueChange={(val) => setEmojiSet(val as EmojiSet)}
              disabled={!showEmojis}
            >
              <SelectTrigger className="h-8" title={EMOJI_SET_INFO[emojiSet]?.description}>
                <SelectValue placeholder="Select emoji palette" />
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
          </div>
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
              <div className="space-y-6">
                {task.train.map((example, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-medium mb-3 text-center">Example {index + 1}</h4>
                    <div className="flex items-center justify-center gap-8">
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
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-center">Test Case & Correct Answer</h3>
              {task.test.map((testCase, index) => (
                <div key={index} className="flex items-center justify-center gap-8">
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
              Test how different AI models explain why this solution is correct and what the aliens might mean
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
          />
          
          {/* Model Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
            {MODELS.map((model) => {
              const isThisProviderProcessing = isProviderProcessing(model.key);
              const isThisModelProcessing = processingModels.has(model.key);
              
              return (
                <ModelButton
                  key={model.key}
                  model={model}
                  isAnalyzing={isThisModelProcessing}
                  explanationCount={explanations.filter(explanation => explanation.modelName === model.key).length}
                  onAnalyze={handleAnalyzeWithModel}
                  disabled={isThisProviderProcessing}
                />
              );
            })}
          </div>
          
          {/* Temperature Control */}
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-4">
              <Label htmlFor="temperature" className="text-sm font-medium">
                Temperature: {temperature}
              </Label>
              <div className="flex-1 max-w-xs">
                <Slider
                  id="temperature"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={[temperature]}
                  onValueChange={(value) => setTemperature(value[0])}
                  className="w-full"
                />
              </div>
              <span className="text-xs text-gray-600">
                Controls creativity (some models don't support this)
              </span>
            </div>
          </div>

          {/* Cost Information */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 Costs shown per million tokens. Most puzzle analyses use ~1K-5K tokens.
              Premium models (💰) provide advanced reasoning but cost more.
            </p>
          </div>

          {/* Analysis Results */}
          {explanations.length > 0 && (
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-3">Analysis Results</h4>
              
              {/* Database Explanations Section */}
              {explanations.filter(exp => exp.id !== undefined).length > 0 && (
                <div className="mb-6">
                  <h5 className="text-md font-medium text-blue-800 mb-2">Database Explanations</h5>
                  <div className="space-y-4">
                    {explanations
                      .filter(explanation => explanation.id !== undefined)
                      .map((explanation) => (
                        <AnalysisResultCard
                          key={explanation.id}
                          modelKey={explanation.modelName}
                          result={explanation}
                        />
                      ))}
                  </div>
                </div>
              )}
              
              {/* AI Generated Explanations Section */}
              {explanations.filter(exp => exp.id === undefined).length > 0 && (
                <div>
                  <h5 className="text-md font-medium text-green-800 mb-2">AI Generated Explanations</h5>
                  <div className="space-y-4">
                    {explanations
                      .filter(explanation => explanation.id === undefined)
                      .map((explanation, index) => (
                        <AnalysisResultCard
                          key={`generated-${index}`}
                          modelKey={explanation.modelName}
                          result={explanation}
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
