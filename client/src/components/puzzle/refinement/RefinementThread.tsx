/**
 * RefinementThread.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5 (updated by Codex / GPT-5)
 * PURPOSE: Main component for displaying progressive refinement threads.
 * Rebuilt on shadcn/ui primitives so buttons, selects, sliders, and alerts
 * align with the global design system.
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  Brain,
  ArrowLeft,
  Sparkles,
  TrendingUp,
  Send,
  Loader2,
  RotateCcw,
  Eye,
  Settings,
} from 'lucide-react';

import { OriginalExplanationCard } from '@/components/puzzle/debate/OriginalExplanationCard';
import { IterationCard } from './IterationCard';
import { PromptPreviewModal } from '@/components/PromptPreviewModal';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { ExplanationData } from '@/types/puzzle';
import type { ARCExample, ModelConfig, ARCTask } from '@shared/types';

interface RefinementIteration {
  id: string;
  iterationNumber: number;
  content: ExplanationData;
  timestamp: string;
}

interface RefinementThreadProps {
  originalExplanation: ExplanationData;
  iterations: RefinementIteration[];
  taskId: string;
  testCases: ARCExample[];
  models?: ModelConfig[];
  task: ARCTask;
  activeModel: string;
  userGuidance: string;
  isProcessing: boolean;
  error?: Error | null;
  temperature: number;
  setTemperature: (value: number) => void;
  reasoningEffort: 'minimal' | 'low' | 'medium' | 'high';
  setReasoningEffort: (value: 'minimal' | 'low' | 'medium' | 'high') => void;
  reasoningVerbosity: 'low' | 'medium' | 'high';
  setReasoningVerbosity: (value: 'low' | 'medium' | 'high') => void;
  reasoningSummaryType: 'auto' | 'detailed';
  setReasoningSummaryType: (value: 'auto' | 'detailed') => void;
  isGPT5ReasoningModel: (modelKey: string) => boolean;
  promptId: string;
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
  onContinueRefinement,
}) => {
  const threadEndRef = useRef<HTMLDivElement>(null);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'view' | 'run' | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [iterations.length]);

  const originalIteration = iterations.find(iter => iter.iterationNumber === 0);
  const refinementIterations = iterations.filter(iter => iter.iterationNumber > 0);
  const totalReasoningTokens = iterations.reduce(
    (sum, iter) => sum + (iter.content.reasoningTokens || 0),
    0,
  );

  const currentModel = models?.find(m => m.key === activeModel);
  const modelDisplayName = currentModel?.name || activeModel;
  const showTemperature = currentModel?.supportsTemperature && !isGPT5ReasoningModel(activeModel);
  const showReasoning = isGPT5ReasoningModel(activeModel);

  const getLastResponseId = (): string | undefined => {
    if (iterations.length === 0) return undefined;
    return iterations[iterations.length - 1].content.providerResponseId || undefined;
  };

  return (
    <div className="space-y-4">
      <Card className="border-2 border-purple-200 bg-white shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-base font-semibold text-gray-900">Progressive Reasoning</p>
                <p className="text-xs text-muted-foreground">
                  {iterations.length} iteration{iterations.length !== 1 ? 's' : ''} • {modelDisplayName}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onResetRefinement}
                disabled={iterations.length <= 1 || isProcessing}
              >
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Reset
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onBackToList}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Back
              </Button>
            </div>
          </div>

          <div className="grid gap-3 border-t border-purple-200 pt-3 md:grid-cols-3">
            <div className="rounded-lg border border-purple-200 bg-purple-50/80 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-purple-900">
                <Brain className="h-3.5 w-3.5 text-purple-600" />
                Model
              </p>
              <p className="font-mono text-xs text-purple-700">{modelDisplayName}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-blue-900">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                Reasoning
              </p>
              <p className="text-xs font-semibold text-blue-700">
                {totalReasoningTokens.toLocaleString()} tokens
              </p>
            </div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 p-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-indigo-900">
                <TrendingUp className="h-3.5 w-3.5 text-indigo-600" />
                Current Iteration
              </p>
              <p className="font-mono text-xs font-semibold text-indigo-700">#{iterations.length - 1}</p>
            </div>
          </div>

          {(showTemperature || showReasoning) && (
            <div className="space-y-3 border-t border-purple-200 pt-3">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                <Settings className="h-4 w-4 text-purple-600" />
                Advanced Controls
              </div>

              <div className="grid gap-3">
                {showTemperature && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium text-gray-700">
                        Temperature: {temperature.toFixed(2)}
                      </label>
                      <Slider
                        value={[temperature]}
                        onValueChange={value => setTemperature(value[0])}
                        min={0.1}
                        max={2}
                        step={0.05}
                      />
                    </div>
                  </div>
                )}

                {showReasoning && (
                  <div className="grid gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 md:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-blue-700">Effort</label>
                      <Select
                        value={reasoningEffort}
                        onValueChange={value =>
                          setReasoningEffort(value as 'minimal' | 'low' | 'medium' | 'high')
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select effort" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minimal">Minimal</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-blue-700">Verbosity</label>
                      <Select
                        value={reasoningVerbosity}
                        onValueChange={value => setReasoningVerbosity(value as 'low' | 'medium' | 'high')}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select verbosity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-blue-700">Summary</label>
                      <Select
                        value={reasoningSummaryType}
                        onValueChange={value => setReasoningSummaryType(value as 'auto' | 'detailed')}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select summary" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto</SelectItem>
                          <SelectItem value="detailed">Detailed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPreviewMode('view');
                      setShowPromptPreview(true);
                    }}
                    disabled={isProcessing}
                  >
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    Preview Prompt
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3 border-t border-purple-200 pt-3">
            <div className="grid gap-3 lg:grid-cols-3 lg:items-end">
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  User Guidance (Optional)
                </label>
                <Textarea
                  value={userGuidance}
                  onChange={e => onUserGuidanceChange(e.target.value)}
                  placeholder="Leave blank for the model to refine based on its own analysis"
                  rows={3}
                  className="text-xs"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Example: “Focus on rotational symmetry” or “Re-check color mapping”
                </p>
              </div>
              <div>
                <Button
                  type="button"
                  className="h-[72px] w-full bg-gradient-to-r from-purple-600 to-blue-600 text-sm text-white hover:from-purple-700 hover:to-blue-700"
                  onClick={() => {
                    setPreviewMode('run');
                    setShowPromptPreview(true);
                  }}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Refining...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Continue Refinement
                    </>
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{error.message}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
