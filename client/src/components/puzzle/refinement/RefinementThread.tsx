/**
 * RefinementThread.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-11-19
 * PURPOSE: Main component for displaying progressive refinement thread.
 * Shows original analysis followed by linear progression of refinement iterations.
 * Supports continuation mode for Responses API conversation chaining.
 * Single responsibility: Manage refinement thread display and coordination.
 * SRP/DRY check: Pass - Single responsibility (thread coordination), reuses OriginalExplanationCard and delegates to IterationCard
 * shadcn/ui: Pass - Converted to DaisyUI card, badge, button, textarea, alert, select
 */

import React, { useRef, useEffect, useState } from 'react';
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
  const [previewMode, setPreviewMode] = useState<'view' | 'run' | null>(null);

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

  // Get last response ID for continuation
  const getLastResponseId = (): string | undefined => {
    if (iterations.length === 0) return undefined;
    const lastIteration = iterations[iterations.length - 1];
    return lastIteration.content.providerResponseId || undefined;
  };

  return (
    <div className="space-y-1">
      {/* Improved Header - Better Readability */}
      <div className="card border-2 border-purple-200 bg-white shadow-sm">
        <div className="card-body p-4 space-y-3">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <div>
                <h2 className="text-base font-semibold text-gray-900">Progressive Reasoning</h2>
                <p className="text-xs text-gray-600">
                  {iterations.length} iteration{iterations.length !== 1 ? 's' : ''} • {modelDisplayName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="btn btn-outline btn-sm text-xs h-8"
                onClick={onResetRefinement}
                disabled={iterations.length <= 1 || isProcessing}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset
              </button>
              <button className="btn btn-outline btn-sm text-xs h-8" onClick={onBackToList}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Back
              </button>
            </div>
          </div>

          {/* Stats Row - Readable Sizes with Color Backgrounds */}
          <div className="pt-3 border-t border-purple-200">
            <div className="grid grid-cols-3 gap-3">
              {/* Active Model */}
              <div className="bg-purple-50 rounded-lg p-2 border border-purple-200">
                <div className="flex items-center gap-2 mb-1">
                  <Brain className="h-3.5 w-3.5 text-purple-600" />
                  <span className="text-xs font-medium text-purple-900">Model</span>
                </div>
                <div className="text-xs font-mono text-purple-700">
                  {modelDisplayName}
                </div>
              </div>

              {/* Total Reasoning */}
              <div className="bg-blue-50 rounded-lg p-2 border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-xs font-medium text-blue-900">Reasoning</span>
                </div>
                <div className="text-xs font-semibold text-blue-700">
                  {totalReasoningTokens.toLocaleString()} tokens
                </div>
              </div>

              {/* Current Iteration */}
              <div className="bg-indigo-50 rounded-lg p-2 border border-indigo-200">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-indigo-600" />
                  <span className="text-xs font-medium text-indigo-900">Current</span>
                </div>
                <div className="text-xs font-mono font-semibold text-indigo-700">
                  Iteration #{iterations.length - 1}
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Controls Section - READABLE SIZE */}
          {(showTemperature || showReasoning) && (
            <div className="pt-2 border-t border-purple-200">
              <div className="flex items-center gap-1.5 mb-1">
                <Settings className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-medium text-gray-700">Advanced Controls</span>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                {/* Temperature Control - EDITABLE */}
                {showTemperature && (
                  <div className="p-2 bg-gray-50 border border-gray-200 rounded">
                    <div className="flex items-center gap-2">
                      <label htmlFor="temperature" className="label text-xs font-medium whitespace-nowrap">
                        Temperature: {temperature.toFixed(2)}
                      </label>
                      <div className="flex-1 max-w-xs">
                        <input
                          type="range"
                          id="temperature"
                          min="0.1"
                          max="2.0"
                          step="0.05"
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                          className="range range-xs w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* GPT-5 Reasoning Parameters - EDITABLE */}
                {showReasoning && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                    <div className="grid grid-cols-3 gap-2">
                      {/* Effort */}
                      <div>
                        <label htmlFor="reasoning-effort" className="label text-xs font-medium text-blue-700">
                          Effort
                        </label>
                        <select 
                          className="select select-bordered w-full h-8 text-xs"
                          value={reasoningEffort}
                          onChange={(e) => setReasoningEffort(e.target.value as 'minimal' | 'low' | 'medium' | 'high')}
                        >
                          <option value="minimal">Minimal</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>

                      {/* Verbosity */}
                      <div>
                        <label htmlFor="reasoning-verbosity" className="label text-xs font-medium text-blue-700">
                          Verbosity
                        </label>
                        <select 
                          className="select select-bordered w-full h-8 text-xs"
                          value={reasoningVerbosity}
                          onChange={(e) => setReasoningVerbosity(e.target.value as 'low' | 'medium' | 'high')}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>

                      {/* Summary */}
                      <div>
                        <label htmlFor="reasoning-summary" className="label text-xs font-medium text-blue-700">
                          Summary
                        </label>
                        <select 
                          className="select select-bordered w-full h-8 text-xs"
                          value={reasoningSummaryType}
                          onChange={(e) => setReasoningSummaryType(e.target.value as 'auto' | 'detailed')}
                        >
                          <option value="auto">Auto</option>
                          <option value="detailed">Detailed</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Prompt Preview Button */}
                <div className="flex justify-center">
                  <button
                    className="btn btn-outline btn-sm flex items-center gap-1 h-8 text-xs"
                    onClick={() => {
                      setPreviewMode('view');
                      setShowPromptPreview(true);
                    }}
                    disabled={isProcessing}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Preview Prompt
                  </button>
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
                <textarea
                  className="textarea textarea-bordered text-xs resize-none"
                  value={userGuidance}
                  onChange={(e) => onUserGuidanceChange(e.target.value)}
                  placeholder="Leave blank for the model to refine based on its own analysis"
                  rows={2}
                />
              </div>

              {/* Continue Button */}
              <div>
                <button
                  className="btn w-full h-[72px] text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                  onClick={() => {
                    setPreviewMode('run');
                    setShowPromptPreview(true);
                  }}
                  disabled={isProcessing}
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
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div role="alert" className="alert alert-error mt-3 py-2">
                <span className="text-xs">
                  {error.message}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

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
        onClose={() => {
          setShowPromptPreview(false);
          setPreviewMode(null);
        }}
        task={task}
        taskId={taskId}
        promptId={promptId}
        options={{
          originalExplanation: originalExplanation,
          customChallenge: userGuidance,
          previousResponseId: getLastResponseId() // ✅ CRITICAL FIX: Pass for continuation mode
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
};
