/**
 * ProfessionalRefinementUI.tsx
 *
 * Author: Cascade using Sonnet 4.5
 * Date: 2025-11-19
 * PURPOSE: Professional research interface for progressive reasoning analysis.
 * Data-dense tabular presentation similar to financial terminals and research platforms.
 * Supports continuation mode for Responses API conversation chaining.
 *
 * SRP/DRY check: Pass - Orchestrates refinement UI with professional data presentation
 * shadcn/ui: Pass - Uses shadcn/ui components throughout
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Brain, ArrowLeft, Send, Loader2, RotateCcw, TrendingUp, Sparkles, Target, Settings } from 'lucide-react';
import { AdvancedControls } from '@/components/puzzle/AdvancedControls';
import { IterationDataTable } from './IterationDataTable';
import { PromptPreviewModal } from '@/components/PromptPreviewModal';
import type { ExplanationData } from '@/types/puzzle';
import type { ARCExample, ModelConfig, ARCTask } from '@shared/types';

interface RefinementIteration {
  id: string;
  iterationNumber: number;
  content: ExplanationData;
  timestamp: string;
}

interface ProfessionalRefinementUIProps {
  iterations: RefinementIteration[];
  taskId: string;
  task: ARCTask;
  testCases: ARCExample[];
  models?: ModelConfig[];
  activeModel: string;
  userGuidance: string;
  isProcessing: boolean;
  error?: Error | null;
  
  // Prompt controls
  promptId: string;
  setPromptId: (id: string) => void;
  customPrompt?: string;
  setCustomPrompt?: (text: string) => void;
  
  // Advanced model parameters
  temperature: number;
  setTemperature: (value: number) => void;
  topP?: number;
  setTopP?: (value: number) => void;
  candidateCount?: number;
  setCandidateCount?: (value: number) => void;
  thinkingBudget?: number;
  setThinkingBudget?: (value: number) => void;
  
  // GPT-5 reasoning
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
  setReasoningEffort: (value: 'minimal' | 'low' | 'medium' | 'high') => void;
  reasoningVerbosity: 'low' | 'medium' | 'high';
  setReasoningVerbosity: (value: 'low' | 'medium' | 'high') => void;
  reasoningSummaryType: 'auto' | 'detailed';
  setReasoningSummaryType: (value: 'auto' | 'detailed') => void;
  isGPT5ReasoningModel: (modelKey: string) => boolean;
  
  includeGridImages: boolean;
  setIncludeGridImages: (value: boolean) => void;
  
  // Actions
  onBackToList: () => void;
  onResetRefinement: () => void;
  onUserGuidanceChange: (guidance: string) => void;
  onContinueRefinement: () => void;
}

export const ProfessionalRefinementUI: React.FC<ProfessionalRefinementUIProps> = ({
  iterations,
  taskId,
  task,
  testCases,
  models,
  activeModel,
  userGuidance,
  isProcessing,
  error,
  promptId,
  setPromptId,
  customPrompt,
  setCustomPrompt,
  temperature,
  setTemperature,
  topP,
  setTopP,
  candidateCount,
  setCandidateCount,
  thinkingBudget,
  setThinkingBudget,
  reasoningEffort,
  setReasoningEffort,
  reasoningVerbosity,
  setReasoningVerbosity,
  reasoningSummaryType,
  setReasoningSummaryType,
  isGPT5ReasoningModel,
  includeGridImages,
  setIncludeGridImages,
  onBackToList,
  onResetRefinement,
  onUserGuidanceChange,
  onContinueRefinement
}) => {
  const [showPromptPreview, setShowPromptPreview] = React.useState(false);
  const [previewMode, setPreviewMode] = React.useState<'view' | 'run' | null>(null);
  const currentModel = models?.find(m => m.key === activeModel);
  const modelDisplayName = currentModel?.name || activeModel;
  const showTemperature = currentModel?.supportsTemperature && !isGPT5ReasoningModel(activeModel);
  const showReasoning = isGPT5ReasoningModel(activeModel);

  // Calculate comprehensive metrics
  const currentIteration = iterations.length;
  const latest = iterations.length > 0 ? iterations[iterations.length - 1] : null;
  const originalIteration = iterations.find(iter => iter.iterationNumber === 1) ?? iterations[0];
  const originalExplanation = originalIteration?.content;
  
  const totalCost = iterations.reduce((sum, iter) => {
    const cost = Number(iter.content.estimatedCost) || 0;
    return sum + cost;
  }, 0);
  const totalTokens = iterations.reduce((sum, iter) => sum + (Number(iter.content.totalTokens) || 0), 0);
  const totalInputTokens = iterations.reduce((sum, iter) => sum + (Number(iter.content.inputTokens) || 0), 0);
  const totalOutputTokens = iterations.reduce((sum, iter) => sum + (Number(iter.content.outputTokens) || 0), 0);
  const totalReasoningTokens = iterations.reduce((sum, iter) => sum + (Number(iter.content.reasoningTokens) || 0), 0);
  const totalProcessingTime = iterations.reduce((sum, iter) => sum + (iter.content.apiProcessingTimeMs || 0), 0);
  const avgConfidence = iterations.length > 0 
    ? iterations.reduce((sum, iter) => sum + (typeof iter.content.confidence === 'number' ? iter.content.confidence : 0), 0) / iterations.length
    : 0;
  
  const isLatestCorrect = latest && (
    latest.content.hasMultiplePredictions
      ? latest.content.multiTestAllCorrect === true
      : latest.content.isPredictionCorrect === true
  );

  // Get the last response ID for continuation
  const getLastResponseId = (): string | undefined => {
    if (iterations.length === 0) return undefined;
    const lastIteration = iterations[iterations.length - 1];
    return lastIteration.content.providerResponseId || undefined;
  };

  return (
    <div className="space-y-3">
      {/* Continue Refinement Section - moved to top for better UX */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            Continue Refinement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <Label htmlFor="guidance" className="text-sm font-medium">
                User Guidance (Optional)
              </Label>
              <Textarea
                id="guidance"
                value={userGuidance}
                onChange={(e) => onUserGuidanceChange(e.target.value)}
                placeholder="Provide specific guidance for the model to refine its analysis, or leave blank for autonomous refinement..."
                rows={3}
                className="mt-1 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank for model to self-refine based on previous iteration
              </p>
            </div>

            <Button
              onClick={() => {
                setPreviewMode('run');
                setShowPromptPreview(true);
              }}
              disabled={isProcessing}
              className="w-full h-11 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing Refinement...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Generate Next Iteration
                </>
              )}
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertDescription className="text-sm">
                  {error.message}
                </AlertDescription>
              </Alert>
            )}

            {isLatestCorrect && (
              <Alert className="bg-green-50 border-green-200">
                <Target className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm text-green-800">
                  <strong>Success:</strong> Model has achieved correct prediction. You may continue refining for improved analysis quality.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Controls - Only show relevant parameters */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Settings className="h-4 w-4" />
            Advanced Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <AdvancedControls
            temperature={temperature}
            onTemperatureChange={setTemperature}
            topP={topP ?? 1}
            onTopPChange={(value) => {
              if (setTopP) setTopP(value);
            }}
            candidateCount={candidateCount ?? 1}
            onCandidateCountChange={(value) => {
              if (setCandidateCount) setCandidateCount(value);
            }}
            thinkingBudget={thinkingBudget ?? -1}
            onThinkingBudgetChange={(value) => {
              if (setThinkingBudget) setThinkingBudget(value);
            }}
            reasoningEffort={reasoningEffort}
            onReasoningEffortChange={setReasoningEffort}
            reasoningVerbosity={reasoningVerbosity}
            onReasoningVerbosityChange={setReasoningVerbosity}
            reasoningSummaryType={reasoningSummaryType}
            onReasoningSummaryTypeChange={setReasoningSummaryType}
            includeGridImages={includeGridImages}
            onIncludeGridImagesChange={setIncludeGridImages}
          />
        </CardContent>
      </Card>

      {/* Header Section - moved below controls to reduce visual clutter */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="h-5 w-5 text-purple-600" />
              <div>
                <CardTitle className="text-lg">Progressive Reasoning Analysis</CardTitle>
                <p className="text-sm text-gray-600 mt-0.5">
                  Tracking iterative model refinement - Model: <span className="font-mono">{modelDisplayName}</span>
                </p>
              </div>
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
                Back to List
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Compact Metrics Panel */}
          <div className="grid grid-cols-8 gap-2 p-2 bg-gray-50 rounded border border-gray-200 text-xs">
            <div className="text-center">
              <div className="text-gray-500 font-medium mb-0.5">Iteration</div>
              <div className="text-lg font-bold text-gray-900">#{currentIteration}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 font-medium mb-0.5">Status</div>
              <div className="flex items-center justify-center">
                {isLatestCorrect ? (
                  <Badge className="bg-green-600 text-xs px-2 py-0.5">
                    &#10003;
                  </Badge>
                ) : (
                  <Badge className="bg-red-600 text-xs px-2 py-0.5">
                    &#10007;
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 font-medium mb-0.5">Cost</div>
              <div className="font-mono font-semibold text-blue-600">${(totalCost || 0).toFixed(4)}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 font-medium mb-0.5">Input Tok</div>
              <div className="font-mono font-semibold text-gray-700">{totalInputTokens.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 font-medium mb-0.5">Output Tok</div>
              <div className="font-mono font-semibold text-gray-700">{totalOutputTokens.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 font-medium mb-0.5">Reasoning</div>
              <div className="font-mono font-semibold text-purple-600">{totalReasoningTokens.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 font-medium mb-0.5">Time (ms)</div>
              <div className="font-mono font-semibold text-orange-600">{totalProcessingTime.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 font-medium mb-0.5">Avg Conf</div>
              <div className="font-mono font-semibold text-green-600">{avgConfidence.toFixed(0)}%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Iteration Data Table */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4" />
            Iteration History
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-2">
          <IterationDataTable
            iterations={iterations}
            testCases={testCases}
            models={models}
          />
        </CardContent>
      </Card>

      {/* Prompt Preview Modal */}
      <PromptPreviewModal
        isOpen={showPromptPreview}
        onClose={() => {
          setShowPromptPreview(false);
          setPreviewMode(null);
        }}
        task={task}
        taskId={taskId}
        promptId={promptId}
        options={{
          customChallenge: userGuidance,
          previousResponseId: getLastResponseId(), // CRITICAL FIX: Pass for continuation mode
          originalExplanation
        }}
        confirmMode={previewMode === 'run'}
        onConfirm={previewMode === 'run'
          ? async () => {
              await Promise.resolve(onContinueRefinement());
              setShowPromptPreview(false);
              setPreviewMode(null);
            }
          : undefined}
        confirmButtonText="Send Refinement Request"
      />
    </div>
  );
}
