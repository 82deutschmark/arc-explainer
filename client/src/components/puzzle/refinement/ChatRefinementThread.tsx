/**
 * ChatRefinementThread.tsx
 *
 * Author: Cascade using Sonnet 4.5
 * Date: 2025-10-11
 * PURPOSE: Chat-style conversation UI for progressive reasoning.
 * Simple, message-focused interface showing AI's iterative attempts at solving the puzzle.
 * 
 * FOCUS: Did the AI get the correct answer? How did it improve over iterations?
 * 
 * SRP/DRY check: Pass - Orchestrates chat conversation display
 * shadcn/ui: Pass - Uses shadcn/ui components
 */

import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, ArrowLeft, Send, Loader2, RotateCcw, MessageSquare, Target } from 'lucide-react';
import { ChatIterationCard } from './ChatIterationCard';
import type { ExplanationData } from '@/types/puzzle';
import type { ARCExample, ModelConfig } from '@shared/types';

interface RefinementIteration {
  id: string;
  iterationNumber: number;
  content: ExplanationData;
  timestamp: string;
}

interface ChatRefinementThreadProps {
  // Core data
  iterations: RefinementIteration[];
  taskId: string;
  testCases: ARCExample[];
  models?: ModelConfig[];

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

  // Actions
  onBackToList: () => void;
  onResetRefinement: () => void;
  onUserGuidanceChange: (guidance: string) => void;
  onContinueRefinement: () => void;
}

export const ChatRefinementThread: React.FC<ChatRefinementThreadProps> = ({
  iterations,
  taskId,
  testCases,
  models,
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
  onBackToList,
  onResetRefinement,
  onUserGuidanceChange,
  onContinueRefinement
}) => {
  const threadEndRef = useRef<HTMLDivElement>(null);
  const [showControls, setShowControls] = useState(false);

  // Auto-scroll to newest iteration
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [iterations.length]);

  // Get current model info
  const currentModel = models?.find(m => m.key === activeModel);
  const modelDisplayName = currentModel?.name || activeModel;

  // Model capabilities
  const showTemperature = currentModel?.supportsTemperature && !isGPT5ReasoningModel(activeModel);
  const showReasoning = isGPT5ReasoningModel(activeModel);

  // Calculate statistics
  const totalAttempts = iterations.length;
  const correctAttempts = iterations.filter(iter => {
    const hasMulti = iter.content.hasMultiplePredictions;
    return hasMulti 
      ? iter.content.multiTestAllCorrect === true
      : iter.content.isPredictionCorrect === true;
  }).length;
  const totalReasoningTokens = iterations.reduce(
    (sum, iter) => sum + (iter.content.reasoningTokens || 0),
    0
  );

  // Get correct answer grid for comparison
  const correctAnswerGrid = testCases[0]?.output || [[0]];

  // Latest iteration
  const latestIteration = iterations[iterations.length - 1];
  const isLatestCorrect = latestIteration 
    ? (latestIteration.content.hasMultiplePredictions
      ? latestIteration.content.multiTestAllCorrect === true
      : latestIteration.content.isPredictionCorrect === true)
    : false;

  return (
    <div className="space-y-4">
      {/* Conversation Header */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-purple-900">Reasoning Conversation</h3>
              <Badge variant="outline" className="bg-purple-100 text-purple-900 border-purple-300 font-mono text-xs">
                {modelDisplayName}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onResetRefinement}
                disabled={iterations.length <= 1 || isProcessing}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              <Button variant="outline" size="sm" onClick={onBackToList}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-3 p-3 bg-white/60 rounded-lg border border-purple-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-900">{totalAttempts}</div>
              <div className="text-xs text-gray-600">Attempts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{correctAttempts}</div>
              <div className="text-xs text-gray-600">Correct</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{totalReasoningTokens.toLocaleString()}</div>
              <div className="text-xs text-gray-600">Reasoning Tokens</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${isLatestCorrect ? 'text-green-600' : 'text-amber-600'}`}>
                {isLatestCorrect ? '✓' : '✗'}
              </div>
              <div className="text-xs text-gray-600">Current Status</div>
            </div>
          </div>

          {/* Advanced Controls Toggle */}
          {(showTemperature || showReasoning) && (
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowControls(!showControls)}
                className="w-full text-xs"
              >
                {showControls ? '▼ Hide Advanced Controls' : '▶ Show Advanced Controls'}
              </Button>

              {showControls && (
                <div className="mt-3 p-3 bg-white/60 rounded-lg border border-purple-200 space-y-3">
                  {/* Temperature */}
                  {showTemperature && (
                    <div>
                      <Label htmlFor="temp" className="text-sm font-medium">
                        Temperature: {temperature.toFixed(2)}
                      </Label>
                      <Slider
                        id="temp"
                        min={0.1}
                        max={2.0}
                        step={0.05}
                        value={[temperature]}
                        onValueChange={(val) => setTemperature(val[0])}
                        className="mt-1"
                      />
                    </div>
                  )}

                  {/* GPT-5 Reasoning */}
                  {showReasoning && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Effort</Label>
                        <Select value={reasoningEffort} onValueChange={(v) => setReasoningEffort(v as any)}>
                          <SelectTrigger className="h-8 text-xs">
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
                      <div>
                        <Label className="text-xs">Verbosity</Label>
                        <Select value={reasoningVerbosity} onValueChange={(v) => setReasoningVerbosity(v as any)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Summary</Label>
                        <Select value={reasoningSummaryType} onValueChange={(v) => setReasoningSummaryType(v as any)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto</SelectItem>
                            <SelectItem value="detailed">Detailed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation Thread */}
      <div className="space-y-3">
        {iterations.map((iteration, index) => {
          const cumulativeTokens = iterations
            .slice(0, index + 1)
            .reduce((sum, iter) => sum + (iter.content.reasoningTokens || 0), 0);

          return (
            <ChatIterationCard
              key={iteration.id}
              explanation={iteration.content}
              iterationNumber={iteration.iterationNumber}
              timestamp={iteration.timestamp}
              cumulativeReasoningTokens={cumulativeTokens}
              correctAnswerGrid={correctAnswerGrid}
            />
          );
        })}

        {/* Anchor for auto-scroll */}
        <div ref={threadEndRef} />
      </div>

      {/* Input Area */}
      <Card className="border-purple-300 bg-gradient-to-r from-purple-50 to-blue-50 sticky bottom-4 shadow-lg">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* User Guidance */}
            <div>
              <Label htmlFor="guidance" className="text-sm font-medium text-gray-700 mb-1 block">
                User Guidance (Optional)
              </Label>
              <Textarea
                id="guidance"
                value={userGuidance}
                onChange={(e) => onUserGuidanceChange(e.target.value)}
                placeholder="Leave blank for the model to self-refine, or provide specific guidance like 'Focus on edge cases' or 'Try a different approach'..."
                rows={3}
                className="text-sm resize-none"
              />
            </div>

            {/* Send Button */}
            <Button
              onClick={onContinueRefinement}
              disabled={isProcessing}
              className="w-full h-12 text-base bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Thinking...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 mr-2" />
                  Continue Refinement
                </>
              )}
            </Button>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm">
                  {error.message}
                </AlertDescription>
              </Alert>
            )}

            {/* Success Message */}
            {isLatestCorrect && (
              <Alert className="bg-green-50 border-green-200">
                <Target className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm text-green-800">
                  <strong>Success!</strong> The model found the correct answer. You can continue refining to see if it provides better explanations.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
