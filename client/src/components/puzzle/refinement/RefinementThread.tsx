/**
 * RefinementThread.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-07
 * PURPOSE: Main component for displaying progressive refinement thread.
 * Shows original analysis followed by linear progression of refinement iterations.
 * Replaces IndividualDebate with refinement-focused UI and terminology.
 * Single responsibility: Manage refinement thread display and coordination.
 * SRP/DRY check: Pass - Single responsibility (thread coordination), reuses OriginalExplanationCard and delegates to IterationCard
 * shadcn/ui: Pass - Uses shadcn/ui Card, Badge, Button, Alert components
 */

import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, ArrowLeft, Sparkles, TrendingUp, Send, Loader2, RotateCcw, Eye, Settings } from 'lucide-react';

// Reuse existing components
import { OriginalExplanationCard } from '@/components/puzzle/debate/OriginalExplanationCard';
import { IterationCard } from './IterationCard';
import { PromptPreviewModal } from '@/components/PromptPreviewModal';

// Types
import type { ExplanationData } from '@/types/puzzle';
import type { ARCExample, ModelConfig, ARCTask } from '@shared/types';

interface RefinementIteration {
  id: string;
  iterationNumber: number;
  content: ExplanationData;
  timestamp: string;
}

interface RefinementThreadProps {
  // Core data
  originalExplanation: ExplanationData;
  iterations: RefinementIteration[];
  taskId: string;
  testCases: ARCExample[];
  models?: ModelConfig[];
  task: ARCTask;

  // State
  activeModel: string;
  userGuidance: string;
  isProcessing: boolean;
  error?: Error | null;

  // Temperature control
  temperature: number;
  setTemperature: (value: number) => void;

  // GPT-5 reasoning controls
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
  setReasoningEffort: (value: 'minimal' | 'low' | 'medium' | 'high') => void;
  reasoningVerbosity: 'low' | 'medium' | 'high';
  setReasoningVerbosity: (value: 'low' | 'medium' | 'high') => void;
  reasoningSummaryType: 'auto' | 'detailed';
  setReasoningSummaryType: (value: 'auto' | 'detailed') => void;

  // Model type detection
  isGPT5ReasoningModel: (modelKey: string) => boolean;

  // Prompt configuration
  promptId: string;

  // Actions
  onBackToList: () => void;
  onResetRefinement: () => void;
  onUserGuidanceChange: (guidance: string) => void;
  onContinueRefinement: () => void;
}

