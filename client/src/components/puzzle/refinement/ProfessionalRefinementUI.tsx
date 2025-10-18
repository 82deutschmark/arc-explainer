/**
 * ProfessionalRefinementUI.tsx
 *
 * Author: Cascade using Sonnet 4.5
 * Date: 2025-10-11
 * PURPOSE: Professional research interface for progressive reasoning analysis.
 * Data-dense tabular presentation similar to financial terminals and research platforms.
 * Matches the design pattern of PuzzleExaminer for consistency.
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
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, ArrowLeft, Send, Loader2, RotateCcw, TrendingUp, Sparkles, Target, Settings, Eye, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { IterationDataTable } from './IterationDataTable';
import { PromptPicker } from '@/components/PromptPicker';
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
  onBackToList,
  onResetRefinement,
  onUserGuidanceChange,
  onContinueRefinement
}) => {
  const [showPromptPreview, setShowPromptPreview] = React.useState(false);
  const [previewMode, setPreviewMode] = React.useState<'view' | 'run' | null>(null);
  const [showInlinePreview, setShowInlinePreview] = React.useState(false);
  const [promptPreviewData, setPromptPreviewData] = React.useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false);
  const currentModel = models?.find(m => m.key === activeModel);
  const modelDisplayName = currentModel?.name || activeModel;
  const showTemperature = currentModel?.supportsTemperature && !isGPT5ReasoningModel(activeModel);
  const showReasoning = isGPT5ReasoningModel(activeModel);

  // Calculate comprehensive metrics
  const currentIteration = iterations.length;
  const latest = iterations.length > 0 ? iterations[iterations.length - 1] : null;
  
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

  // Fetch inline prompt preview when user expands preview
  const fetchInlinePromptPreview = React.useCallback(async () => {
    if (promptPreviewData || isLoadingPreview) return;
    
    setIsLoadingPreview(true);
    try {
      const response = await fetch('/api/prompt-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'openai',
          taskId,
          promptId,
          customPrompt,
          omitAnswer: true,
          customChallenge: userGuidance
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setPromptPreviewData(result.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch prompt preview:', err);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [taskId, promptId, customPrompt, userGuidance, promptPreviewData, isLoadingPreview]);

  // Auto-refresh preview when user guidance changes
  React.useEffect(() => {
    if (showInlinePreview) {
      setPromptPreviewData(null);
      fetchInlinePromptPreview();
    }
  }, [userGuidance]);

  return (
    <div className="space-y-4">
      {/* Header Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="h-5 w-5 text-purple-600" />
              <div>
                <CardTitle className="text-lg">Progressive Reasoning Analysis</CardTitle>
                <p className="text-sm text-gray-600 mt-0.5">
                  Tracking iterative model refinement • Model: <span className="font-mono">{modelDisplayName}</span>
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
                  <Badge className="bg-green-600 text-xs px-2 py-0.5">✓</Badge>
                ) : (
                  <Badge className="bg-red-600 text-xs px-2 py-0.5">✗</Badge>
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

      {/* Prompt Preview - Prominent and Inline */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 border-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <CardTitle className="text-base">Prompt Configuration</CardTitle>
                <p className="text-xs text-gray-600 mt-0.5">Review what will be sent to the AI model</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white font-mono text-xs">
                {promptId}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowInlinePreview(!showInlinePreview);
                  if (!showInlinePreview && !promptPreviewData) {
                    fetchInlinePromptPreview();
                  }
                }}
                disabled={isProcessing}
                className="text-xs h-8"
              >
                {showInlinePreview ? (
                  <><ChevronUp className="h-3 w-3 mr-1" />Hide Preview</>
                ) : (
                  <><ChevronDown className="h-3 w-3 mr-1" />Show Preview</>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPreviewMode('view');
                  setShowPromptPreview(true);
                }}
                disabled={isProcessing}
                className="text-xs h-8"
              >
                <Eye className="h-3 w-3 mr-1" />
                Full Modal
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {/* Inline Preview */}
        {showInlinePreview && (
          <CardContent className="pt-2 pb-3">
            {isLoadingPreview ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-gray-500">Loading preview...</span>
              </div>
            ) : promptPreviewData ? (
              <div className="space-y-3">
                {/* Template Info */}
                {promptPreviewData.selectedTemplate && (
                  <div className="bg-white rounded p-2 border border-blue-200">
                    <div className="text-xs font-semibold text-blue-800">
                      {promptPreviewData.selectedTemplate.emoji} {promptPreviewData.selectedTemplate.name}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {promptPreviewData.selectedTemplate.description}
                    </div>
                  </div>
                )}
                
                {/* System Prompt Preview */}
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-700">System Prompt ({promptPreviewData.systemPrompt?.length || 0} chars)</div>
                  <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-auto max-h-32 whitespace-pre-wrap">
                    {promptPreviewData.systemPrompt || '(No system prompt)'}
                  </pre>
                </div>
                
                {/* User Prompt Preview */}
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-gray-700">User Prompt ({promptPreviewData.userPrompt?.length || 0} chars)</div>
                  <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-auto max-h-48 whitespace-pre-wrap">
                    {promptPreviewData.userPrompt || '(No user prompt)'}
                  </pre>
                </div>
                
                {/* Stats Summary */}
                <div className="bg-white rounded p-2 border border-gray-200 text-xs text-gray-600">
                  <strong>Total:</strong> {(promptPreviewData.systemPrompt?.length || 0) + (promptPreviewData.userPrompt?.length || 0)} characters (~{Math.ceil(((promptPreviewData.systemPrompt?.length || 0) + (promptPreviewData.userPrompt?.length || 0)) / 4)} tokens)
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">
                Click "Show Preview" to load prompt details
              </div>
            )}
          </CardContent>
        )}
        
        {/* Quick Info When Collapsed */}
        {!showInlinePreview && (
          <CardContent className="pt-0 pb-3">
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs text-yellow-800">
              <strong>⚠️ Important:</strong> Always review the prompt before sending. Click "Show Preview" to see what will be sent to the AI model.
            </div>
          </CardContent>
        )}
      </Card>

      {/* Advanced Controls - Only show relevant parameters */}
      {(showTemperature || showReasoning) && (
        <CollapsibleCard
          title="Advanced Model Parameters"
          icon={Settings}
          defaultOpen={false}
          headerDescription={
            <p className="text-sm text-gray-600">Fine-tune model behavior for refinement iterations</p>
          }
        >
          {/* Temperature Control */}
          {showTemperature && (
            <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded">
              <div className="flex items-center gap-3">
                <Label htmlFor="temperature" className="text-sm font-medium whitespace-nowrap">
                  Temperature: {temperature.toFixed(2)}
                </Label>
                <div className="flex-1 max-w-xs">
                  <Slider
                    id="temperature"
                    min={0.1}
                    max={2.0}
                    step={0.05}
                    value={[temperature]}
                    onValueChange={(val) => setTemperature(val[0])}
                    className="w-full"
                  />
                </div>
                <div className="text-xs text-gray-600 flex-shrink-0">
                  <div>Controls creativity</div>
                </div>
              </div>
            </div>
          )}

          {showReasoning && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded">
              <h5 className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <Brain className="h-3 w-3" />
                GPT-5 Reasoning Parameters
              </h5>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm text-blue-700">Effort Level</Label>
                  <Select value={reasoningEffort} onValueChange={(v) => setReasoningEffort(v as any)}>
                    <SelectTrigger className="mt-1">
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
                  <Label className="text-sm text-blue-700">Verbosity</Label>
                  <Select value={reasoningVerbosity} onValueChange={(v) => setReasoningVerbosity(v as any)}>
                    <SelectTrigger className="mt-1">
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
                  <Label className="text-sm text-blue-700">Summary Type</Label>
                  <Select value={reasoningSummaryType} onValueChange={(v) => setReasoningSummaryType(v as any)}>
                    <SelectTrigger className="mt-1">
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
        </CollapsibleCard>
      )}

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
          customChallenge: userGuidance
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

      {/* Continue Refinement Section */}
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
    </div>
  );
};