export const RefinementThread: React.FC<RefinementThreadProps> = ({
  originalExplanation,
  iterations,
  taskId,
  testCases,
  models,
  task,
  activeModel,
  userGuidance,
  isProcessing,
  error,
  temperature,
  setTemperature,
  reasoningEffort,
  setReasoningEffort,
  reasoningVerbosity,
  setReasoningVerbosity,
  reasoningSummaryType,
  setReasoningSummaryType,
  isGPT5ReasoningModel,
  promptId,
  onBackToList,
  onResetRefinement,
  onUserGuidanceChange,
  onContinueRefinement
}) => {
  const threadEndRef = useRef<HTMLDivElement>(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  // Auto-scroll to newest iteration when thread updates
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [iterations.length]);

  // Get original iteration (iteration 0)
  const originalIteration = iterations.find(iter => iter.iterationNumber === 0);

  // Get refinement iterations (iteration > 0)
  const refinementIterations = iterations.filter(iter => iter.iterationNumber > 0);

  // Calculate total reasoning tokens across all iterations
  const totalReasoningTokens = iterations.reduce(
    (sum, iter) => sum + (iter.content.reasoningTokens || 0),
    0
  );

  // Get model display name and config
  const currentModel = models?.find(m => m.key === activeModel);
  const modelDisplayName = currentModel?.name || activeModel;

  // Model capability detection
  const showTemperature = currentModel?.supportsTemperature && !isGPT5ReasoningModel(activeModel);
  const showReasoning = isGPT5ReasoningModel(activeModel);

  // Determine if original was correct
  const hasMultiTest = originalExplanation.hasMultiplePredictions &&
    (originalExplanation.multiTestAllCorrect !== undefined || originalExplanation.multiTestAverageAccuracy !== undefined);

  const isOriginalCorrect = hasMultiTest
    ? originalExplanation.multiTestAllCorrect === true
    : originalExplanation.isPredictionCorrect === true;

  return (
    <div className="space-y-3">
      {/* Compact Header with Controls */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardContent className="p-2 space-y-2">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-100">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Reasoning Evolution</h2>
                <p className="text-xs text-gray-600">
                  {iterations.length} stage{iterations.length !== 1 ? 's' : ''} • Progressive refinement
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={onResetRefinement}
                disabled={iterations.length <= 1 || isProcessing}
                className="text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Reset
              </Button>
              <Button variant="outline" size="sm" onClick={onBackToList}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
          </div>

          {/* Active Model & Stats Row */}
          <div className="pt-3 border-t border-purple-200">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Active Model */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-medium text-gray-700">Active Model</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-purple-100 text-purple-900 border-purple-300 font-mono text-xs">
                    {modelDisplayName}
                  </Badge>
                  <span className="text-xs text-gray-600">Locked</span>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-gray-700">Total Reasoning</span>
                </div>
                <div className="text-sm font-semibold text-blue-900">
                  {totalReasoningTokens.toLocaleString()} tokens
                </div>
                <p className="text-[10px] text-gray-500">
                  Reasoning depth: 60k tokens preserved on server
                </p>
              </div>

              {/* Current Iteration */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-medium text-gray-700">Current Iteration</span>
                </div>
                <Badge variant="secondary" className="text-sm font-mono">
                  #{iterations.length - 1}
                </Badge>
              </div>
            </div>
          </div>

          {/* Advanced Controls Section - COMPACT */}
          {(showTemperature || showReasoning) && (
            <div className="pt-1 border-t border-purple-200">
              <div className="flex items-center gap-1 mb-0.5">
                <Settings className="h-3 w-3 text-purple-600" />
                <span className="text-[9px] font-medium text-gray-700">Advanced</span>
              </div>

              <div className="grid grid-cols-1 gap-0.5">
                {/* Temperature Control - EDITABLE */}
                {showTemperature && (
                  <div className="p-1 bg-gray-50 border border-gray-200 rounded">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="temperature" className="text-[8px] font-medium whitespace-nowrap">
                        Temp: {temperature.toFixed(2)}
                      </Label>
                      <div className="flex-1 max-w-[200px]">
                        <Slider
                          id="temperature"
                          min={0.1}
                          max={2.0}
                          step={0.05}
                          value={[temperature]}
                          onValueChange={(value) => setTemperature(value[0])}
                          className="w-full h-3"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* GPT-5 Reasoning Parameters - EDITABLE */}
                {showReasoning && (
                  <div className="p-1 bg-blue-50 border border-blue-200 rounded">
                    <div className="grid grid-cols-3 gap-1">
                      {/* Effort */}
                      <div>
                        <Label htmlFor="reasoning-effort" className="text-[8px] font-medium text-blue-700">
                          Effort
                        </Label>
                        <Select value={reasoningEffort} onValueChange={(value) => setReasoningEffort(value as 'minimal' | 'low' | 'medium' | 'high')}>
                          <SelectTrigger className="w-full h-5 text-[8px] px-1">
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

                      {/* Verbosity */}
                      <div>
                        <Label htmlFor="reasoning-verbosity" className="text-[8px] font-medium text-blue-700">
                          Verbosity
                        </Label>
                        <Select value={reasoningVerbosity} onValueChange={(value) => setReasoningVerbosity(value as 'low' | 'medium' | 'high')}>
                          <SelectTrigger className="w-full h-5 text-[8px] px-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Summary */}
                      <div>
                        <Label htmlFor="reasoning-summary" className="text-[8px] font-medium text-blue-700">
                          Summary
                        </Label>
                        <Select value={reasoningSummaryType} onValueChange={(value) => setReasoningSummaryType(value as 'auto' | 'detailed')}>
                          <SelectTrigger className="w-full h-5 text-[8px] px-1">
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

                {/* Prompt Preview Button - COMPACT */}
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPromptPreview(true)}
                    disabled={isProcessing}
                    className="flex items-center gap-0.5 h-5 text-[8px] px-2 py-0"
                  >
                    <Eye className="h-2.5 w-2.5" />
                    Preview
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Continue Refinement Controls */}
          <div className="pt-2 border-t border-purple-200">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-end">
              {/* User Guidance Input */}
              <div className="lg:col-span-2">
                <label className="text-xs font-medium mb-1.5 block text-gray-700">
                  User Guidance (Optional)
                </label>
                <Textarea
                  value={userGuidance}
                  onChange={(e) => onUserGuidanceChange(e.target.value)}
                  placeholder="Leave blank for the model to refine based on its own analysis"
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              {/* Continue Button */}
              <div>
                <Button
                  onClick={onContinueRefinement}
                  disabled={isProcessing}
                  className="w-full h-[72px] text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Refining...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Continue Refinement
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive" className="mt-3 py-2">
                <AlertDescription className="text-xs">
                  {error.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Thread content - full width */}
      <div className="space-y-3">
        {/* Original Analysis */}
        {originalIteration && (
          <OriginalExplanationCard
            explanation={originalIteration.content}
            models={models}
            testCases={testCases}
            timestamp={originalIteration.timestamp}
          />
        )}

        {/* Refinement Iterations */}
        {refinementIterations.map((iteration, index) => {
          // Calculate cumulative reasoning tokens up to this point
          const cumulativeReasoningTokens = iterations
            .slice(0, iterations.indexOf(iteration) + 1)
            .reduce((sum, iter) => sum + (iter.content.reasoningTokens || 0), 0);

          return (
            <IterationCard
              key={iteration.id}
              explanation={iteration.content}
              models={models}
              testCases={testCases}
              timestamp={iteration.timestamp}
              iterationNumber={iteration.iterationNumber}
              cumulativeReasoningTokens={cumulativeReasoningTokens}
            />
          );
        })}

        {/* Anchor for auto-scroll to bottom */}
        <div ref={threadEndRef} />
      </div>

      {/* Prompt Preview Modal */}
      <PromptPreviewModal
        isOpen={showPromptPreview}
        onClose={() => setShowPromptPreview(false)}
        task={task}
        taskId={taskId}
        promptId={promptId}
        options={{
          originalExplanation: originalExplanation,
          customChallenge: userGuidance
        }}
      />
    </div>
  );
};
